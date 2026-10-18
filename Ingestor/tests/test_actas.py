"""Pruebas de los lectores de actas por área, con documentos sintéticos."""

import sys
from datetime import date
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from actas import ErrorActa, leer_acta  # noqa: E402
from actas.texto import entero_de, fechas_en  # noqa: E402
import documentos_prueba as dp  # noqa: E402

HOY = date(2026, 10, 1)


# ---------------------------------------------------------------------------
# Fechas y aforo
# ---------------------------------------------------------------------------
def test_fecha_completa_en_prosa_y_numerica():
    assert [f.fecha for f in fechas_en("5 de septiembre de 2026 | 12:00 p. m.")] == [date(2026, 9, 5)]
    assert [f.fecha for f in fechas_en("Lima, 09 de abril del 2026")] == [date(2026, 4, 9)]
    assert [f.fecha for f in fechas_en("04/07/2026 y 26-01-2026")] == [date(2026, 7, 4), date(2026, 1, 26)]
    assert [f.fecha for f in fechas_en("a los 20 días del mes de abril de 2026")] == [date(2026, 4, 20)]
    assert [f.fecha for f in fechas_en("hasta el 31 del mes de diciembre de 2026")] == [date(2026, 12, 31)]


def test_rango_de_fechas_entrega_ambos_extremos():
    assert [f.fecha for f in fechas_en("08 al 14 de junio de 2026")] == [date(2026, 6, 8), date(2026, 6, 14)]


def test_fecha_sin_anio_usa_la_fecha_del_acta_o_el_dia_de_la_semana():
    con_acta = fechas_en("Miércoles 19 de noviembre a las 3:30 pm", date(2025, 10, 29))[0]
    assert con_acta.fecha == date(2025, 11, 19) and con_acta.dia_coincide is True
    por_dia = fechas_en("Viernes 2 de octubre de 2:00 pm")[0]
    assert por_dia.fecha == date(2026, 10, 2) and por_dia.sin_anio
    assert fechas_en("2 de octubre") == []


def test_fecha_sin_anio_con_dia_de_semana_que_no_coincide():
    f = fechas_en("Miércoles 18 de noviembre", date(2025, 10, 29))[0]
    assert f.fecha == date(2025, 11, 18) and f.dia_coincide is False


@pytest.mark.parametrize("texto,esperado", [
    ("20–25 estudiantes de 1.º a 3.º ciclo", 25),
    ("15-25 asistentes (mínimo 15)", 25),
    ("60 personas", 60),
    ("20 Estudiantes.", 20),
    ("252", 252),
    ("Estudiantes de 1.º a 4.º ciclo (aforo según el auditorio)", None),
    ("Por definir", None),
    (None, None),
])
def test_aforo(texto, esperado):
    assert entero_de(texto) == esperado


# ---------------------------------------------------------------------------
# Eventos
# ---------------------------------------------------------------------------
def test_evento_numerado_extrae_cada_dato():
    a = leer_acta("EVT-2026-010 TALLER.docx", dp.acta_evento(), HOY)
    assert (a.area, a.tipo) == ("Eventos", "evento")
    assert a.nombre == "Taller de Prueba Aplicada"
    assert a.codigo == "EVT-2026-010"
    assert a.responsable == "Ana Prueba Uno"
    assert a.responsables == ["Ana Prueba Uno", "Beto Prueba Dos"]
    assert a.fecha_programada == date(2026, 10, 17)
    assert a.fecha_acta == date(2026, 8, 3)
    assert a.sede == "Presencial / Aula 101"
    assert a.aforo == 25 and a.aforo_texto.startswith("20–25")
    assert a.objetivo_general == "Orientar a los estudiantes en sus primeros ciclos."
    assert a.metas == [
        {"metrica": "Asistencia", "objetivo": "≥ 25 estudiantes"},
        {"metrica": "Satisfacción", "objetivo": "≥ 75%"},
    ]
    assert [(r["riesgo"], r["mitigacion"], r["probabilidad"], r["impacto"]) for r in a.riesgos] == [
        ("Baja asistencia", "Invitación directa", "Media", "Alto"),
        ("Falla técnica", "Plan B sin conexión", "Baja", "Medio"),
    ]
    assert a.faltantes == [] and a.advertencias == []


def test_evento_futuro_genera_piezas_de_marketing_solo_con_acciones_de_comunicacion():
    a = leer_acta("x.docx", dp.acta_evento(), HOY)
    piezas = [(h.descripcion, h.fecha_limite, h.tipo) for h in a.hitos]
    assert piezas == [
        ("Publicación de banner digital y stories en redes", date(2026, 10, 14), "pieza_comunicacion"),
        ("Cobertura fotográfica en tiempo real", date(2026, 10, 17), "pieza_comunicacion"),
        ("Recap audiovisual del evento", None, "pieza_comunicacion"),
    ]


def test_evento_ya_realizado_no_genera_piezas():
    assert leer_acta("x.docx", dp.acta_evento(), date(2026, 10, 18)).hitos == []


def test_evento_sin_responsables_queda_como_faltante():
    a = leer_acta("x.docx", dp.acta_evento(responsables=False), HOY)
    assert a.responsable is None and a.faltantes == ["Responsable"]


def test_ficha_con_titulo_entre_comillas_toma_la_serie_del_nombre_del_archivo():
    a = leer_acta("EVT-2025-002 CINERGIA TALKS N°07.docx", dp.acta_ficha(), date(2026, 10, 1))
    assert a.nombre == "CINERGIA Talks N°07 – Charla de Orientación"
    assert a.responsable == "Carla Ficha Uno"
    assert a.fecha_acta == date(2025, 10, 29)
    assert a.fecha_programada == date(2025, 11, 19)
    assert a.aforo == 20 and a.advertencias == []


def test_dia_de_semana_que_no_coincide_se_advierte_sin_corregir_la_fecha():
    a = leer_acta("x.docx", dp.acta_evento(fecha="Sábado 18 de octubre de 2026"), HOY)
    assert a.fecha_programada == date(2026, 10, 18)
    assert any("día de la semana" in x for x in a.advertencias)


def test_evento_sin_fecha_definida_advierte():
    a = leer_acta("x.docx", dp.acta_evento(fecha="Por definir"), HOY)
    assert a.fecha_programada is None
    assert any("fecha de evento" in x for x in a.advertencias)


def test_plantilla_de_evento_se_rechaza():
    lineas = ["ACTA DE EVENTO - CINERGIA", "1. Ficha de Evento", "N.º de Acta:", "Descripción: Código único del evento.",
              "2. Título del Evento", "Descripción: Nombre oficial del evento. Debe ser claro.",
              "3. Organización Responsable", "Descripción: Área organizadora y responsables.",
              "4. Fecha de Entrega del Acta", "Descripción: Fecha de presentación.",
              "5. Resumen Ejecutivo del Evento", "Descripción: Síntesis general del evento."]
    with pytest.raises(ErrorActa, match="plantilla"):
        leer_acta("PLANTILLA.docx", dp.docx_bytes(lineas), HOY)


def test_evento_en_pdf_lee_campos_metas_y_presupuesto():
    pdf = dp.pdf_bytes([
        "FICHA DE EVENTO", "Bienvenida de Prueba", "1. INFORMACIÓN GENERAL",
        "Nombre del Evento: Semana de Integración de Prueba",
        "Responsable del Evento: Eva Pdf Uno (Director de Comunidad y Eventos)",
        "Fecha: 16 de septiembre 2025", "Modalidad: Presencial", "Ubicación: Por confirmar",
        "Capacidad Estimada: 15-25 asistentes (mínimo 15)",
        "6. PRESUPUESTO", "Partida Costo Estimado (S/.)", "Refrigerios ligeros 48 - 62", "TOTAL 48 - 62",
        "9. MÉTRICAS Y EVALUACIÓN", "Indicadores de Éxito:", "- ≥15 asistentes confirmados", "- 80% de participantes registrados",
        "Herramientas de Medición:", "- Lista de asistencia",
        "10. RIESGOS Y CONTINGENCIAS", "Riesgo Probabilidad Mitigación", "Baja asistencia Media Confirmar antes",
    ])
    if pdf is None:
        pytest.skip("reportlab o la fuente de prueba no están disponibles")
    a = leer_acta("EVT-2025-001.pdf", pdf, HOY)
    assert a.nombre == "Semana de Integración de Prueba"
    assert a.responsable == "Eva Pdf Uno"
    assert a.fecha_programada == date(2025, 9, 16)
    assert a.sede == "Presencial" and a.aforo == 25
    assert a.presupuesto == "S/ 48 - 62"
    assert a.metas == [
        {"metrica": "Asistentes confirmados", "objetivo": "≥ 15"},
        {"metrica": "Participantes registrados", "objetivo": "80%"},
    ]
    assert a.riesgos == [] and any("riesgos" in x for x in a.advertencias)


# ---------------------------------------------------------------------------
# Proyectos
# ---------------------------------------------------------------------------
def test_proyecto_extrae_hitos_lider_metas_y_riesgos():
    a = leer_acta("acta.docx", dp.acta_proyecto(), date(2026, 10, 18))
    assert (a.area, a.tipo, a.nombre) == ("Proyectos", "proyecto", "Sistema de Prueba")
    assert a.responsable == "Nombre Uno Apellido Uno"
    assert a.responsables == ["Nombre Uno Apellido Uno", "Nombre Dos Apellido Dos"]
    assert a.fecha_programada == date(2026, 10, 8)
    assert a.objetivo_general == "Contar con un sistema de prueba funcionando."
    assert a.metas == [{"metrica": "Planificar el sistema", "objetivo": "El plan es aprobado por la directiva"}]
    assert [r["riesgo"] for r in a.riesgos] == ["Retraso en la recopilación.", "Falta de equipo."]
    assert all(r["mitigacion"] == "" for r in a.riesgos)
    hitos = [(h.descripcion, h.fecha_limite, h.completado) for h in a.hitos]
    assert hitos == [
        ("Fase 1: Acta del proyecto", date(2026, 10, 8), True),
        ("Fase 2: Planificación", date(2026, 10, 10), True),
        ("Fase 3: Diseño", date(2026, 10, 15), True),      # rango: toma el final
        ("Fase 4: Desarrollo", None, False),                # en curso
        ("Fase 5: Pruebas", None, False),                   # sujeta a confirmación
    ]
    assert a.estado_sugerido == "Ejecución Activa"


def test_proyecto_sin_fase_en_curso_solo_cierra_el_acta():
    contenido = dp.docx_bytes([
        "ACTA DE CONSTITUCIÓN DEL PROYECTO", "Título Proyecto: Otro Proyecto", "Tiempo", "Segundo semestre",
        [["Resumen de Hitos", "Fecha de cumplimiento"], ["Fase 1: Acta del proyecto", "15/10/2026"],
         ["Fase 2: Planificación", "25/10/2026"]],
        "Encargados del proyecto", "Apellido Tres, Nombre Tres", "Aprobaciones:",
    ])
    a = leer_acta("p.docx", contenido, date(2026, 10, 18))
    assert [(h.completado) for h in a.hitos] == [True, False]
    assert a.responsable == "Nombre Tres Apellido Tres"
    assert a.fecha_programada == date(2026, 10, 15)
    assert a.estado_sugerido == "Planificación Base"


def test_guia_de_acta_de_constitucion_se_rechaza():
    contenido = dp.docx_bytes([
        "ACTA DE CONSTITUCIÓN DEL PROYECTO", "Título Proyecto: Nombre", "Justificación del proyecto",
        "PÁRRAFO 1: ¿Por qué el proyecto es necesario?", "Descripción del proyecto:", "Texto de guía",
    ])
    with pytest.raises(ErrorActa, match="guía"):
        leer_acta("guia.docx", contenido, HOY)


def test_proyecto_sin_titulo_se_rechaza():
    with pytest.raises(ErrorActa, match="título del proyecto"):
        leer_acta("p.docx", dp.docx_bytes(["ACTA DE CONSTITUCIÓN DEL PROYECTO", "Justificación del proyecto", "a", "b", "c", "d"]), HOY)


# ---------------------------------------------------------------------------
# Relaciones Exteriores
# ---------------------------------------------------------------------------
def test_propuesta_de_alianza_separa_compromisos_por_parte():
    a = leer_acta("propuesta.docx", dp.acta_propuesta(), HOY)
    assert (a.area, a.tipo, a.nombre) == ("Gestión de Oportunidades", "propuesta", "Propuesta de alianza con Club Demo")
    assert a.estado_sugerido == "Planificación Base"
    assert [(h.responsable, h.tipo) for h in a.hitos] == [
        ("Cinergia", "compromiso_aliado"), ("Cinergia", "compromiso_aliado"), ("Club Demo", "compromiso_aliado")]
    assert all(h.fecha_limite is None for h in a.hitos)
    assert a.resumen.startswith("La presente propuesta")


def test_convenio_toma_fecha_vigencia_y_no_guarda_datos_personales():
    a = leer_acta("convenio.docx", dp.acta_convenio(), date(2026, 10, 18))
    assert a.nombre == "Convenio con EMPRESA DEMO"
    assert a.fecha_acta == date(2026, 4, 20) and a.vigente_hasta == date(2026, 12, 31)
    assert a.estado_sugerido == "Ejecución Activa"
    assert [(h.responsable) for h in a.hitos] == ["EMPRESA DEMO", "EMPRESA DEMO", "Cinergia"]
    texto = " ".join([a.resumen or ""] + [h.descripcion for h in a.hitos])
    assert "12345678" not in texto and "demo@empresa.com" not in texto
    assert "Vigente hasta el 31/12/2026" in a.resumen


def test_convenio_vencido_queda_finalizado():
    assert leer_acta("c.docx", dp.acta_convenio(), date(2027, 1, 10)).estado_sugerido == "Finalizado"


def test_carta_de_alianza():
    a = leer_acta("carta.docx", dp.acta_carta(), HOY)
    assert a.nombre == "Carta de alianza con Demolab"
    assert a.fecha_acta == date(2026, 8, 16) and a.hitos == []
    assert a.advertencias == []


def test_modelo_de_alianza_sin_completar_se_rechaza():
    contenido = dp.docx_bytes([
        "ALIANZA ESTRATÉGICA CINERGIA UCSUR – [nombre de la asociación]", "Sumilla – CINERGIA UCSUR:", "Texto.",
        "Propósito de la Alianza:",
        "La presente propuesta tiene como objetivo formalizar un marco entre CINERGIA, asociación estudiantil, y [Nombre de la Asociación]. Esta iniciativa surge.",
        "Por parte de CINERGIA UCSUR, se compromete a brindar los siguientes beneficios:",
    ])
    with pytest.raises(ErrorActa, match="sin completar"):
        leer_acta("MODELO BORRADOR.docx", contenido, HOY)


# ---------------------------------------------------------------------------
# Detección de tipo y archivos no válidos
# ---------------------------------------------------------------------------
def test_documento_de_otro_tipo_se_rechaza_con_mensaje_claro():
    contenido = dp.docx_bytes(["Lista de compras", "Pan", "Leche", "Huevos", "Arroz", "Fideos"])
    with pytest.raises(ErrorActa, match="No se reconoce el tipo de acta"):
        leer_acta("compras.docx", contenido, HOY)


def test_formato_no_admitido_y_archivo_dañado():
    with pytest.raises(ErrorActa, match=".docx o .pdf"):
        leer_acta("acta.txt", b"hola", HOY)
    with pytest.raises(ErrorActa, match="No se pudo leer"):
        leer_acta("acta.docx", b"esto no es un docx", HOY)
    with pytest.raises(ErrorActa, match="No se pudo leer"):
        leer_acta("acta.pdf", b"esto no es un pdf", HOY)


def test_documento_casi_vacio_se_rechaza():
    with pytest.raises(ErrorActa, match="sin texto|no tiene texto"):
        leer_acta("vacio.docx", dp.docx_bytes(["ACTA DE EVENTO"]), HOY)
