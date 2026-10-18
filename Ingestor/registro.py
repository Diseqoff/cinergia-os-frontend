"""Guarda en Supabase lo que leyó un lector de actas.

Una misma acta no se duplica: el mismo archivo (por huella) no se vuelve a cargar, y una versión
nueva de un proyecto ya existente (misma área y mismo nombre) lo actualiza en lugar de crear otro.
"""
from __future__ import annotations

import hashlib
import re
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone

from actas import ActaLeida
from actas.texto import fecha_legible, norm

ZONA_LIMA = timezone(timedelta(hours=-5))
ETAPAS = ["Planificación Base", "Aprobación Directiva", "Ejecución Activa", "Revisión / QA", "Cierre Operativo", "Finalizado"]
MIME = {
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pdf": "application/pdf",
}


@dataclass
class Resultado:
    accion: str                      # creado | actualizado | sin_cambios
    id: str
    nombre: str
    compromisos_nuevos: int = 0
    compromisos_actualizados: int = 0
    avisos: list[str] = field(default_factory=list)


def huella(contenido: bytes) -> str:
    return hashlib.sha256(contenido).hexdigest()


def _fin_de_dia(d: date | None) -> str | None:
    return datetime(d.year, d.month, d.day, 23, 59, tzinfo=ZONA_LIMA).isoformat() if d else None


def _nuevo_id(db) -> str:
    for _ in range(10):
        candidato = f"PRJ-{uuid.uuid4().hex[:4].upper()}"
        if not db.table("proyectos").select("id").eq("id", candidato).limit(1).execute().data:
            return candidato
    raise RuntimeError("No se pudo generar un identificador de proyecto.")


def _fila_proyecto(acta: ActaLeida, enlace_excel: str | None) -> dict:
    return {
        "nombre": acta.nombre,
        "area": acta.area,
        "responsable": acta.responsable or "Por asignar",
        "sede": acta.sede,
        "fecha": fecha_legible(acta.fecha_programada) or acta.fecha_texto,
        "fecha_programada": acta.fecha_programada.isoformat() if acta.fecha_programada else None,
        "staff_requerido": acta.aforo_texto,
        "aforo_estimado": acta.aforo,
        "resumen": acta.resumen,
        "objetivo_general": acta.objetivo_general,
        "presupuesto": acta.presupuesto,
        "enlace_excel": enlace_excel,
        "metas": acta.metas,
        "riesgos": acta.riesgos,
        "tipo_acta": acta.tipo,
        "vigente_hasta": acta.vigente_hasta.isoformat() if acta.vigente_hasta else None,
    }


def _subir(db, ruta: str, nombre_archivo: str, contenido: bytes) -> str:
    extension = "." + nombre_archivo.rsplit(".", 1)[-1].lower() if "." in nombre_archivo else ""
    bucket = db.storage.from_("actas")
    bucket.upload(path=ruta, file=contenido, file_options={"content-type": MIME.get(extension, "application/octet-stream"), "upsert": "true"})
    return bucket.get_public_url(ruta)


def _sincronizar_compromisos(db, proyecto_id: str, acta: ActaLeida) -> tuple[int, int]:
    previos = db.table("compromisos").select("*").eq("proyecto_id", proyecto_id).execute().data or []
    por_texto = {norm(c["descripcion"]): c for c in previos}
    por_insertar: list[dict] = []
    actualizados = 0
    for h in acta.hitos:
        limite = _fin_de_dia(h.fecha_limite)
        entrega = limite if h.completado and h.fecha_entrega else None
        base = {
            "descripcion": h.descripcion,
            "tipo": h.tipo,
            "area": "Marketing" if h.tipo == "pieza_comunicacion" else acta.area,
            "responsable": h.responsable or acta.responsable,
            "externo": h.externo,
            "fecha_limite": limite,
        }
        previo = por_texto.get(norm(h.descripcion))
        if previo is None:
            if norm(h.descripcion) in {norm(x["descripcion"]) for x in por_insertar}:
                continue
            por_insertar.append({"proyecto_id": proyecto_id, **base, "completado": h.completado, "fecha_entrega": entrega})
        elif not previo.get("completado") and not previo.get("fecha_entrega"):
            cambios = {k: v for k, v in base.items() if previo.get(k) != v and k != "descripcion"}
            if h.completado:
                cambios.update({"completado": True, "fecha_entrega": entrega})
            if cambios:
                db.table("compromisos").update(cambios).eq("id", previo["id"]).execute()
                actualizados += 1
    if por_insertar:
        db.table("compromisos").insert(por_insertar).execute()
    return len(por_insertar), actualizados


def registrar(
    db, acta: ActaLeida, *, estado: str, contenido: bytes, nombre_archivo: str,
    enlace_excel: str | None = None, subir_archivo: bool = True,
) -> Resultado:
    if estado not in ETAPAS:
        estado = ETAPAS[0]
    digest = huella(contenido)

    repetido = db.table("proyectos").select("id, nombre").eq("archivo_hash", digest).limit(1).execute().data
    if repetido:
        return Resultado("sin_cambios", repetido[0]["id"], repetido[0]["nombre"])

    existentes = db.table("proyectos").select("id, nombre, estado_actual").eq("area", acta.area).execute().data or []
    previo = next((p for p in existentes if norm(p["nombre"]) == norm(acta.nombre)), None)

    fila = _fila_proyecto(acta, enlace_excel)
    proyecto_id = previo["id"] if previo else _nuevo_id(db)
    if subir_archivo:
        ruta = f"{proyecto_id}_{re.sub(r'[^A-Za-z0-9._-]', '_', nombre_archivo)}"
        fila["archivo_url"] = _subir(db, ruta, nombre_archivo, contenido)
    fila["archivo_hash"] = digest
    fila["updated_at"] = datetime.now(timezone.utc).isoformat()

    if previo:
        db.table("proyectos").update(fila).eq("id", proyecto_id).execute()
        accion = "actualizado"
    else:
        db.table("proyectos").insert({"id": proyecto_id, "estado_actual": estado, **fila}).execute()
        db.rpc("registrar_etapa", {"p_proyecto": proyecto_id, "p_etapa": estado}).execute()
        accion = "creado"

    nuevos, actualizados = _sincronizar_compromisos(db, proyecto_id, acta)
    return Resultado(accion, proyecto_id, acta.nombre, nuevos, actualizados, list(acta.advertencias))
