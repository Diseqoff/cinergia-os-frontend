"""Pruebas de la integración con Instagram usando una API y una base simuladas."""

import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import instagram as ig  # noqa: E402

TOKEN = "IGAAtokenDePruebaMuyLargoQueNoDebeFiltrarse1234567890"
AHORA = datetime(2026, 10, 18, 15, 0, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# Base simulada con la parte de la interfaz de supabase-py que usa el módulo
# ---------------------------------------------------------------------------
class _Not:
    def __init__(self, q):
        self.q = q

    def is_(self, col, val):
        self.q.filtros.append(lambda f: f.get(col) is not None)
        return self.q


class Consulta:
    def __init__(self, db, tabla):
        self.db, self.tabla = db, tabla
        self.filtros, self.accion, self.carga, self.conflicto = [], "select", None, None
        self.orden, self.tope, self.contar = None, None, False

    # filtros
    def eq(self, c, v): self.filtros.append(lambda f: f.get(c) == v); return self
    def in_(self, c, vs): self.filtros.append(lambda f: f.get(c) in vs); return self
    def lt(self, c, v): self.filtros.append(lambda f: f.get(c) is not None and str(f[c]) < str(v)); return self
    def gte(self, c, v): self.filtros.append(lambda f: f.get(c) is not None and str(f[c]) >= str(v)); return self
    @property
    def not_(self): return _Not(self)
    def order(self, c, desc=False): self.orden = (c, desc); return self
    def limit(self, n): self.tope = n; return self

    def select(self, cols="*", count=None):
        self.accion, self.contar = "select", count == "exact"
        return self

    def insert(self, fila): self.accion, self.carga = "insert", fila; return self
    def update(self, cambios): self.accion, self.carga = "update", cambios; return self
    def delete(self): self.accion = "delete"; return self

    def upsert(self, filas, on_conflict=None):
        self.accion, self.carga, self.conflicto = "upsert", filas, on_conflict
        return self

    def execute(self):
        filas = self.db.tablas.setdefault(self.tabla, [])
        coincide = lambda f: all(fl(f) for fl in self.filtros)  # noqa: E731
        if self.accion == "select":
            sel = [dict(f) for f in filas if coincide(f)]
            if self.orden:
                sel.sort(key=lambda f: str(f.get(self.orden[0])), reverse=self.orden[1])
            total = len(sel)
            if self.tope:
                sel = sel[: self.tope]
            return SimpleNamespace(data=sel, count=total if self.contar else None)
        if self.accion == "insert":
            nueva = dict(self.carga)
            nueva.setdefault("id", f"{self.tabla}-{len(filas) + 1}")
            for unica in self.db.unicas.get(self.tabla, []):
                if nueva.get(unica) is not None and any(f.get(unica) == nueva[unica] for f in filas):
                    raise RuntimeError(f"duplicado en {unica}")
            filas.append(nueva)
        elif self.accion == "update":
            for f in filas:
                if coincide(f):
                    f.update(self.carga)
        elif self.accion == "delete":
            self.db.tablas[self.tabla] = [f for f in filas if not coincide(f)]
        elif self.accion == "upsert":
            for nueva in (self.carga if isinstance(self.carga, list) else [self.carga]):
                previa = next((f for f in filas if f.get(self.conflicto) == nueva.get(self.conflicto)), None)
                if previa:
                    previa.update(nueva)
                else:
                    filas.append(dict(nueva))
        return SimpleNamespace(data=[], count=None)


class BaseFalsa:
    unicas = {"publicaciones": ["ig_media_id", "codigo"]}

    def __init__(self):
        self.tablas = {}

    def table(self, nombre):
        return Consulta(self, nombre)


# ---------------------------------------------------------------------------
# API de Instagram simulada
# ---------------------------------------------------------------------------
class ApiFalsa:
    def __init__(self):
        self.llamadas = []
        self.medias = []
        self.insights_media = {}
        self.metricas_no_soportadas = {}
        self.seguidores = 1000
        self.error_global = None
        self.cuenta = {"reach": 300, "views": 900, "total_interactions": 45}
        self.refresco_falla = False
        self.publicaciones_rotas = set()

    def __call__(self, request: httpx.Request) -> httpx.Response:
        url = request.url
        ruta = url.path
        q = dict(url.params)
        self.llamadas.append((ruta, q))
        if self.error_global:
            return httpx.Response(400, json={"error": self.error_global})
        if q.get("access_token") not in (TOKEN, TOKEN + "N") and "refresh" not in ruta:
            return httpx.Response(401, json={"error": {"message": "Invalid", "code": 190}})
        if ruta.endswith("/me"):
            return httpx.Response(200, json={"user_id": "1784", "username": "cinergia", "followers_count": self.seguidores, "media_count": len(self.medias)})
        if ruta.endswith("/refresh_access_token"):
            if self.refresco_falla:
                return httpx.Response(400, json={"error": {"message": "token demasiado nuevo", "code": 10}})
            return httpx.Response(200, json={"access_token": TOKEN + "N", "token_type": "bearer", "expires_in": 5184000})
        if ruta.endswith("/1784/media"):
            if "caption" in q.get("fields", "") and getattr(self, "sin_caption", False):
                return httpx.Response(400, json={"error": {"message": "Field caption not supported", "code": 100}})
            return httpx.Response(200, json={"data": self.medias})
        if ruta.endswith("/1784/insights"):
            pedidas = q["metric"].split(",")
            return httpx.Response(200, json={"data": [
                {"name": m, "period": "day", "total_value": {"value": self.cuenta[m]}} for m in pedidas if m in self.cuenta]})
        if ruta.endswith("/insights"):
            media_id = ruta.split("/")[-2]
            if media_id in self.publicaciones_rotas:
                return httpx.Response(400, json={"error": {"message": "media no disponible", "code": 1}})
            pedidas = q["metric"].split(",")
            malas = [m for m in pedidas if m in self.metricas_no_soportadas.get(media_id, set())]
            if malas:
                return httpx.Response(400, json={"error": {"message": f"metric {malas[0]} not supported", "code": 100}})
            datos = self.insights_media.get(media_id, {})
            return httpx.Response(200, json={"data": [
                {"name": m, "period": "lifetime", "values": [{"value": datos[m]}]} for m in pedidas if m in datos]})
        return httpx.Response(404, json={"error": {"message": "no existe", "code": 803}})


def media(i, tipo="IMAGE", producto="FEED", dias_atras=1, caption="Convocatoria Talks\nMás texto"):
    cuando = AHORA - timedelta(days=dias_atras)
    return {"id": str(i), "caption": caption, "media_type": tipo, "media_product_type": producto,
            "permalink": f"https://www.instagram.com/p/COD{i}/", "timestamp": cuando.strftime("%Y-%m-%dT%H:%M:%S+0000")}


@pytest.fixture
def entorno():
    db = BaseFalsa()
    db.tablas["instagram_credenciales"] = [{"id": 1, "access_token": TOKEN}]
    db.tablas["instagram_conexion"] = [{"id": 1, "conectada": True, "ig_user_id": "1784",
                                          "token_expira": (AHORA + timedelta(days=50)).isoformat()}]
    api = ApiFalsa()
    return db, api


# ---------------------------------------------------------------------------
# Funciones puras
# ---------------------------------------------------------------------------
def test_codigo_de_enlace():
    assert ig.codigo_de_enlace("https://www.instagram.com/reel/AbC_1-x/?igsh=1") == "AbC_1-x"
    assert ig.codigo_de_enlace("https://instagram.com/p/XYZ/") == "XYZ"
    assert ig.codigo_de_enlace("https://example.com") is None
    assert ig.codigo_de_enlace(None) is None


def test_formato():
    assert ig.formato_de_media("VIDEO", "REELS") == "reel"
    assert ig.formato_de_media("CAROUSEL_ALBUM", "FEED") == "carrusel"
    assert ig.formato_de_media("IMAGE", "FEED") == "imagen"
    assert ig.formato_de_media("VIDEO", "FEED") == "video"
    assert ig.formato_de_media(None, None) is None


def test_titulo_y_fecha():
    assert ig.titulo_de_caption("\n  Hola mundo  \nsegunda") == "Hola mundo"
    assert len(ig.titulo_de_caption("x" * 200)) == 80
    assert ig.titulo_de_caption("   ") is None
    d = ig.parsear_fecha_iso("2026-10-01T15:04:05+0000")
    assert d == datetime(2026, 10, 1, 15, 4, 5, tzinfo=timezone.utc)
    assert ig.parsear_fecha_iso("basura") is None


def test_valores_de_insights_ignora_vacios():
    r = {"data": [{"name": "reach", "values": [{"value": 12}]}, {"name": "views", "total_value": {"value": 7}},
                  {"name": "likes", "values": []}, {"name": "saved", "values": [{"value": None}]}]}
    assert ig.valores_de_insights(r) == {"reach": 12, "views": 7}
    assert ig.valores_de_insights({}) == {}


def test_limpiar_secreto():
    t = f"Fallo en https://graph.instagram.com/x?access_token={TOKEN}&a=1 con {TOKEN}"
    out = ig.limpiar_secreto(t, TOKEN)
    assert TOKEN not in out and "access_token=***" in out


# ---------------------------------------------------------------------------
# Conexión
# ---------------------------------------------------------------------------
def test_conectar_guarda_token_y_estado():
    db = BaseFalsa()
    api = ApiFalsa()
    r = ig.conectar(db, TOKEN, "u1", transport=httpx.MockTransport(api))
    assert r["usuario"] == "cinergia" and r["seguidores"] == 1000
    # El token se renueva al conectar para conocer su vencimiento real
    assert db.tablas["instagram_credenciales"][0]["access_token"] == TOKEN + "N"
    con = db.tablas["instagram_conexion"][0]
    assert con["conectada"] is True and con["ig_user_id"] == "1784" and con["conectada_por"] == "u1"
    assert con["ultima_sincronizacion"] is None and con["publicaciones_sincronizadas"] == 0
    assert TOKEN not in json.dumps(con)


def test_conectar_token_recien_generado_conserva_el_token():
    db = BaseFalsa()
    api = ApiFalsa()
    api.refresco_falla = True
    ig.conectar(db, TOKEN, None, transport=httpx.MockTransport(api))
    assert db.tablas["instagram_credenciales"][0]["access_token"] == TOKEN
    vence = ig.parsear_fecha_iso(db.tablas["instagram_conexion"][0]["token_expira"])
    assert timedelta(days=59) < vence - datetime.now(timezone.utc) <= timedelta(days=60)


def test_cambiar_de_cuenta_reinicia_el_historial():
    db = BaseFalsa()
    db.tablas["instagram_conexion"] = [{"id": 1, "ig_user_id": "999", "ultima_sincronizacion": "2026-10-01T00:00:00+00:00", "publicaciones_sincronizadas": 40}]
    r = ig.conectar(db, TOKEN, None, transport=httpx.MockTransport(ApiFalsa()))
    assert r["cuenta_nueva"] is True
    con = db.tablas["instagram_conexion"][0]
    assert con["ultima_sincronizacion"] is None and con["publicaciones_sincronizadas"] == 0


def test_reconectar_la_misma_cuenta_conserva_el_historial():
    db = BaseFalsa()
    db.tablas["instagram_conexion"] = [{"id": 1, "ig_user_id": "1784", "ultima_sincronizacion": "2026-10-01T00:00:00+00:00", "publicaciones_sincronizadas": 40}]
    r = ig.conectar(db, TOKEN, None, transport=httpx.MockTransport(ApiFalsa()))
    assert r["cuenta_nueva"] is False
    assert db.tablas["instagram_conexion"][0]["ultima_sincronizacion"] == "2026-10-01T00:00:00+00:00"


def test_conectar_rechaza_token_con_formato_malo():
    with pytest.raises(ig.ErrorInstagram):
        ig.conectar(BaseFalsa(), "corto", None)
    with pytest.raises(ig.ErrorInstagram):
        ig.conectar(BaseFalsa(), "con espacios " * 5, None)


def test_conectar_token_invalido_no_guarda():
    db = BaseFalsa()
    api = ApiFalsa()
    api.error_global = {"message": "Invalid OAuth access token", "code": 190}
    with pytest.raises(ig.ErrorInstagram) as e:
        ig.conectar(db, TOKEN, None, transport=httpx.MockTransport(api))
    assert e.value.token_invalido and TOKEN not in str(e.value)
    assert not db.tablas.get("instagram_credenciales")


def test_desconectar_borra_token():
    db = BaseFalsa()
    ig.conectar(db, TOKEN, "u1", transport=httpx.MockTransport(ApiFalsa()))
    ig.desconectar(db)
    assert db.tablas["instagram_credenciales"] == []
    assert db.tablas["instagram_conexion"][0]["conectada"] is False
    assert db.tablas["instagram_conexion"][0]["ultima_sincronizacion"] is None


# ---------------------------------------------------------------------------
# Sincronización
# ---------------------------------------------------------------------------
def test_sincronizar_primera_vez(entorno):
    db, api = entorno
    api.medias = [media(1, "VIDEO", "REELS"), media(2, "CAROUSEL_ALBUM", dias_atras=200)]
    api.insights_media = {
        "1": {"reach": 800, "likes": 40, "comments": 5, "shares": 7, "saved": 3, "total_interactions": 55, "views": 1500},
        "2": {"reach": 100, "likes": 10, "comments": 1, "shares": 0, "saved": 1},
    }
    r = ig.sincronizar(db, AHORA, transport=httpx.MockTransport(api))
    assert r.publicaciones == 2 and r.nuevas == 2 and r.seguidores == 1000
    pubs = {p["ig_media_id"]: p for p in db.tablas["publicaciones"]}
    assert pubs["1"]["formato"] == "reel" and pubs["1"]["alcance"] == 800 and pubs["1"]["vistas"] == 1500
    assert pubs["1"]["interacciones"] == 55 and pubs["1"]["titulo"] == "Convocatoria Talks"
    assert pubs["2"]["interacciones"] == 12  # suma cuando la API no la entrega
    assert pubs["2"]["origen"] == "instagram" and pubs["2"]["estado"] == "publicada"
    # primera vez: los 29 días anteriores
    assert r.dias_cuenta == 29
    diario = {d["fecha"]: d for d in db.tablas["instagram_diario"]}
    assert diario["2026-10-17"]["alcance"] == 300
    assert diario["2026-10-18"]["seguidores"] == 1000
    con = db.tablas["instagram_conexion"][0]
    assert con["ultima_sincronizacion"] and con["ultimo_error"] is None and con["publicaciones_sincronizadas"] == 2


def test_la_sincronizacion_no_toca_las_metricas_manuales(entorno):
    db, api = entorno
    db.tablas["metricas_marketing"] = [{"periodo": "2026-10-01", "seguidores": 900, "alcance": 50000, "menciones_medios": 3}]
    ig.sincronizar(db, AHORA, transport=httpx.MockTransport(api))
    assert db.tablas["metricas_marketing"] == [{"periodo": "2026-10-01", "seguidores": 900, "alcance": 50000, "menciones_medios": 3}]


def test_dias_perdidos_se_recuperan(entorno):
    db, api = entorno
    ig.sincronizar(db, AHORA, transport=httpx.MockTransport(api))
    # el cron falló varios días: el 18 y el 19 de octubre no tienen datos de cuenta
    r = ig.sincronizar(db, AHORA + timedelta(days=5), transport=httpx.MockTransport(api))
    assert r.dias_cuenta == 5
    fechas = {d["fecha"] for d in db.tablas["instagram_diario"] if d.get("alcance") is not None}
    assert {"2026-10-18", "2026-10-19", "2026-10-22"} <= fechas


def test_fusion_con_publicacion_manual_conserva_datos_del_equipo(entorno):
    db, api = entorno
    db.tablas["publicaciones"] = [{
        "id": "m1", "origen": "manual", "estado": "publicada", "codigo": "COD1", "ig_media_id": None,
        "titulo": "Título del equipo", "categoria": "evento", "proyecto_id": "PRJ-1"}]
    api.medias = [media(1)]
    api.insights_media = {"1": {"reach": 50, "likes": 5}}
    r = ig.sincronizar(db, AHORA, transport=httpx.MockTransport(api))
    assert r.nuevas == 0 and len(db.tablas["publicaciones"]) == 1
    p = db.tablas["publicaciones"][0]
    assert p["ig_media_id"] == "1" and p["alcance"] == 50
    assert p["titulo"] == "Título del equipo" and p["categoria"] == "evento" and p["proyecto_id"] == "PRJ-1"
    assert p["origen"] == "manual"


def test_segunda_sincronizacion_actualiza_sin_duplicar(entorno):
    db, api = entorno
    api.medias = [media(1)]
    api.insights_media = {"1": {"reach": 50}}
    ig.sincronizar(db, AHORA, transport=httpx.MockTransport(api))
    api.insights_media = {"1": {"reach": 80}}
    r = ig.sincronizar(db, AHORA + timedelta(days=1), transport=httpx.MockTransport(api))
    assert r.nuevas == 0 and len(db.tablas["publicaciones"]) == 1
    assert db.tablas["publicaciones"][0]["alcance"] == 80
    assert r.dias_cuenta == 3  # ya no es la primera vez


def test_nuevos_seguidores_respecto_al_dia_anterior(entorno):
    db, api = entorno
    ig.sincronizar(db, AHORA, transport=httpx.MockTransport(api))
    api.seguidores = 1012
    ig.sincronizar(db, AHORA + timedelta(days=1), transport=httpx.MockTransport(api))
    diario = {d["fecha"]: d for d in db.tablas["instagram_diario"]}
    assert diario["2026-10-19"]["seguidores"] == 1012
    assert diario["2026-10-19"]["nuevos_seguidores"] == 12


def test_metrica_que_falla_en_varias_publicaciones_se_deja_de_pedir(entorno):
    db, api = entorno
    api.medias = [media(1), media(2), media(3)]
    api.insights_media = {"1": {"reach": 10, "likes": 2}, "2": {"reach": 20, "likes": 4}, "3": {"reach": 30, "likes": 6}}
    api.metricas_no_soportadas = {"1": {"views"}, "2": {"views"}, "3": {"views"}}
    r = ig.sincronizar(db, AHORA, transport=httpx.MockTransport(api))
    pubs = {p["ig_media_id"]: p for p in db.tablas["publicaciones"]}
    assert pubs["1"]["alcance"] == 10 and "vistas" not in pubs["1"]
    assert pubs["3"]["alcance"] == 30
    # tras dos fallos ya no se pide "views" para el mismo tipo de contenido
    pedidas_3 = [q["metric"] for ruta, q in api.llamadas if ruta.endswith("/3/insights")]
    assert len(pedidas_3) == 1 and "views" not in pedidas_3[0]
    assert any("views" in a for a in r.avisos)


def test_una_publicacion_rota_no_apaga_las_cifras_de_las_demas(entorno):
    db, api = entorno
    api.medias = [media(1), media(2), media(3)]
    api.insights_media = {"1": {"reach": 10}, "2": {"reach": 20}, "3": {"reach": 30}}
    api.publicaciones_rotas = {"1"}
    r = ig.sincronizar(db, AHORA, transport=httpx.MockTransport(api))
    pubs = {p["ig_media_id"]: p for p in db.tablas["publicaciones"]}
    assert "alcance" not in pubs["1"]
    assert pubs["2"]["alcance"] == 20 and pubs["3"]["alcance"] == 30
    assert r.avisos == []


def test_una_publicacion_que_no_se_guarda_no_detiene_a_las_demas(entorno):
    db, api = entorno
    # dos publicaciones con el mismo enlace chocan en la restricción de código único
    api.medias = [media(1), {**media(2), "permalink": "https://www.instagram.com/p/COD1/"}, media(3)]
    api.insights_media = {"1": {"reach": 10}, "2": {"reach": 20}, "3": {"reach": 30}}
    r = ig.sincronizar(db, AHORA, transport=httpx.MockTransport(api))
    assert r.fallos == 1 and r.nuevas == 2
    assert {p["ig_media_id"] for p in db.tablas["publicaciones"]} == {"1", "3"}
    assert db.tablas["instagram_conexion"][0]["ultima_sincronizacion"]
    assert "1 publicaciones" in db.tablas["instagram_conexion"][0]["ultimo_error"]


def test_error_inesperado_queda_registrado_sin_detalles_internos(entorno):
    db, api = entorno

    class BaseRota(BaseFalsa):
        def table(self, nombre):
            if nombre == "instagram_diario":
                raise RuntimeError("detalle interno secreto de la base")
            return super().table(nombre)

    rota = BaseRota()
    rota.tablas = db.tablas
    with pytest.raises(ig.ErrorInstagram) as e:
        ig.sincronizar(rota, AHORA, transport=httpx.MockTransport(api))
    assert "secreto" not in str(e.value)
    con = rota.tablas["instagram_conexion"][0]
    assert con["ultimo_error"] and "secreto" not in con["ultimo_error"]
    assert con["conectada"] is True


def test_listado_sin_caption_reintenta_con_campos_minimos(entorno):
    db, api = entorno
    api.sin_caption = True
    api.medias = [{"id": "1", "media_type": "IMAGE", "permalink": "https://www.instagram.com/p/COD1/",
                   "timestamp": (AHORA - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%S+0000")}]
    api.insights_media = {"1": {"reach": 5}}
    r = ig.sincronizar(db, AHORA, transport=httpx.MockTransport(api))
    assert r.publicaciones == 1 and "titulo" not in db.tablas["publicaciones"][0]


def test_token_invalido_desconecta_y_no_filtra_el_token(entorno):
    db, api = entorno
    api.error_global = {"message": f"Invalid access_token={TOKEN}", "code": 190}
    with pytest.raises(ig.ErrorInstagram) as e:
        ig.sincronizar(db, AHORA, transport=httpx.MockTransport(api))
    assert e.value.token_invalido
    con = db.tablas["instagram_conexion"][0]
    assert con["conectada"] is False and TOKEN not in json.dumps(con)


def test_limite_de_consultas_no_desconecta(entorno):
    db, api = entorno
    api.error_global = {"message": "rate limit", "code": 4}
    with pytest.raises(ig.ErrorInstagram) as e:
        ig.sincronizar(db, AHORA, transport=httpx.MockTransport(api))
    assert e.value.limite
    con = db.tablas["instagram_conexion"][0]
    assert con["conectada"] is True and con["ultimo_error"]


def test_sincronizar_sin_conexion_falla_con_mensaje():
    with pytest.raises(ig.ErrorInstagram) as e:
        ig.sincronizar(BaseFalsa(), AHORA)
    assert "no está conectado" in str(e.value)


def test_refresco_de_token_cerca_del_vencimiento(entorno):
    db, api = entorno
    db.tablas["instagram_conexion"][0]["token_expira"] = (AHORA + timedelta(days=5)).isoformat()
    ig.sincronizar(db, AHORA, transport=httpx.MockTransport(api))
    assert db.tablas["instagram_credenciales"][0]["access_token"] == TOKEN + "N"
    nueva = ig.parsear_fecha_iso(db.tablas["instagram_conexion"][0]["token_expira"])
    assert nueva > AHORA + timedelta(days=59)


def test_refresco_si_el_token_tiene_mas_de_30_dias_aunque_el_vencimiento_este_mal_anotado(entorno):
    db, api = entorno
    db.tablas["instagram_credenciales"][0]["updated_at"] = (AHORA - timedelta(days=40)).isoformat()
    ig.sincronizar(db, AHORA, transport=httpx.MockTransport(api))
    assert db.tablas["instagram_credenciales"][0]["access_token"] == TOKEN + "N"


def test_sin_refresco_si_falta_mucho(entorno):
    db, api = entorno
    ig.sincronizar(db, AHORA, transport=httpx.MockTransport(api))
    assert not any(ruta.endswith("refresh_access_token") for ruta, _ in api.llamadas)
    assert db.tablas["instagram_credenciales"][0]["access_token"] == TOKEN


def test_cada_sincronizacion_registra_el_intento(entorno):
    db, api = entorno
    ig.sincronizar(db, AHORA, transport=httpx.MockTransport(api))
    assert db.tablas["instagram_conexion"][0]["ultimo_intento"] == AHORA.isoformat()
