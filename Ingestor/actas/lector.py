"""Detecta el tipo de acta por su contenido y la entrega al lector del área."""
from __future__ import annotations

from datetime import date

from .modelo import ActaLeida, ErrorActa
from .texto import leer_documento, norm


def leer_acta(nombre_archivo: str, contenido: bytes, hoy: date | None = None) -> ActaLeida:
    doc = leer_documento(nombre_archivo, contenido)
    inicio = norm(" ".join(doc.lineas[:12]))
    texto = norm(" ".join(doc.lineas[:60]))
    if "acta de constitucion del proyecto" in inicio:
        from . import proyectos
        return proyectos.leer(doc, nombre_archivo, hoy)
    if "acta de evento" in inicio or "ficha de evento" in inicio:
        from . import eventos
        return eventos.leer(doc, nombre_archivo, hoy)
    if any(m in inicio for m in ("alianza estrategica", "convenio de", "carta de alianza", "carta de alianza y colaboracion")) or "carta de alianza" in texto:
        from . import alianzas
        return alianzas.leer(doc, nombre_archivo, hoy)
    raise ErrorActa(
        "No se reconoce el tipo de acta. Se admiten actas de evento, actas de constitución de proyecto, "
        "convenios, cartas y propuestas de alianza."
    )
