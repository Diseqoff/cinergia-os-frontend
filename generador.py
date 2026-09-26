from docx import Document
import os

# Genera un acta de prueba con los títulos exactos de la plantilla oficial de
# estandarización de actas, que son los que busca Ingestor/api.py.

os.makedirs("Ingestor/documentos", exist_ok=True)

doc = Document()

doc.add_paragraph("1. INFORMACIÓN GENERAL")
doc.add_paragraph("Nombre del Proyecto: Seminario de Liderazgo PE")
doc.add_paragraph("Área Ejecutora: Eventos")
doc.add_paragraph("Responsable Directo: Nick Huaranga")
doc.add_paragraph("Fecha de Ejecución: 10/10/2026")
doc.add_paragraph("Modalidad y Ubicación: Presencial - Auditorio Villa 2")
doc.add_paragraph("Aforo / Capacidad Estimada: 80")
doc.add_paragraph("Enlace de Participantes / Equipo (Excel/Sheets): N/A")

doc.add_paragraph("2. JUSTIFICACIÓN Y OBJETIVOS")
doc.add_paragraph(
    "Resumen Ejecutivo / Alcance: Seminario para fortalecer las habilidades "
    "de liderazgo del equipo de Proyectos Especiales."
)
doc.add_paragraph("Objetivo General: Desarrollar habilidades de liderazgo en el equipo PE.")
doc.add_paragraph("Objetivos Específicos:")
doc.add_paragraph("Alinear al equipo en torno a un estilo de liderazgo común")
doc.add_paragraph("Identificar a los próximos coordinadores de área")

doc.add_paragraph("3. PLANIFICACIÓN Y LOGÍSTICA")
doc.add_paragraph("Cronograma / Agenda de Actividades:")
doc.add_paragraph("09:00 - Registro de asistentes")
doc.add_paragraph("09:30 - Charla principal")
doc.add_paragraph("Recursos y Materiales Requeridos: Proyector, micrófono inalámbrico, coffee break.")
doc.add_paragraph('Presupuesto Estimado: S/. 800 - alquiler de equipo y coffee break.')
doc.add_paragraph("Plan de Difusión (Solo si aplica): Publicación en redes 1 semana antes.")

doc.add_paragraph("4. CONTROL OPERATIVO")
doc.add_paragraph("Métricas de Éxito (KPIs Objetivo):")
doc.add_paragraph("Asistencia mínima: 25 pax")
doc.add_paragraph("Nivel de satisfacción: >80%")
doc.add_paragraph("Riesgos y Plan de Contingencia:")
doc.add_paragraph("Riesgo 1: Baja asistencia -> Mitigación: Recordatorios por correo y redes")
doc.add_paragraph("Riesgo 2: Falla del auditorio -> Mitigación: Sala alterna reservada")

doc.add_paragraph("5. VALIDACIÓN Y CIERRE")
doc.add_paragraph("Fecha de Entrega de Acta: 12/10/2026")
doc.add_paragraph("Firma/Aprobación del Responsable: Nick Huaranga")

ruta = "Ingestor/documentos/acta_prueba.docx"
doc.save(ruta)
print(f"Archivo Word real generado con éxito en: {ruta}")
