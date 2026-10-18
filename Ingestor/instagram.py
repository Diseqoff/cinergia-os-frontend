"""Integración con Instagram (API con inicio de sesión de Instagram).

Este módulo no depende de FastAPI. Se divide en tres partes:

* ClienteInstagram: llamadas HTTP a graph.instagram.com con manejo de errores.
* Funciones puras que convierten las respuestas de la API en filas de la base.
* sincronizar(): guarda publicaciones, métricas diarias y el resumen mensual.

El token viaja siempre en la consulta que exige Meta, por lo que cualquier mensaje
de error se limpia antes de salir del módulo.
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx

# httpx registra cada petición con su dirección completa; el token viaja en ella
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
registro = logging.getLogger("cinergia.instagram")

ZONA_LIMA = timezone(timedelta(hours=-5))
VERSION_API = os.environ.get("IG_GRAPH_VERSION", "v23.0")
BASE_URL = f"https://graph.instagram.com/{VERSION_API}"
BASE_SIN_VERSION = "https://graph.instagram.com"

CAMPOS_MEDIA = "id,caption,media_type,media_product_type,permalink,timestamp"
CAMPOS_MEDIA_MINIMOS = "id,media_type,permalink,timestamp"

METRICAS_MEDIA = ["reach", "likes", "comments", "shares", "saved", "total_interactions", "views"]
METRICAS_CUENTA = ["reach", "views", "total_interactions"]

MEDIA_A_COLUMNA = {
    "reach": "alcance",
    "views": "vistas",
    "likes": "me_gusta",
    "comments": "comentarios",
    "shares": "compartidos",
    "saved": "guardados",
    "total_interactions": "interacciones",
}

VIDA_TOKEN_DIAS = 60
DIAS_REFRESCO_METRICAS = 90
MAXIMO_PRIMERA_CARGA = 100
MAXIMO_POR_SINCRONIZACION = 200
DIAS_CUENTA_RECIENTES = 3
DIAS_CUENTA_MAXIMO = 29
DIAS_PARA_RENOVAR_TOKEN = 30
FALLOS_PARA_DESCARTAR_METRICA = 2
CODIGOS_TOKEN_INVALIDO = {102, 190}
CODIGOS_LIMITE = {4, 17, 32, 613}


class ErrorInstagram(Exception):
    """Error controlado, con un mensaje apto para mostrar al usuario."""

    def __init__(self, mensaje: str, codigo: int | None = None, token_invalido: bool = False, limite: bool = False):
        super().__init__(mensaje)
        self.codigo = codigo
        self.token_invalido = token_invalido
        self.limite = limite


# ---------------------------------------------------------------------------
# Utilidades puras
# ---------------------------------------------------------------------------

def limpiar_secreto(texto: str, token: str | None) -> str:
    texto = re.sub(r"access_token=[^&\s\"']+", "access_token=***", texto)
    if token:
        texto = texto.replace(token, "***")
    return texto


def codigo_de_enlace(enlace: str | None) -> str | None:
    if not enlace:
        return None
    m = re.search(r"/(?:p|reel|reels|tv)/([A-Za-z0-9_-]+)", enlace)
    return m.group(1) if m else None


def formato_de_media(media_type: str | None, media_product_type: str | None) -> str | None:
    producto = (media_product_type or "").upper()
    tipo = (media_type or "").upper()
    if producto == "REELS":
        return "reel"
    if tipo == "CAROUSEL_ALBUM":
        return "carrusel"
    if tipo == "VIDEO":
        return "video"
    if tipo == "IMAGE":
        return "imagen"
    return None


def titulo_de_caption(caption: str | None, maximo: int = 80) -> str | None:
    if not caption:
        return None
    linea = next((l.strip() for l in caption.splitlines() if l.strip()), "")
    if not linea:
        return None
    return linea if len(linea) <= maximo else linea[: maximo - 1].rstrip() + "…"


def parsear_fecha_iso(valor: str | None) -> datetime | None:
    if not valor:
        return None
    # Instagram entrega 2026-10-01T15:04:05+0000
    texto = re.sub(r"([+-]\d{2})(\d{2})$", r"\1:\2", valor.strip())
    try:
        d = datetime.fromisoformat(texto.replace("Z", "+00:00"))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def valores_de_insights(respuesta: dict) -> dict[str, int]:
    """Convierte la respuesta de /insights en {métrica: valor}. Ignora conjuntos vacíos."""
    salida: dict[str, int] = {}
    for item in respuesta.get("data") or []:
        nombre = item.get("name")
        valor = None
        if isinstance(item.get("total_value"), dict):
            valor = item["total_value"].get("value")
        elif item.get("values"):
            valor = item["values"][0].get("value")
        if nombre and isinstance(valor, (int, float)) and not isinstance(valor, bool):
            salida[nombre] = int(valor)
    return salida


def fila_publicacion(media: dict, metricas: dict[str, int]) -> dict:
    """Campos de publicaciones que la API de Instagram puede completar."""
    publicada = parsear_fecha_iso(media.get("timestamp"))
    fila: dict[str, Any] = {
        "ig_media_id": str(media["id"]),
        "enlace": media.get("permalink"),
        "codigo": codigo_de_enlace(media.get("permalink")),
        "formato": formato_de_media(media.get("media_type"), media.get("media_product_type")),
        "fecha_publicacion": publicada.isoformat() if publicada else None,
        "titulo": titulo_de_caption(media.get("caption")),
        "descripcion": media.get("caption"),
    }
    for metrica, columna in MEDIA_A_COLUMNA.items():
        if metrica in metricas:
            fila[columna] = metricas[metrica]
    if "total_interactions" not in metricas:
        partes = [metricas[m] for m in ("likes", "comments", "shares", "saved") if m in metricas]
        if partes:
            fila["interacciones"] = sum(partes)
    return {k: v for k, v in fila.items() if v is not None}


def inicio_dia_lima(d: date) -> int:
    return int(datetime(d.year, d.month, d.day, tzinfo=ZONA_LIMA).timestamp())


# ---------------------------------------------------------------------------
# Cliente HTTP
# ---------------------------------------------------------------------------

class ClienteInstagram:
    def __init__(self, token: str, ig_user_id: str | None = None, transport: httpx.BaseTransport | None = None):
        self.token = token
        self.ig_user_id = ig_user_id
        self._http = httpx.Client(timeout=30, transport=transport)
        self._fallos: dict[tuple[str, str], int] = {}

    def cerrar(self) -> None:
        self._http.close()

    def _get(self, ruta_o_url: str, params: dict | None = None) -> dict:
        if ruta_o_url.startswith("http"):
            url, consulta = ruta_o_url, None
        else:
            url = f"{BASE_URL}/{ruta_o_url.lstrip('/')}"
            consulta = {**(params or {}), "access_token": self.token}
        try:
            r = self._http.get(url, params=consulta)
        except httpx.HTTPError as e:
            raise ErrorInstagram("No se pudo conectar con Instagram. Intenta de nuevo en unos minutos.") from None
        try:
            cuerpo = r.json()
        except ValueError:
            cuerpo = {}
        if r.status_code >= 400 or "error" in cuerpo:
            raise self._error(cuerpo.get("error") or {}, r.status_code)
        return cuerpo

    def _error(self, e: dict, estado: int) -> ErrorInstagram:
        codigo = e.get("code")
        mensaje = limpiar_secreto(str(e.get("message") or f"Respuesta {estado} de Instagram."), self.token)
        if codigo in CODIGOS_TOKEN_INVALIDO or estado == 401:
            return ErrorInstagram("El token de Instagram no es válido o expiró. Genera uno nuevo.", codigo, token_invalido=True)
        if codigo in CODIGOS_LIMITE or estado == 429:
            return ErrorInstagram("Instagram limitó las consultas por ahora. Se reintentará más tarde.", codigo, limite=True)
        return ErrorInstagram(mensaje, codigo)

    # -- cuenta ---------------------------------------------------------
    def perfil(self) -> dict:
        datos = self._get("me", {"fields": "user_id,username,followers_count,media_count"})
        identificador = datos.get("user_id") or datos.get("id")
        if not identificador:
            raise ErrorInstagram("Instagram no devolvió el identificador de la cuenta.")
        self.ig_user_id = str(identificador)
        return {
            "ig_user_id": self.ig_user_id,
            "usuario": datos.get("username"),
            "seguidores": datos.get("followers_count"),
            "publicaciones": datos.get("media_count"),
        }

    def refrescar_token(self) -> tuple[str, int]:
        datos = self._get(f"{BASE_SIN_VERSION}/refresh_access_token?grant_type=ig_refresh_token&access_token={self.token}")
        nuevo = datos.get("access_token")
        if not nuevo:
            raise ErrorInstagram("Instagram no devolvió un token renovado.")
        return nuevo, int(datos.get("expires_in") or VIDA_TOKEN_DIAS * 86400)

    # -- publicaciones --------------------------------------------------
    def listar_media(self, desde: datetime | None, maximo: int) -> list[dict]:
        campos = CAMPOS_MEDIA
        try:
            pagina = self._get(f"{self.ig_user_id}/media", {"fields": campos, "limit": 50})
        except ErrorInstagram as e:
            if e.token_invalido or e.limite:
                raise
            # Algunos campos solo existen con otro tipo de inicio de sesión
            campos = CAMPOS_MEDIA_MINIMOS
            pagina = self._get(f"{self.ig_user_id}/media", {"fields": campos, "limit": 50})

        salida: list[dict] = []
        while True:
            for m in pagina.get("data") or []:
                fecha = parsear_fecha_iso(m.get("timestamp"))
                if desde and fecha and fecha < desde:
                    return salida
                salida.append(m)
                if len(salida) >= maximo:
                    return salida
            siguiente = (pagina.get("paging") or {}).get("next")
            if not siguiente:
                return salida
            pagina = self._get(siguiente)

    def insights_media(self, media: dict, no_soportadas: dict[str, set[str]]) -> dict[str, int]:
        """Métricas de una publicación.

        Una métrica se deja de pedir para un tipo de contenido solo si falla en varias
        publicaciones distintas, para que una publicación con problemas propios no
        apague las cifras de las demás."""
        clave = f"{media.get('media_product_type', '')}|{media.get('media_type', '')}"
        descartadas = no_soportadas.setdefault(clave, set())
        pedir = [m for m in METRICAS_MEDIA if m not in descartadas]
        if not pedir:
            return {}
        ruta = f"{media['id']}/insights"
        try:
            return valores_de_insights(self._get(ruta, {"metric": ",".join(pedir)}))
        except ErrorInstagram as e:
            if e.token_invalido or e.limite:
                raise
        # Una métrica no admitida invalida toda la consulta; se prueba una por una
        obtenidas: dict[str, int] = {}
        falladas: list[str] = []
        for metrica in pedir:
            try:
                obtenidas.update(valores_de_insights(self._get(ruta, {"metric": metrica})))
            except ErrorInstagram as e:
                if e.token_invalido or e.limite:
                    raise
                falladas.append(metrica)
        if obtenidas:
            for metrica in falladas:
                cuenta = self._fallos.get((clave, metrica), 0) + 1
                self._fallos[(clave, metrica)] = cuenta
                if cuenta >= FALLOS_PARA_DESCARTAR_METRICA:
                    descartadas.add(metrica)
        return obtenidas

    # -- métricas de la cuenta -----------------------------------------
    def insights_cuenta_dia(self, dia: date) -> dict[str, int]:
        params = {
            "period": "day",
            "metric_type": "total_value",
            "since": inicio_dia_lima(dia),
            "until": inicio_dia_lima(dia + timedelta(days=1)),
        }
        ruta = f"{self.ig_user_id}/insights"
        try:
            return valores_de_insights(self._get(ruta, {**params, "metric": ",".join(METRICAS_CUENTA)}))
        except ErrorInstagram as e:
            if e.token_invalido or e.limite:
                raise
        obtenidas: dict[str, int] = {}
        for metrica in METRICAS_CUENTA:
            try:
                obtenidas.update(valores_de_insights(self._get(ruta, {**params, "metric": metrica})))
            except ErrorInstagram as e:
                if e.token_invalido or e.limite:
                    raise
        return obtenidas


# ---------------------------------------------------------------------------
# Sincronización
# ---------------------------------------------------------------------------

@dataclass
class ResultadoSync:
    publicaciones: int = 0
    nuevas: int = 0
    dias_cuenta: int = 0
    seguidores: int | None = None
    fallos: int = 0
    avisos: list[str] = field(default_factory=list)

    def como_dict(self) -> dict:
        return {
            "publicaciones": self.publicaciones,
            "nuevas": self.nuevas,
            "dias_cuenta": self.dias_cuenta,
            "seguidores": self.seguidores,
            "fallos": self.fallos,
            "avisos": self.avisos,
        }


def _una_fila(consulta) -> dict | None:
    datos = consulta.limit(1).execute().data
    return datos[0] if datos else None


def leer_credenciales(db) -> tuple[str, datetime | None] | None:
    fila = _una_fila(db.table("instagram_credenciales").select("access_token, updated_at").eq("id", 1))
    if not fila:
        return None
    return fila["access_token"], parsear_fecha_iso(fila.get("updated_at"))


def guardar_token(db, token: str, expira: datetime) -> None:
    ahora = datetime.now(timezone.utc).isoformat()
    db.table("instagram_credenciales").upsert({"id": 1, "access_token": token, "updated_at": ahora}, on_conflict="id").execute()
    db.table("instagram_conexion").upsert({"id": 1, "token_expira": expira.isoformat(), "updated_at": ahora}, on_conflict="id").execute()


def marcar_error(db, mensaje: str, desconectar: bool = False) -> None:
    cambios: dict[str, Any] = {"id": 1, "ultimo_error": mensaje[:300], "updated_at": datetime.now(timezone.utc).isoformat()}
    if desconectar:
        cambios["conectada"] = False
    db.table("instagram_conexion").upsert(cambios, on_conflict="id").execute()


def registrar_intento(db, ahora: datetime | None = None) -> None:
    db.table("instagram_conexion").upsert({"id": 1, "ultimo_intento": (ahora or datetime.now(timezone.utc)).isoformat()}, on_conflict="id").execute()


def conectar(db, token: str, usuario_id: str | None, transport: httpx.BaseTransport | None = None) -> dict:
    """Valida el token, lo guarda y deja la conexión activa."""
    token = token.strip()
    if not re.fullmatch(r"[A-Za-z0-9_\-.]{20,600}", token):
        raise ErrorInstagram("El token no tiene un formato válido. Cópialo completo desde el panel de Meta.")
    ahora = datetime.now(timezone.utc)
    cliente = ClienteInstagram(token, transport=transport)
    try:
        perfil = cliente.perfil()
        expira = ahora + timedelta(days=VIDA_TOKEN_DIAS)
        try:
            # Un token con más de 24 h se renueva y así se conoce su vencimiento real
            token, segundos = cliente.refrescar_token()
            expira = ahora + timedelta(seconds=segundos)
        except ErrorInstagram:
            pass  # un token recién generado todavía no se puede renovar y dura los 60 días completos
    finally:
        cliente.cerrar()

    previa = _una_fila(db.table("instagram_conexion").select("ig_user_id").eq("id", 1))
    cambia_cuenta = bool(previa and previa.get("ig_user_id") and previa["ig_user_id"] != perfil["ig_user_id"])
    guardar_token(db, token, expira)
    cambios: dict[str, Any] = {
        "id": 1,
        "ig_user_id": perfil["ig_user_id"],
        "usuario": perfil["usuario"],
        "conectada": True,
        "ultimo_error": None,
        "ultimo_intento": None,
        "conectada_por": usuario_id,
        "updated_at": ahora.isoformat(),
    }
    if cambia_cuenta or not previa or not previa.get("ig_user_id"):
        # Cuenta nueva: la próxima carga vuelve a traer el historial completo
        cambios["ultima_sincronizacion"] = None
        cambios["publicaciones_sincronizadas"] = 0
    db.table("instagram_conexion").upsert(cambios, on_conflict="id").execute()
    return {"usuario": perfil["usuario"], "seguidores": perfil["seguidores"], "token_expira": expira.isoformat(), "cuenta_nueva": cambia_cuenta}


def desconectar(db) -> None:
    db.table("instagram_credenciales").delete().eq("id", 1).execute()
    db.table("instagram_conexion").upsert({
        "id": 1, "conectada": False, "ig_user_id": None, "usuario": None, "token_expira": None,
        "ultimo_error": None, "ultimo_intento": None, "ultima_sincronizacion": None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }, on_conflict="id").execute()


def refrescar_si_corresponde(db, cliente: ClienteInstagram, ahora: datetime, actualizado: datetime | None, margen_dias: int = 20) -> bool:
    conexion = _una_fila(db.table("instagram_conexion").select("token_expira").eq("id", 1))
    expira = parsear_fecha_iso(conexion.get("token_expira")) if conexion else None
    por_vencer = not expira or expira - ahora <= timedelta(days=margen_dias)
    viejo = bool(actualizado) and ahora - actualizado >= timedelta(days=DIAS_PARA_RENOVAR_TOKEN)
    if not por_vencer and not viejo:
        return False
    try:
        nuevo, segundos = cliente.refrescar_token()
    except ErrorInstagram as e:
        if e.token_invalido:
            raise
        # El token debe tener al menos 24 h de vida; un fallo aquí no detiene la sincronización
        return False
    cliente.token = nuevo
    guardar_token(db, nuevo, ahora + timedelta(seconds=segundos))
    return True


def _en_bloques(lista: list, tamano: int = 50):
    for i in range(0, len(lista), tamano):
        yield lista[i:i + tamano]


def _guardar_publicaciones(db, medias: list[tuple[dict, dict[str, int]]], ahora: datetime) -> tuple[int, int]:
    """Devuelve cuántas publicaciones son nuevas y cuántas no se pudieron guardar."""
    if not medias:
        return 0, 0
    ids = [str(m["id"]) for m, _ in medias]
    codigos = [c for c in (codigo_de_enlace(m.get("permalink")) for m, _ in medias) if c]
    filas: list[dict] = []
    for bloque in _en_bloques(ids):
        filas += db.table("publicaciones").select("id, ig_media_id, codigo").in_("ig_media_id", bloque).execute().data or []
    for bloque in _en_bloques(codigos):
        filas += db.table("publicaciones").select("id, ig_media_id, codigo").in_("codigo", bloque).execute().data or []
    existentes: dict[str, dict] = {"id": {}, "codigo": {}}
    for f in filas:
        if f.get("ig_media_id"):
            existentes["id"][f["ig_media_id"]] = f
        if f.get("codigo"):
            existentes["codigo"][f["codigo"]] = f

    nuevas = fallos = 0
    marca = ahora.isoformat()
    for media, metricas in medias:
        fila = fila_publicacion(media, metricas)
        fila["metricas_actualizadas"] = marca
        previa = existentes["id"].get(fila["ig_media_id"]) or existentes["codigo"].get(fila.get("codigo"))
        try:
            if previa:
                # Lo escrito por el equipo (título, categoría, evento) no se pisa
                cambios = {k: v for k, v in fila.items() if k not in ("titulo", "descripcion")}
                cambios["estado"] = "publicada"
                db.table("publicaciones").update(cambios).eq("id", previa["id"]).execute()
            else:
                db.table("publicaciones").insert({**fila, "origen": "instagram", "estado": "publicada", "registrado_por": None}).execute()
                nuevas += 1
        except Exception:  # noqa: BLE001 - una publicación con problemas no debe detener a las demás
            registro.exception("No se pudo guardar la publicación %s", fila.get("ig_media_id"))
            fallos += 1
    return nuevas, fallos


def _dias_pendientes(db, hoy: date) -> list[date]:
    """Días recientes siempre, más cualquier día de los últimos 29 que no tenga datos."""
    desde = hoy - timedelta(days=DIAS_CUENTA_MAXIMO)
    guardados = db.table("instagram_diario").select("fecha, alcance").gte("fecha", desde.isoformat()).execute().data or []
    con_datos = {f["fecha"] for f in guardados if f.get("alcance") is not None}
    pendientes = []
    for i in range(DIAS_CUENTA_MAXIMO, 0, -1):
        dia = hoy - timedelta(days=i)
        if i <= DIAS_CUENTA_RECIENTES or dia.isoformat() not in con_datos:
            pendientes.append(dia)
    return pendientes


def _guardar_dias(db, dias: dict[date, dict[str, int]], seguidores: int | None, hoy: date) -> None:
    marca = datetime.now(timezone.utc).isoformat()
    # Una fila por llamada: una carga en bloque con columnas distintas dejaría en nulo lo que falte
    for dia, m in sorted(dias.items()):
        fila = {
            "fecha": dia.isoformat(),
            "alcance": m.get("reach"),
            "vistas": m.get("views"),
            "interacciones": m.get("total_interactions"),
            "updated_at": marca,
        }
        db.table("instagram_diario").upsert({k: v for k, v in fila.items() if v is not None}, on_conflict="fecha").execute()
    if seguidores is None:
        return
    fila = {"fecha": hoy.isoformat(), "seguidores": seguidores, "updated_at": marca}
    ayer = (hoy - timedelta(days=1)).isoformat()
    previo = db.table("instagram_diario").select("seguidores").eq("fecha", ayer).limit(1).execute().data
    if previo and previo[0].get("seguidores") is not None:
        fila["nuevos_seguidores"] = seguidores - previo[0]["seguidores"]
    db.table("instagram_diario").upsert(fila, on_conflict="fecha").execute()


def sincronizar(db, ahora: datetime | None = None, transport: httpx.BaseTransport | None = None) -> ResultadoSync:
    ahora = ahora or datetime.now(timezone.utc)
    hoy = ahora.astimezone(ZONA_LIMA).date()
    credenciales = leer_credenciales(db)
    conexion = _una_fila(db.table("instagram_conexion").select("*").eq("id", 1))
    if not credenciales or not conexion or not conexion.get("conectada") or not conexion.get("ig_user_id"):
        raise ErrorInstagram("Instagram no está conectado. Un SuperAdmin debe cargar el token desde Analítica de Marketing.")
    token, actualizado = credenciales

    registrar_intento(db, ahora)
    cliente = ClienteInstagram(token, conexion["ig_user_id"], transport=transport)
    resultado = ResultadoSync()
    try:
        refrescar_si_corresponde(db, cliente, ahora, actualizado)
        perfil = cliente.perfil()
        resultado.seguidores = perfil["seguidores"]

        primera_vez = not conexion.get("ultima_sincronizacion")
        desde = None if primera_vez else ahora - timedelta(days=DIAS_REFRESCO_METRICAS)
        maximo = MAXIMO_PRIMERA_CARGA if primera_vez else MAXIMO_POR_SINCRONIZACION
        listado = cliente.listar_media(desde, maximo)

        no_soportadas: dict[str, set[str]] = {}
        medias = [(m, cliente.insights_media(m, no_soportadas)) for m in listado]
        for clave, metricas in no_soportadas.items():
            if metricas:
                resultado.avisos.append(f"{clave}: sin {', '.join(sorted(metricas))}")
        resultado.publicaciones = len(medias)
        resultado.nuevas, resultado.fallos = _guardar_publicaciones(db, medias, ahora)
        if resultado.fallos:
            resultado.avisos.append(f"{resultado.fallos} publicaciones no se pudieron guardar")

        dias: dict[date, dict[str, int]] = {}
        for dia in _dias_pendientes(db, hoy):
            m = cliente.insights_cuenta_dia(dia)
            if m:
                dias[dia] = m
        resultado.dias_cuenta = len(dias)
        _guardar_dias(db, dias, perfil["seguidores"], hoy)

        db.table("instagram_conexion").upsert({
            "id": 1,
            "usuario": perfil["usuario"],
            "ultima_sincronizacion": ahora.isoformat(),
            "ultimo_error": f"{resultado.fallos} publicaciones no se pudieron guardar." if resultado.fallos else None,
            "publicaciones_sincronizadas": resultado.publicaciones,
            "updated_at": ahora.isoformat(),
        }, on_conflict="id").execute()
        return resultado
    except ErrorInstagram as e:
        marcar_error(db, str(e), desconectar=e.token_invalido)
        raise
    except Exception as e:  # noqa: BLE001
        registro.exception("Falló la sincronización de Instagram")
        mensaje = "Error interno al guardar los datos. Revisa los registros del servidor."
        marcar_error(db, mensaje)
        raise ErrorInstagram(mensaje) from None
    finally:
        cliente.cerrar()
