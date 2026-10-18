"""Pruebas del guardado de actas en la base, con una base simulada."""

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from actas import leer_acta  # noqa: E402
from registro import huella, registrar  # noqa: E402
from test_instagram import BaseFalsa  # noqa: E402
import documentos_prueba as dp  # noqa: E402

HOY = date(2026, 10, 18)


def cargar(db, nombre, contenido, estado="Planificación Base", **kw):
    return registrar(db, leer_acta(nombre, contenido, HOY), estado=estado, contenido=contenido, nombre_archivo=nombre, **kw)


def test_crea_proyecto_con_los_datos_del_acta_y_registra_la_etapa():
    db = BaseFalsa()
    contenido = dp.acta_evento()
    r = cargar(db, "EVT-2026-010 TALLER.docx", contenido, "Aprobación Directiva")
    assert r.accion == "creado" and r.id.startswith("PRJ-")
    p = db.tablas["proyectos"][0]
    assert p["nombre"] == "Taller de Prueba Aplicada" and p["area"] == "Eventos"
    assert p["responsable"] == "Ana Prueba Uno"
    assert p["estado_actual"] == "Aprobación Directiva"
    assert p["fecha_programada"] == "2026-10-17" and p["fecha"] == "17 Oct 2026"
    assert p["aforo_estimado"] == 25 and p["staff_requerido"].startswith("20–25")
    assert p["sede"] == "Presencial / Aula 101"
    assert p["archivo_hash"] == huella(contenido)
    assert len(p["metas"]) == 2 and len(p["riesgos"]) == 2
    assert db.rpc_llamadas == [("registrar_etapa", {"p_proyecto": r.id, "p_etapa": "Aprobación Directiva"})]
    ruta = f"{r.id}_EVT-2026-010_TALLER.docx"
    assert ruta in db.archivos and "wordprocessingml" in db.archivos[ruta][1]["content-type"]
    assert p["archivo_url"].endswith(ruta)


def test_etapa_no_valida_cae_en_planificacion_base():
    db = BaseFalsa()
    cargar(db, "a.docx", dp.acta_evento(), "Etapa inventada")
    assert db.tablas["proyectos"][0]["estado_actual"] == "Planificación Base"


def test_el_mismo_archivo_no_se_vuelve_a_cargar():
    db = BaseFalsa()
    contenido = dp.acta_propuesta()
    primero = cargar(db, "p.docx", contenido)
    segundo = cargar(db, "p.docx", contenido)
    assert (primero.accion, segundo.accion) == ("creado", "sin_cambios")
    assert segundo.id == primero.id
    assert len(db.tablas["proyectos"]) == 1 and len(db.tablas["compromisos"]) == 3


def test_nueva_version_actualiza_el_proyecto_y_conserva_su_etapa():
    db = BaseFalsa()
    primero = cargar(db, "a.docx", dp.acta_evento(), "Aprobación Directiva")
    db.tablas["proyectos"][0]["estado_actual"] = "Ejecución Activa"   # la directiva ya avanzó la etapa
    segundo = cargar(db, "a.docx", dp.acta_evento(fecha="Sábado 24 de octubre de 2026 a las 2 pm"), "Planificación Base")
    assert segundo.accion == "actualizado" and segundo.id == primero.id
    assert len(db.tablas["proyectos"]) == 1
    p = db.tablas["proyectos"][0]
    assert p["fecha_programada"] == "2026-10-24" and p["estado_actual"] == "Ejecución Activa"
    assert len(db.rpc_llamadas) == 1   # la etapa solo se registra al crear


def test_proyectos_de_distinta_area_con_el_mismo_nombre_no_se_mezclan():
    db = BaseFalsa()
    cargar(db, "e.docx", dp.acta_evento(titulo="Sistema de Prueba"))
    cargar(db, "p.docx", dp.acta_proyecto())
    assert sorted(p["area"] for p in db.tablas["proyectos"]) == ["Eventos", "Proyectos"]


def test_compromisos_del_proyecto_se_crean_con_su_estado_y_fechas():
    db = BaseFalsa()
    r = cargar(db, "p.docx", dp.acta_proyecto(), "Ejecución Activa")
    filas = {c["descripcion"]: c for c in db.tablas["compromisos"]}
    assert len(filas) == 5 and all(c["proyecto_id"] == r.id and c["tipo"] == "hito" for c in filas.values())
    fase1 = filas["Fase 1: Acta del proyecto"]
    assert fase1["completado"] is True and fase1["fecha_entrega"] == fase1["fecha_limite"]
    assert fase1["fecha_limite"].startswith("2026-10-08T23:59") and fase1["fecha_limite"].endswith("-05:00")
    assert filas["Fase 4: Desarrollo"]["fecha_limite"] is None and not filas["Fase 4: Desarrollo"]["completado"]
    assert filas["Fase 4: Desarrollo"]["fecha_entrega"] is None
    assert all(c["responsable"] == "Nombre Uno Apellido Uno" and c["area"] == "Proyectos" for c in filas.values())


def test_al_actualizar_no_duplica_ni_pisa_lo_que_ya_se_entrego():
    db = BaseFalsa()
    cargar(db, "p.docx", dp.acta_proyecto(), "Ejecución Activa")
    por_nombre = {c["descripcion"]: c for c in db.tablas["compromisos"]}
    por_nombre["Fase 4: Desarrollo"].update({"completado": True, "fecha_entrega": "2026-10-17T10:00:00-05:00"})
    por_nombre["Fase 1: Acta del proyecto"]["fecha_limite"] = "2026-10-07T23:59:00-05:00"   # corrección manual ya entregada

    r = cargar(db, "p.docx", dp.acta_proyecto(fase_dos="11/10/2026"))
    por_nombre = {c["descripcion"]: c for c in db.tablas["compromisos"]}
    assert r.accion == "actualizado" and (r.compromisos_nuevos, r.compromisos_actualizados) == (0, 0)
    assert len(db.tablas["compromisos"]) == 5
    assert por_nombre["Fase 4: Desarrollo"]["fecha_entrega"] == "2026-10-17T10:00:00-05:00"
    assert por_nombre["Fase 1: Acta del proyecto"]["fecha_limite"] == "2026-10-07T23:59:00-05:00"
    # La fase 2 ya estaba entregada (la fase 4 marcaba las anteriores como terminadas): se conserva
    assert por_nombre["Fase 2: Planificación"]["fecha_limite"].startswith("2026-10-10")


def test_compromiso_pendiente_actualiza_su_fecha_si_el_acta_la_cambia():
    db = BaseFalsa()
    contenido_a = dp.docx_bytes([
        "ACTA DE CONSTITUCIÓN DEL PROYECTO", "Título Proyecto: Proyecto Fechas", "Tiempo", "Segundo semestre",
        [["Resumen de Hitos", "Fecha de cumplimiento"], ["Fase 1: Acta del proyecto", "15/10/2026"], ["Fase 2: Planificación", "25/10/2026"]],
        "Encargados del proyecto", "Apellido Tres, Nombre Tres", "Aprobaciones:",
    ])
    cargar(db, "f.docx", contenido_a)
    nuevo = dp.docx_bytes([
        "ACTA DE CONSTITUCIÓN DEL PROYECTO", "Título Proyecto: Proyecto Fechas", "Tiempo", "Segundo semestre",
        [["Resumen de Hitos", "Fecha de cumplimiento"], ["Fase 1: Acta del proyecto", "15/10/2026"], ["Fase 2: Planificación", "30/10/2026"]],
        "Encargados del proyecto", "Apellido Tres, Nombre Tres", "Aprobaciones:",
    ])
    r = cargar(db, "f.docx", nuevo)
    fase2 = next(c for c in db.tablas["compromisos"] if c["descripcion"].startswith("Fase 2"))
    assert fase2["fecha_limite"].startswith("2026-10-30") and r.compromisos_actualizados == 1


def test_compromisos_de_alianza_guardan_quien_los_debe():
    db = BaseFalsa()
    cargar(db, "c.docx", dp.acta_convenio(), "Ejecución Activa")
    filas = db.tablas["compromisos"]
    assert {(c["responsable"], c["tipo"], c["externo"]) for c in filas} == {
        ("EMPRESA DEMO", "compromiso_aliado", False), ("Cinergia", "compromiso_aliado", False)}
    assert db.tablas["proyectos"][0]["area"] == "Gestión de Oportunidades"


def test_sin_subir_archivo_no_toca_el_almacenamiento():
    db = BaseFalsa()
    cargar(db, "a.docx", dp.acta_evento(), subir_archivo=False)
    assert db.archivos == {} and "archivo_url" not in db.tablas["proyectos"][0]


def test_guarda_tipo_de_acta_y_vigencia_del_convenio():
    db = BaseFalsa()
    cargar(db, "convenio.docx", dp.acta_convenio())
    cargar(db, "evento.docx", dp.acta_evento())
    convenio, evento = db.tablas["proyectos"]
    assert convenio["tipo_acta"] == "convenio" and convenio["vigente_hasta"] == "2026-12-31"
    assert evento["tipo_acta"] == "evento" and evento["vigente_hasta"] is None
