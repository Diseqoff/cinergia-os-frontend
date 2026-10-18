"""Lector de actas de constitución de proyecto (área de Proyectos e Investigación)."""
from __future__ import annotations

import re
from datetime import date

from .modelo import ActaLeida, ErrorActa, Hito
from .texto import (
    Documento, dividir_secciones, es_vacio, fechas_en, limpiar, nombre_directo, norm, primera_fecha, recortar,
    sin_viñeta, valor_etiqueta,
)

CLAVES = {
    "justificacion": ("justificacion del proyecto", "justificacion"),
    "descripcion": ("descripcion del proyecto", "descripcion"),
    "entregables": ("entregables de alto nivel", "entregables"),
    "requisitos": ("requisitos de negocio",),
    "requerimientos": ("requerimientos de alto nivel", "requerimientos"),
    "riesgos": ("riesgos del proyecto", "riesgos"),
    "limites": ("limites del proyecto", "limites"),
    "objetivo": ("objetivo general del proyecto", "objetivo general"),
    "especificos": ("objetivos especificos del proyecto", "objetivos especificos"),
    "materiales": ("materiales",),
    "tiempo": ("tiempo",),
    "hitos": ("resumen de hitos",),
    "encargados": ("encargados del proyecto", "encargados"),
    "autoridad": ("nivel de autoridad", "decisiones sobre el personal", "decisiones tecnicas"),
    "aprobaciones": ("aprobaciones",),
}
_RUIDO_PDF = re.compile(r"^(acta de constitucion del proyecto|version\s*:.*|fecha edicion\s*:?|pag\.?\s*\d+\s*de\s*\d+|\d{1,2}-\d{1,2}-\d{4})$")
_FECHA = r"\d{1,2}[/-]\d{1,2}[/-]\d{4}"
_HITO = re.compile(
    rf"^\s*(fase\s*\d+\s*[:.\-–]\s*.+?)\s*\|?\s*"
    rf"((?:{_FECHA})(?:\s*[-–]\s*(?:{_FECHA}|actualidad))?|sujeto\b.*|por (?:definir|confirmar).*)\s*$",
    re.IGNORECASE,
)


def _es_guia(lineas: list[str]) -> bool:
    t = norm(" ".join(lineas[:200]))
    return "parrafo 1" in t or "por que el proyecto es necesario" in t


def _hitos(doc: Documento, hoy: date) -> list[Hito]:
    registros: list[str] = []
    for tipo, valor in doc.bloques:
        registros.append(valor if tipo == "p" else " | ".join(" ".join(c) for c in valor))
    hitos: list[Hito] = []
    en_curso_en: int | None = None
    for r in registros:
        m = _HITO.match(r)
        if not m:
            continue
        descripcion, cuando = limpiar(m.group(1)), norm(m.group(2))
        fechas = fechas_en(cuando)
        limite = fechas[-1].fecha if fechas else None
        if "actualidad" in cuando:
            en_curso_en = len(hitos)
            limite = None
        hitos.append(Hito(descripcion=descripcion, fecha_limite=limite))
    # Una fase marcada como "actualidad" implica que las anteriores ya terminaron.
    if en_curso_en is not None:
        for h in hitos[:en_curso_en]:
            if h.fecha_limite:
                h.completado, h.fecha_entrega = True, h.fecha_limite
    else:
        for h in hitos:
            if norm(h.descripcion).split(":", 1)[-1].strip().startswith("acta") and h.fecha_limite and h.fecha_limite <= hoy:
                h.completado, h.fecha_entrega = True, h.fecha_limite
    return hitos


def _metas_tabla(doc: Documento) -> list[dict]:
    bl = doc.bloques
    for i, (tipo, valor) in enumerate(bl):
        if tipo != "fila" or len(valor) < 2:
            continue
        cab = [norm(" ".join(c)) for c in valor]
        if cab[0].startswith("objetivos especificos") and cab[1].startswith("criterios"):
            metas = []
            for tj, vj in bl[i + 1:]:
                if tj != "fila" or len(vj) < 2:
                    break
                objetivo = " ".join(vj[0])
                criterio = "; ".join(sin_viñeta(p).rstrip(".") for p in vj[1])
                if objetivo and criterio:
                    metas.append({"metrica": limpiar(objetivo), "objetivo": limpiar(criterio)})
            return metas
    return []


def _metas_texto(lineas: list[str]) -> list[dict]:
    """Objetivos y criterios en un PDF: los criterios van con guion y los objetivos sin él."""
    metas: list[dict] = []
    obj: list[str] = []
    crit: list[str] = []

    def cerrar() -> None:
        if obj and crit:
            metas.append({"metrica": limpiar(" ".join(obj)), "objetivo": limpiar("; ".join(c.rstrip(".") for c in crit))})

    en_criterios = False
    for l in lineas:
        if re.match(r"\s*[-•●]\s+", l):
            en_criterios = True
            crit.append(sin_viñeta(l))
        elif en_criterios:
            if l[:1].isupper() and crit[-1].rstrip().endswith((".", ")")):
                cerrar()
                obj, crit, en_criterios = [l], [], False
            else:
                crit[-1] += " " + l
        else:
            obj.append(l)
    cerrar()
    return metas


def _items(lineas: list[str]) -> list[str]:
    """Elementos de una lista: numerados con líneas de continuación, o una línea por elemento."""
    if any(re.match(r"\s*\d{1,2}[.)]\s", l) for l in lineas):
        items: list[str] = []
        for l in lineas:
            if re.match(r"\s*\d{1,2}[.)]\s", l) or not items:
                items.append(sin_viñeta(l))
            else:
                items[-1] += " " + l
        return [limpiar(i) for i in items if i]
    return [limpiar(sin_viñeta(l)) for l in lineas if l]


def _lider(sec: dict) -> tuple[list[str], str | None]:
    nombres: list[str] = []
    lider = None
    for l in sec.get("encargados", []):
        n = nombre_directo(l)
        if not n or len(n) > 70 or re.search(r"\d", n):
            continue
        nombres.append(n)
        if re.search(r"\(\s*l[ií]der\s*\)", l, re.IGNORECASE):
            lider = n
    if not lider:
        aprob = sec.get("aprobaciones", [])
        for i, l in enumerate(aprob):
            if re.fullmatch(r"\(?\s*l[ií]der\s*\)?", l.strip(), re.IGNORECASE) and i > 0:
                lider = nombre_directo(aprob[i - 1])
            elif norm(l).startswith("lider del proyecto") and i > 0:
                lider = nombre_directo(aprob[i - 1])
            if lider:
                break
    if lider and lider not in nombres:
        nombres.insert(0, lider)
    return nombres, lider or (nombres[0] if nombres else None)


def leer(doc: Documento, nombre_archivo: str, hoy: date | None = None) -> ActaLeida:
    hoy = hoy or date.today()
    if _es_guia(doc.lineas):
        raise ErrorActa("El archivo es la guía o plantilla del acta de constitución. Sube el acta con el proyecto completado.")
    limpias = [l for l in doc.lineas if not _RUIDO_PDF.match(norm(l))] if doc.formato == "pdf" else doc.lineas
    sec = dividir_secciones(limpias, CLAVES, numerados_desconocidos=False)
    advertencias: list[str] = []

    nombre = valor_etiqueta(doc.lineas, "titulo proyecto", "titulo del proyecto", siguiente=False)
    if not nombre or es_vacio(nombre):
        raise ErrorActa("No se encontró el título del proyecto. Debe estar en el campo Título Proyecto.")

    elaboracion = valor_etiqueta(doc.lineas, "fecha edicion", "fecha de elaboracion")
    f = primera_fecha(elaboracion) if elaboracion else None
    fecha_acta = f.fecha if f else None

    hitos = _hitos(doc, hoy)
    nombres, responsable = _lider(sec)

    desde = next((m for l in sec.get("tiempo", []) if (m := re.search(r"desde el\s+(" + _FECHA + ")", norm(l)))), None)
    fecha_inicio = fechas_en(desde.group(1))[0].fecha if desde else None
    fechas_hitos = [h.fecha_limite for h in hitos if h.fecha_limite]
    fecha_programada = fecha_inicio or (min(fechas_hitos) if fechas_hitos else None)

    metas = _metas_tabla(doc) or _metas_texto(sec.get("especificos", [])[1:] if sec.get("especificos") and norm(sec["especificos"][0]).startswith("criterios") else sec.get("especificos", []))
    riesgos = [{"riesgo": r, "mitigacion": ""} for r in _items(sec.get("riesgos", []))]
    descripcion = limpiar(" ".join(sec.get("descripcion", [])[:3]))
    objetivo = limpiar(" ".join(sec.get("objetivo", [])))

    if not hitos:
        advertencias.append("El acta no trae el Resumen de Hitos; el proyecto queda sin cronograma.")
    if not responsable:
        advertencias.append("El acta no lista encargados del proyecto.")
    pendientes = sum(1 for h in hitos if not h.fecha_limite and not h.completado)
    if pendientes:
        advertencias.append(f"{pendientes} fase(s) sin fecha de cumplimiento confirmada.")

    en_curso = any("actualidad" in norm(" ".join(c)) for t, v in doc.bloques if t == "fila" for c in v) or any(
        "actualidad" in norm(l) for l in doc.lineas if _HITO.match(l))
    return ActaLeida(
        area="Proyectos", tipo="proyecto", nombre=limpiar(nombre), responsable=responsable, responsables=nombres,
        fecha_programada=fecha_programada, fecha_acta=fecha_acta, fecha_texto=desde.group(1) if desde else None,
        resumen=recortar(descripcion, 700) or None, objetivo_general=recortar(objetivo, 500) or None,
        metas=metas, riesgos=riesgos, hitos=hitos, advertencias=advertencias,
        faltantes=[] if responsable else ["Responsable"],
        estado_sugerido="Ejecución Activa" if en_curso else "Planificación Base",
    )
