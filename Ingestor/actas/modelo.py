"""Estructura común que devuelven los lectores de actas."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date


class ErrorActa(Exception):
    """El archivo no es un acta utilizable. El mensaje se muestra a quien la sube."""


@dataclass
class Hito:
    descripcion: str
    fecha_limite: date | None = None
    completado: bool = False
    fecha_entrega: date | None = None
    tipo: str = "hito"
    responsable: str | None = None
    externo: bool = False


@dataclass
class ActaLeida:
    area: str
    tipo: str                      # evento | proyecto | convenio | carta | propuesta
    nombre: str = ""
    codigo: str | None = None
    responsable: str | None = None
    responsables: list[str] = field(default_factory=list)
    fecha_programada: date | None = None
    fecha_acta: date | None = None
    fecha_texto: str | None = None
    sede: str | None = None
    aforo: int | None = None
    aforo_texto: str | None = None
    resumen: str | None = None
    objetivo_general: str | None = None
    presupuesto: str | None = None
    metas: list[dict] = field(default_factory=list)
    riesgos: list[dict] = field(default_factory=list)
    hitos: list[Hito] = field(default_factory=list)
    vigente_hasta: date | None = None
    estado_sugerido: str | None = None
    advertencias: list[str] = field(default_factory=list)
    faltantes: list[str] = field(default_factory=list)
