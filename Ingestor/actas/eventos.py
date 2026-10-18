"""Lector de actas de Eventos.

Las actas de evento llegan en varios formatos (acta numerada, ficha de evento, registro de
participación, PDF con campos). El lector busca cada dato por su nombre y no por su posición.
"""
from __future__ import annotations

import re
from datetime import date, timedelta

from .modelo import ActaLeida, ErrorActa, Hito
from .texto import (
    Documento, bloque_etiqueta, dividir_secciones, entero_de, es_vacio, limpiar, nombre_persona,
    norm, primera_fecha, recortar, sin_viñeta, titulo_seccion, valor_etiqueta,
)

CLAVES = {
    "ficha": ("ficha de evento",),
    "titulo": ("titulo del evento",),
    "organizacion": ("organizacion responsable",),
    "entrega": ("fecha de entrega del acta",),
    "resumen": ("resumen ejecutivo del evento", "resumen ejecutivo", "resumen del evento"),
    "antecedentes": ("antecedentes",),
    "info": ("informacion general del evento", "informacion general"),
    "objetivos": ("objetivos del evento", "objetivos de gestion", "objetivos$"),
    "cronograma": ("cronograma", "agenda"),
    "roles": ("ponentes", "descripcion de roles", "equipo y roles"),
    "recursos": ("recursos y logistica", "logistica y recursos"),
    "difusion": ("plan de difusion", "comunicacion y difusion"),
    "metricas": ("metricas de exito", "metricas de desempeno", "metricas y evaluacion", "metricas"),
    "riesgos": ("riesgos y plan de contingencia", "riesgos y contingencias", "riesgos"),
    "presupuesto": ("presupuesto",),
    "observaciones": ("observaciones",),
    "validacion": ("validacion y cierre",),
    "seguimiento": ("seguimiento post-evento", "seguimiento post evento"),
}

_PLANTILLA = (
    "sintesis general del evento", "contexto que origina el evento", "proposito principal del evento",
    "descripcion:", "metas concretas y medibles", "nombre oficial del evento", "codigo unico",
)
_MARKETING = re.compile(
    r"banner|flyer|afiche|stories|historias|publicaci|recap|redes|reel|video|audiovisual|cobertura|"
    r"linkedin|instagram|post\b|pieza|infograf|teaser|fotograf", re.IGNORECASE)
_ETAPAS = (
    ("pre", ("pre-evento", "pre evento", "antes del evento")),
    ("durante", ("durante el evento", "durante evento")),
    ("post", ("post-evento", "post evento", "despues del evento")),
)


def _es_plantilla(texto: str) -> bool:
    t = norm(texto)
    return any(t.startswith(p) or p in t[:60] for p in _PLANTILLA)


def _comillas(linea: str) -> str | None:
    m = re.fullmatch(r"\s*[“\"«](.+?)[”\"»]\s*", linea)
    return limpiar(m.group(1)) if m else None


def _nombre_archivo_serie(nombre_archivo: str) -> str | None:
    """"EVT-2026-009-CINERGIA TALKS N°02.docx" da "Cinergia Talks N°02" cuando el nombre trae un número de edición."""
    base = re.sub(r"\.[A-Za-z]+$", "", nombre_archivo)
    base = re.sub(r"EVT[-\s]?\d{4}[-\s]?\d{3}[-\s]*", "", base, flags=re.IGNORECASE)
    m = re.search(r"([A-Za-zÁÉÍÓÚÑáéíóúñ ]+?)\s*N\s*[°º]\s*0*(\d+)", base)
    if not m:
        return None
    palabras = []
    for p in m.group(1).split():
        palabras.append(p if p.upper() in ("CINERGIA", "UCSUR") or not p.isupper() else p.capitalize())
    return f"{' '.join(palabras)} N°{int(m.group(2)):02d}"


def _titulo(doc: Documento, sec: dict, nombre_archivo: str) -> tuple[str, bool]:
    lineas = doc.lineas
    cabecera = lineas[0] if lineas else ""
    sufijo = ""
    if re.match(r"\s*(acta|ficha) de evento", norm(cabecera)) and re.search(r"[–—-]", cabecera):
        sufijo = limpiar(re.split(r"\s*[–—-]\s*", cabecera, maxsplit=1)[1])
        if norm(sufijo) in ("cinergia", "") or len(sufijo) > 40:
            sufijo = ""
    candidato, citado = "", False
    for linea in sec.get("titulo", [])[:3]:
        v = linea.partition(":")[2].strip() if re.match(r"\s*nombre", norm(linea)) and ":" in linea else linea
        if v and not _es_plantilla(v):
            candidato = v
            break
    if not candidato:
        candidato = valor_etiqueta(lineas, "nombre del evento", "nombre oficial", siguiente=False)
    if not candidato:
        for linea in lineas[:8]:
            c = _comillas(linea)
            if c:
                candidato = linea
                break
    if not candidato and len(lineas) > 1 and re.match(r"\s*(acta|ficha) de evento", norm(lineas[0])) and not re.search(r"[–—-]", lineas[0]):
        candidato = lineas[1]
    if not candidato:
        candidato = valor_etiqueta(lineas, "evento", siguiente=False)
    if not candidato and sufijo:
        candidato = sufijo.capitalize() if sufijo.isupper() else sufijo
    if not candidato:
        return "", False
    c = _comillas(candidato)
    if c:
        citado, candidato = True, c
    candidato = limpiar(candidato).strip(" .")
    if citado:
        serie = _nombre_archivo_serie(nombre_archivo) or sufijo
        if serie and norm(serie) not in norm(candidato):
            candidato = f"{serie} – {candidato}"
    return candidato, citado


def _personas(lineas: list[str], etiquetas: tuple[str, ...], paradas: tuple[str, ...]) -> list[str]:
    """Nombres listados bajo una etiqueta como "Responsables:", hasta la siguiente etiqueta conocida."""
    for i, linea in enumerate(lineas):
        t = norm(linea)
        if any(t == e or t.startswith(e + ":") or t.startswith(e + " :") for e in etiquetas):
            crudas = [linea.partition(":")[2].strip()] if linea.partition(":")[2].strip() else []
            for sig in lineas[i + 1:]:
                ts = norm(sig)
                if any(ts.startswith(p) for p in paradas) or titulo_seccion(sig) in {x for v in CLAVES.values() for x in v}:
                    break
                crudas.append(sig)
            return [n for n in (nombre_persona(c) for c in crudas) if _nombre_valido(n)], crudas
    return [], []


def _nombre_valido(n: str) -> bool:
    return bool(n) and len(n) <= 60 and not re.search(r"\d", n) and not norm(n).startswith(("miembros", "equipo", "por definir", "descripcion"))


_PARADAS = ("fecha", "dirigido", "organizador", "area:", "representante", "apoyo", "soporte", "contacto", "modalidad", "ubicacion")


def _responsables(doc: Documento, sec: dict) -> tuple[list[str], str | None]:
    lineas = doc.lineas
    nombres: list[str] = []
    crudas: list[str] = []
    for etiqueta in (("responsables", "responsables directos"), ("responsable del evento",)):
        nombres, crudas = _personas(lineas, etiqueta, _PARADAS)
        if nombres:
            break
    if not nombres:
        for etiqueta in (("representante de cinergia",), ("director",), ("elaborado por",)):
            nombres, crudas = _personas(lineas, etiqueta, _PARADAS)
            if nombres:
                break
    if not nombres:
        return [], None
    preferido = None
    for n, c in zip(nombres, [c for c in crudas if _nombre_valido(nombre_persona(c))]):
        if "director" in norm(c) and "evento" in norm(c):
            preferido = n
            break
    # Con "Elaborado por" detrás de varios nombres, el primero es quien responde.
    return nombres, preferido or nombres[0]


def _metas(sec: dict) -> list[dict]:
    metas: list[dict] = []
    for linea in sec.get("metricas", []):
        t = norm(linea)
        if t.startswith("herramientas de medicion"):
            break
        texto = sin_viñeta(linea)
        if ":" in texto:
            nombre, _, valor = texto.partition(":")
            nombre, valor = limpiar(nombre), limpiar(valor).rstrip(".")
            if not valor or len(nombre) > 70 or not re.search(r"\d|[≥≤<>]", valor):
                continue
            valor = re.sub(r"(?<=\d)(?=[A-Za-zÁ-ú]{4,})", " ", valor)
            metas.append({"metrica": nombre, "objetivo": valor})
            continue
        m = re.match(r"([≥≤<>]=?\s*\d+(?:[.,]\d+)?\s*%?)\s*(.+)", texto) or re.match(r"(\d+(?:[.,]\d+)?\s*%)\s*(?:de\s+)?(.+)", texto)
        if m:
            nombre = re.sub(r"^de\s+", "", m.group(2).strip(" ."))
            metas.append({"metrica": nombre[:1].upper() + nombre[1:], "objetivo": re.sub(r"\s+", "", m.group(1)).replace("≥", "≥ ").replace("≤", "≤ ")})
    return metas


def _metas_desde_objetivos(sec: dict) -> list[dict]:
    metas = []
    for linea in sec.get("objetivos", []):
        m = re.search(r"(al menos(?: el)?|del)\s+(\d{1,3})\s*%", norm(linea))
        if not m:
            continue
        objetivo = f"≥ {m.group(2)}%" if m.group(1).startswith("al menos") else f"{m.group(2)}%"
        frase = re.split(r",\s*(?:medido|evaluado)", sin_viñeta(linea))[0].rstrip(" .")
        metas.append({"metrica": recortar(frase, 110), "objetivo": objetivo})
    return metas


def _riesgos(doc: Documento, sec: dict) -> tuple[list[dict], bool]:
    """Devuelve los riesgos y si el documento tenía una tabla que no pudo leerse (PDF)."""
    riesgos: list[dict] = []
    bloques = doc.bloques
    i = 0
    while i < len(bloques):
        tipo, valor = bloques[i]
        if tipo == "fila":
            cab = [norm(" ".join(c)) for c in valor]
            if any(c.startswith("riesgo") for c in cab) and any("mitigaci" in c for c in cab):
                ir = next(k for k, c in enumerate(cab) if c.startswith("riesgo"))
                im = next(k for k, c in enumerate(cab) if "mitigaci" in c)
                ip = next((k for k, c in enumerate(cab) if "probabilidad" in c), None)
                ii = next((k for k, c in enumerate(cab) if "impacto" in c), None)
                j = i + 1
                while j < len(bloques) and bloques[j][0] == "fila":
                    fila = [" ".join(c) for c in bloques[j][1]]
                    if len(fila) > max(ir, im) and fila[ir].strip():
                        riesgos.append({
                            "riesgo": limpiar(fila[ir]),
                            "mitigacion": limpiar(fila[im]),
                            "probabilidad": limpiar(fila[ip]) if ip is not None and ip < len(fila) else None,
                            "impacto": limpiar(fila[ii]) if ii is not None and ii < len(fila) else None,
                        })
                    j += 1
                i = j
                continue
        i += 1
    if riesgos:
        return riesgos, False
    lineas = sec.get("riesgos", [])
    actual = None
    for linea in lineas:
        m = re.match(r"riesgo\s*\d*\s*:\s*(.+)", linea, re.IGNORECASE)
        if m:
            actual = {"riesgo": limpiar(m.group(1)), "mitigacion": "", "probabilidad": None, "impacto": None}
            riesgos.append(actual)
        elif actual is not None and re.match(r"mitigaci[oó]n\s*:", linea, re.IGNORECASE):
            actual["mitigacion"] = limpiar(linea.partition(":")[2])
    if riesgos:
        return riesgos, False
    tabla_plana = any(norm(l).startswith("riesgo") and "mitigacion" in norm(l) for l in lineas) and doc.formato == "pdf"
    return [], tabla_plana


def _presupuesto(sec: dict) -> str | None:
    for linea in sec.get("presupuesto", []):
        m = re.match(r"\s*total\s*:?\s*(.+)", linea, re.IGNORECASE)
        if m and re.search(r"\d", m.group(1)):
            valor = limpiar(m.group(1))
            return valor if re.search(r"s/|\$", valor, re.IGNORECASE) else f"S/ {valor}"
    return None


def _piezas(sec: dict, fecha_evento: date | None, hoy: date) -> list[Hito]:
    """Acciones del plan de difusión que corresponden a Marketing, solo para eventos que aún no ocurren."""
    if not fecha_evento or fecha_evento < hoy:
        return []
    etapa = None
    piezas: list[Hito] = []
    vistos: set[str] = set()
    for linea in sec.get("difusion", []):
        t = norm(linea.rstrip(":"))
        encontrada = next((n for n, marcas in _ETAPAS if any(t.startswith(m) for m in marcas)), None)
        if encontrada:
            etapa = encontrada
            linea = linea.partition(":")[2].strip()
            if not linea:
                continue
        if etapa is None:
            continue
        for frase in re.split(r"(?<=[.;])\s+(?=[A-ZÁÉÍÓÚ¿“\"])", sin_viñeta(linea)):
            frase = limpiar(frase).rstrip(" .;")
            if len(frase) < 12 or not _MARKETING.search(frase):
                continue
            clave = norm(frase)
            if clave in vistos:
                continue
            vistos.add(clave)
            limite = {"pre": fecha_evento - timedelta(days=3), "durante": fecha_evento, "post": None}[etapa]
            piezas.append(Hito(descripcion=recortar(frase, 200), fecha_limite=limite, tipo="pieza_comunicacion", responsable="Marketing"))
    return piezas


def leer(doc: Documento, nombre_archivo: str, hoy: date | None = None) -> ActaLeida:
    hoy = hoy or date.today()
    lineas = doc.lineas
    sec = dividir_secciones(lineas, CLAVES)
    advertencias: list[str] = []

    nombre, _ = _titulo(doc, sec, nombre_archivo)
    if _es_plantilla(nombre) or sum(1 for l in lineas if norm(l).startswith("descripcion:")) >= 5:
        raise ErrorActa("El archivo es la plantilla de acta de evento sin completar. Sube el acta con el título del evento.")
    if not nombre:
        raise ErrorActa("No se encontró el título del evento en el acta.")

    codigo = valor_etiqueta(lineas, "n.º de acta", "n° de acta", "no. de acta", "numero de acta", "n de acta", siguiente=False)
    codigo = codigo if re.fullmatch(r"[A-Z]{2,4}-\d{4}-\d{2,4}", codigo or "") else None

    entrega = (sec.get("entrega") or [""])[0] or valor_etiqueta(lineas, "fecha de entrega", "fecha de elaboracion", "fecha de elaboracion del acta", siguiente=False)
    f_acta = primera_fecha(entrega) if not es_vacio(entrega) else None
    fecha_acta = f_acta.fecha if f_acta else None

    info = sec.get("info") or lineas
    fecha_txt = ""
    for etiquetas in (("fecha y hora", "fecha tentativa", "fecha del evento", "fecha"),):
        fecha_txt = valor_etiqueta(info, *etiquetas, siguiente=False) or valor_etiqueta(lineas, *etiquetas, siguiente=False)
    fecha_evento = None
    if fecha_txt and not es_vacio(fecha_txt):
        f = primera_fecha(fecha_txt, fecha_acta)
        if f:
            fecha_evento = f.fecha
            if f.dia_coincide is False:
                advertencias.append(
                    f"La fecha {f.fecha.strftime('%d/%m/%Y')} no coincide con el día de la semana escrito en el acta. Revisar."
                )
    else:
        fecha_txt = ""

    modalidad_ubic = valor_etiqueta(info, "modalidad / ubicacion", "modalidad y ubicacion", "modalidad/ubicacion", siguiente=False)
    if es_vacio(modalidad_ubic):
        modalidad_ubic = ""
    if not modalidad_ubic:
        mod = (valor_etiqueta(info, "modalidad", siguiente=False) or valor_etiqueta(lineas, "modalidad", siguiente=False)).strip(" .")
        ubi = valor_etiqueta(info, "ubicacion", "sedes", "sede", "lugar", siguiente=False) or valor_etiqueta(lineas, "ubicacion", siguiente=False)
        modalidad_ubic = " – ".join(x for x in (mod, ubi) if x and not es_vacio(x))
    sede = modalidad_ubic or None

    aforo_txt = valor_etiqueta(info, "capacidad", "capacidad estimada", "aforo", "aforo estimado", siguiente=False) or valor_etiqueta(
        lineas, "capacidad estimada", "capacidad", "aforo estimado", siguiente=False)
    aforo = entero_de(aforo_txt)
    aforo_txt = None if es_vacio(aforo_txt) else (aforo_txt or None)

    responsables, responsable = _responsables(doc, sec)

    resumen = limpiar(" ".join(sec.get("resumen", [])[:3]))
    if not resumen or _es_plantilla(resumen):
        resumen = ""
    obj_sec = sec.get("objetivos", [])
    objetivo = bloque_etiqueta(obj_sec, ("objetivo general", "general"), ("objetivos especificos", "especificos", "objetivo especifico"))
    objetivo = "" if _es_plantilla(objetivo) or not objetivo else objetivo
    if not resumen and objetivo:
        resumen = objetivo

    metas = _metas(sec) or _metas_desde_objetivos(sec)
    riesgos, tabla_ilegible = _riesgos(doc, sec)
    if tabla_ilegible:
        advertencias.append("La tabla de riesgos de este PDF no se pudo leer. Súbela en Word para registrar los riesgos.")

    piezas = _piezas(sec, fecha_evento, hoy)

    faltantes = []
    if not responsable:
        faltantes.append("Responsable")
    if not fecha_evento:
        advertencias.append("El acta no trae una fecha de evento definida.")

    return ActaLeida(
        area="Eventos", tipo="evento", nombre=nombre, codigo=codigo, responsable=responsable, responsables=responsables,
        fecha_programada=fecha_evento, fecha_acta=fecha_acta, fecha_texto=fecha_txt or None, sede=sede,
        aforo=aforo, aforo_texto=aforo_txt, resumen=recortar(resumen, 700) or None, objetivo_general=recortar(objetivo, 500) or None,
        presupuesto=_presupuesto(sec), metas=metas, riesgos=riesgos, hitos=piezas, advertencias=advertencias, faltantes=faltantes,
    )
