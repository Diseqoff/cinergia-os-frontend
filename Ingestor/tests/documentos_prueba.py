"""Construye actas sintéticas en Word y PDF para las pruebas. No contienen datos reales."""
from __future__ import annotations

import io

from docx import Document


def docx_bytes(elementos: list) -> bytes:
    """Cada elemento es un texto (párrafo) o una lista de filas (tabla)."""
    doc = Document()
    for el in elementos:
        if isinstance(el, str):
            doc.add_paragraph(el)
        else:
            tabla = doc.add_table(rows=len(el), cols=len(el[0]))
            for i, fila in enumerate(el):
                for j, texto in enumerate(fila):
                    tabla.cell(i, j).text = texto
    salida = io.BytesIO()
    doc.save(salida)
    return salida.getvalue()


def pdf_bytes(lineas: list[str]) -> bytes | None:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        from reportlab.pdfgen import canvas
    except ImportError:
        return None
    for ruta in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans.ttf"):
        try:
            pdfmetrics.registerFont(TTFont("Prueba", ruta))
            break
        except Exception:  # noqa: BLE001
            continue
    else:
        return None
    salida = io.BytesIO()
    c = canvas.Canvas(salida, pagesize=A4)
    c.setFont("Prueba", 10)
    y = 800
    for linea in lineas:
        c.drawString(40, y, linea)
        y -= 14
    c.save()
    return salida.getvalue()


def acta_evento(responsables: bool = True, fecha: str = "Sábado 17 de octubre de 2026 a las 2 pm", titulo: str = "Taller de Prueba Aplicada",
                entrega: str = "3 de agosto de 2026") -> bytes:
    elementos = [
        "ACTA DE EVENTO - CINERGIA",
        "1. Ficha de Evento",
        "N.º de Acta: EVT-2026-010",
        "2. Título del Evento",
        titulo,
        "3. Organización Responsable",
        "Área: Dirección de Comunidad y Eventos – CINERGIA UCSUR",
    ]
    if responsables:
        elementos += ["Responsables:", "Ana Prueba Uno (Directora)", "Beto Prueba Dos (Subdirector)", "Miembros del Área de Comunidad y Eventos"]
    elementos += [
        "4. Fecha de Entrega del Acta", entrega,
        "5. Resumen Ejecutivo del Evento", "Actividad de práctica dirigida a estudiantes de los primeros ciclos.",
        "7. Información General del Evento",
        f"Fecha y Hora: {fecha}",
        "Modalidad / Ubicación: Presencial / Aula 101",
        "Capacidad: 20–25 estudiantes de 1.º a 3.º ciclo",
        "8. Objetivos del Evento",
        "Objetivo General:", "Orientar a los estudiantes en sus primeros ciclos.",
        "Objetivos Específicos:", "Lograr que al menos el 60% de los asistentes participe, medido con encuesta.",
        "12. Plan de Difusión",
        "Pre-Evento:", "Publicación de banner digital y stories en redes.", "Visita a aulas por el equipo.",
        "Durante el Evento", "Cobertura fotográfica en tiempo real.",
        "Post-Evento", "Recap audiovisual del evento. Seguimiento de compromisos.",
        "13. Métricas de Éxito",
        "Asistencia: ≥ 25estudiantes", "Satisfacción: ≥ 75%", "Participación:",
        "Herramientas de Medición:", "Lista de asistencia",
        "14. Riesgos y Plan de Contingencia",
        [["Riesgo", "Probabilidad", "Impacto", "Plan de Mitigación"],
         ["Baja asistencia", "Media", "Alto", "Invitación directa"],
         ["Falla técnica", "Baja", "Medio", "Plan B sin conexión"]],
        "15. Observaciones Finales", "Ninguna.",
    ]
    return docx_bytes(elementos)


def acta_ficha() -> bytes:
    return docx_bytes([
        "FICHA DE EVENTO – CINERGIA Talks",
        "“Charla de Orientación”",
        "Organizador: Dirección de Comunidad y Eventos – CINERGIA UCSUR",
        "Responsables:", "Carla Ficha Uno", "Dario Ficha Dos",
        "Fecha de entrega: Miércoles 29 de octubre de 2025",
        "Resumen del Evento", "Conversatorio con estudiantes avanzados.",
        "Información General",
        "Fecha y hora: Miércoles 19 de noviembre a las 3:30 pm",
        "Modalidad / Ubicación: Presencial / Aula 5",
        "Capacidad: 20 estudiantes",
        "Objetivos", "General: Motivar a los asistentes.",
        "Métricas de Éxito", "Asistencia: ≥ 20 estudiantes",
    ])


def acta_proyecto(fase_dos: str = "10/10/2026") -> bytes:
    return docx_bytes([
        "ACTA DE CONSTITUCIÓN DEL PROYECTO",
        "Sistema de Prueba",
        "Título Proyecto: Sistema de Prueba",
        "Fecha de elaboración: octubre de 2026",
        "Justificación del proyecto", "Hace falta un sistema de prueba.",
        "Descripción del proyecto:", "El proyecto consistirá en construir un sistema de prueba.",
        "Riesgos del proyecto", "Retraso en la recopilación.", "Falta de equipo.",
        "Objetivo General del Proyecto", "Contar con un sistema de prueba funcionando.",
        [["Objetivos Específicos del Proyecto", "Criterios de Éxito"],
         ["Planificar el sistema", "El plan es aprobado por la directiva"]],
        "Tiempo", "Desde el 08/10/2026 (cuarto trimestre)",
        [["Resumen de Hitos", "Fecha de cumplimiento"],
         ["Fase 1: Acta del proyecto", "08/10/2026"],
         ["Fase 2: Planificación", fase_dos],
         ["Fase 3: Diseño", "12/10/2026 - 15/10/2026"],
         ["Fase 4: Desarrollo", "16/10/2026 - actualidad"],
         ["Fase 5: Pruebas", "Sujeto a confirmación de la propuesta"]],
        "Encargados del proyecto", "Apellido Uno, Nombre Uno (Líder)", "Apellido Dos, Nombre Dos",
        "Nivel de Autoridad del director del Proyecto",
    ])


def acta_propuesta() -> bytes:
    return docx_bytes([
        "ALIANZA ESTRATÉGICA CINERGIA UCSUR – Club Demo",
        "Sumilla – CINERGIA UCSUR:", "CINERGIA es la asociación estudiantil.",
        "Propósito de la Alianza:",
        "La presente propuesta tiene como objetivo formalizar un marco entre CINERGIA UCSUR (Asociación Estudiantil de Ingeniería), y Club Demo. Esta iniciativa surge de objetivos comunes.",
        "Modalidad de colaboración propuesta",
        "Por parte de CINERGIA UCSUR, se compromete a brindar los siguientes beneficios:",
        "Difusión y alcance",
        "Promoción de convocatorias de Club Demo en los canales oficiales de CINERGIA.",
        "Asignación de un espacio de 15 minutos en los eventos de CINERGIA.",
        "Por parte de Club Demo se compromete a brindar los siguientes beneficios:",
        "Difusión y alcance",
        "Publicación oficial en las redes sociales de Club Demo anunciando a CINERGIA UCSUR.",
        "Cierre", "CINERGIA propone una coordinación virtual inicial.",
        "Firmas de Conformidad", "Presidente de CINERGIA UCSUR",
    ])


def acta_convenio() -> bytes:
    return docx_bytes([
        "CONVENIO DE ALIANZA INSTITUCIONAL ENTRE CINERGIA UCSUR Y EMPRESA DEMO",
        "Conste por el presente documento el convenio, con representante identificado con DNI Nº 12345678.",
        "CLÁUSULA SEGUNDA: Objeto.",
        "El presente convenio tiene por objeto colaborar en actividades conjuntas.",
        "CLÁUSULA TERCERA: Responsabilidades.",
        "3.1 De EMPRESA DEMO:",
        "3.1.1 Presentar a EL ALIADO como aliado en sus plataformas. Contacto: demo@empresa.com",
        "3.1.2 Promocionar las oportunidades de EL ALIADO en su red de voluntarios.",
        "3.2 De EL ALIADO:",
        "3.2.1 Difundir los programas de EMPRESA DEMO ante sus colaboradores.",
        "CLÁUSULA CUARTA: Coordinación y Supervisión.",
        "Encargado: Persona Demo", "DNI: 12345678",
        "CLÁUSULA DÉCIMA: Vigencia.",
        "El presente convenio tendrá una duración de 6 meses, es decir hasta el 31 del mes de diciembre de 2026.",
        "Finalmente, se suscribe el presente Convenio en la ciudad de Lima, el 20 de Abril de 2026 en un ejemplar.",
    ])


def acta_carta() -> bytes:
    return docx_bytes([
        "COMUNIDAD DEMO", "Lima, 16 de agosto de 2026", "Señor", "Presidente de Cinergia",
        "ASUNTO: CARTA DE ALIANZA Y COLABORACIÓN ENTRE DEMOLAB Y", "CINERGIA",
        "Estimado:",
        "Para nosotros es una gran satisfacción formalizar mediante esta carta una alianza abierta de colaboración.",
    ])
