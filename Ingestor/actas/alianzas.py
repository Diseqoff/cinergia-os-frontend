"""Lector de documentos de alianzas (área de Relaciones Exteriores): convenios, cartas y propuestas."""
from __future__ import annotations

import re
from datetime import date

from .modelo import ActaLeida, ErrorActa, Hito
from .texto import (
    Documento, fechas_en, limpiar, norm, recortar, sin_datos_personales, sin_viñeta, titulo_seccion,
)

AREA = "Gestión de Oportunidades"
_NUM = re.compile(r"^\s*(?:\d{1,2}[.)]\s|\d+(?:\.\d+)+\s)")
_BUL = re.compile(r"^\s*[-•●▪]\s")
_FIN_BLOQUE = re.compile(r"^\s*(?:\d{1,2}[.)]\s*|[ivx]+\.\s*)?(cl[aá]usula|cierre\b|firmas\b)", re.IGNORECASE)
_COMPROMISO_PARTE = re.compile(r"^\s*por parte de\s+(.+?)[,]?\s+se compromete", re.IGNORECASE)
_PARTE_DE = re.compile(r"^\s*\d\.\d\s+de\s+(.+?):?\s*$", re.IGNORECASE)
_PARTE_NUM = re.compile(r"^\s*\d\.\d\.\d\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ .]+?)\.?\s*$")


def _tipo(doc: Documento) -> str:
    inicio = norm(" ".join(doc.lineas[:14]))
    if "carta de alianza" in inicio or "carta de alianza" in norm(" ".join(doc.lineas[:20])):
        return "carta"
    if re.search(r"\bconvenio de\b", inicio):
        return "convenio"
    return "propuesta"


def _nombre_aliado(doc: Documento, nombre_archivo: str, tipo: str) -> str:
    lineas = doc.lineas
    texto = " ".join(lineas)
    m = re.search(
        r"entre\s+CINERGIA(?:\s+UCSUR)?\s*(?:\([^)]*\))?\s*,?\s+(?:y|e)\s+(?:el\s+|la\s+)?(.+?)(?:\s*\([^)]*\))?\s*\.\s",
        texto, re.IGNORECASE)
    if tipo == "propuesta" and m and re.search(r"propuesta|alianza", norm(texto[max(0, m.start() - 140):m.start()])):
        return limpiar(m.group(1))
    if tipo == "propuesta" and "[" in " ".join(lineas[:3]):
        return "["
    for l in lineas[:6]:
        m = re.search(r"entre\s+cinergia(?:\s+ucsur)?\s+y\s+(.+)$", l, re.IGNORECASE)
        if m:
            return limpiar(m.group(1)).strip(" .")
    for l in lineas[:6]:
        m = re.match(r"^(.+?)\s*(?:&|\by\b)\s*CINERGIA(?:\s+UCSUR)?\s*$", l, re.IGNORECASE)
        if m:
            return limpiar(re.split(r"\s+[–—-]\s+", m.group(1))[0])
    m = re.search(r"entre\s+(.+?)\s+y\s+cinergia\b", " ".join(lineas[:16]), re.IGNORECASE)
    if m:
        return limpiar(m.group(1)).strip(" .").title() if m.group(1).isupper() else limpiar(m.group(1))
    for l in lineas[:6]:
        m = re.match(r"^([^,]+),\s*con RUC", l, re.IGNORECASE)
        if m:
            return limpiar(m.group(1))
    base = re.sub(r"\.[A-Za-z]+$", "", nombre_archivo)
    base = re.sub(r"(?i)alianza estrat[eé]gica|cinergia( ucsur)?|\(\d+\)|[-–_.]+", " ", base)
    base = re.sub(r"\s+y\s+|\s+x\s+", " ", base, flags=re.IGNORECASE)
    return limpiar(base)


def _fecha_documento(doc: Documento) -> date | None:
    lineas = doc.lineas
    for l in lineas[:6]:
        if re.match(r"\s*lima,\s*\d", l, re.IGNORECASE):
            f = fechas_en(l)
            if f:
                return f[0].fecha
    for l in reversed(lineas):
        if re.search(r"suscri", l, re.IGNORECASE):
            f = fechas_en(l)
            if f:
                return f[-1].fecha
    return None


def _vigente_hasta(doc: Documento) -> tuple[date | None, str | None]:
    lineas = doc.lineas
    for i, l in enumerate(lineas):
        t = norm(l + " " + (lineas[i + 1] if i + 1 < len(lineas) else ""))
        if "hasta el" in t and re.search(r"vigen|plazo|duracion", t):
            f = fechas_en(t.split("hasta el", 1)[1])
            if f:
                return f[0].fecha, None
        if re.search(r"vigente.*\bpor el plazo de un \(?1\)? ano|plazo de un \(1\) ano", t):
            return None, "Vigencia de un año, renovable automáticamente."
    return None, None


def _resumen(doc: Documento, tipo: str) -> str:
    lineas = doc.lineas
    if tipo == "carta":
        for i, l in enumerate(lineas):
            if "formalizar mediante esta carta" in norm(l):
                return recortar(" ".join(lineas[i:i + 5]), 600)
    for i, l in enumerate(lineas):
        t = norm(l)
        if re.match(r"^(clausula \w+:?\s*)?(del )?objeto\b", t) or re.match(r"^\d\.\d\.?\s*objeto\b", t) or re.match(r"^(\w+\.\s*)?clausula \w+:\s*del objeto", t) \
                or titulo_seccion(l).startswith("proposito de la alianza") or re.match(r"^[ivx]+\.\s*clausula \w+:\s*del objeto", t):
            partes = []
            for sig in lineas[i + 1:i + 8]:
                if _FIN_BLOQUE.match(sig) or sig.isupper():
                    break
                partes.append(sig)
            if partes:
                return recortar(" ".join(partes), 600)
    return ""


def _es_cinergia(parte: str) -> bool:
    t = norm(parte)
    return "cinergia" in t or t == "el aliado"


def _bloques(lineas: list[str]) -> list[tuple[str, list[str]]]:
    bloques: list[tuple[str, list[str]]] = []
    actual: tuple[str, list[str]] | None = None
    for l in lineas:
        parte = None
        for rx in (_COMPROMISO_PARTE, _PARTE_DE, _PARTE_NUM):
            m = rx.match(l)
            if m:
                parte = m.group(1).strip()
                break
        if parte:
            actual = (parte, [])
            bloques.append(actual)
            continue
        if actual is not None:
            if _FIN_BLOQUE.match(l) or (l.isupper() and len(l) < 60):
                actual = None
                continue
            actual[1].append(l)
    return bloques


def _items(lineas: list[str]) -> list[str]:
    hay_num = any(_NUM.match(l) for l in lineas)
    hay_marca = hay_num or any(_BUL.match(l) for l in lineas)
    items: list[str] = []
    for l in lineas:
        if _NUM.match(l) or (_BUL.match(l) and not hay_num):
            items.append(sin_viñeta(l))
        elif _BUL.match(l):
            if items:
                items[-1] += " " + sin_viñeta(l)
        elif hay_marca:
            if items and not items[-1].rstrip().endswith((".", ":")):
                items[-1] += " " + l
            elif len(l) >= 40:
                items.append(l)
        elif len(l) >= 30:
            items.append(l)
    return items


def _compromisos(doc: Documento, aliado: str) -> list[Hito]:
    hitos: list[Hito] = []
    vistos: set[str] = set()
    for parte, lineas in _bloques(doc.lineas):
        responsable = "Cinergia" if _es_cinergia(parte) else aliado
        for item in _items(lineas):
            texto = recortar(sin_datos_personales(item), 240)
            if len(texto) < 15 or norm(texto) in vistos:
                continue
            vistos.add(norm(texto))
            hitos.append(Hito(descripcion=texto, tipo="compromiso_aliado", responsable=responsable))
    return hitos[:40]


def leer(doc: Documento, nombre_archivo: str, hoy: date | None = None) -> ActaLeida:
    hoy = hoy or date.today()
    tipo = _tipo(doc)
    aliado = _nombre_aliado(doc, nombre_archivo, tipo)
    if not aliado or "[" in aliado or "nombre de la asociacion" in norm(aliado):
        raise ErrorActa("El archivo es el modelo de alianza sin completar. Falta el nombre de la organización aliada.")

    fecha = _fecha_documento(doc)
    hasta, nota_vigencia = _vigente_hasta(doc)
    resumen = _resumen(doc, tipo)
    if hasta:
        resumen = f"{resumen} Vigente hasta el {hasta.strftime('%d/%m/%Y')}.".strip()
    elif nota_vigencia:
        resumen = f"{resumen} {nota_vigencia}".strip()

    advertencias: list[str] = []
    if "[nombre de la" in norm(doc.texto):
        advertencias.append("El documento conserva texto de plantilla entre corchetes. Conviene corregirlo en el archivo original.")
    if tipo != "propuesta" and not fecha:
        advertencias.append("No se encontró la fecha de firma.")
    hitos = _compromisos(doc, aliado)
    if tipo != "carta" and not hitos:
        advertencias.append("No se identificaron compromisos por parte.")

    prefijo = {"convenio": "Convenio con", "carta": "Carta de alianza con", "propuesta": "Propuesta de alianza con"}[tipo]
    if tipo == "propuesta":
        estado = "Planificación Base"
    elif hasta and hasta < hoy:
        estado = "Finalizado"
    else:
        estado = "Ejecución Activa"
    return ActaLeida(
        area=AREA, tipo=tipo, nombre=f"{prefijo} {aliado}", responsable="Presidencia", responsables=[],
        fecha_programada=fecha, fecha_acta=fecha, resumen=resumen or None, hitos=hitos,
        vigente_hasta=hasta, estado_sugerido=estado, advertencias=advertencias,
    )
