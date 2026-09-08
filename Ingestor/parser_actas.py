import io
import re
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from docx import Document
from supabase import create_client, Client
import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI()

# Configuración CORS para que React pueda comunicarse con FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # En producción, restringe esto a tu dominio de Vercel
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def limpiar_texto(texto):
    """Limpia los corchetes vacíos o espacios en blanco de la plantilla"""
    if not texto:
        return ""
    return texto.replace("[", "").replace("]", "").strip()

@app.post("/api/upload-acta")
async def upload_acta(file: UploadFile = File(...)):
    if not file.filename.endswith(".docx"):
        raise HTTPException(status_code=400, detail="Formato inválido. Solo se admiten archivos .docx")

    try:
        # 1. Leer el archivo físico en memoria
        content = await file.read()
        doc = Document(io.BytesIO(content))
        
        # 2. Extraer todo el texto del documento
        full_text = "\n".join([p.text for p in doc.paragraphs])
        
        # 3. Diccionario de extracción basado ESTRICTAMENTE en la plantilla oficial
        datos_extraidos = {
            "nombre": None,
            "area": None,
            "responsable": None,
            "fecha": None,
            "sede": None,
            "staff_requerido": None # Usaremos este campo para el aforo en la BD
        }

        # 4. Expresiones Regulares (Anclas de búsqueda)
        match_nombre = re.search(r"Nombre del Proyecto:\s*(.+)", full_text, re.IGNORECASE)
        match_area = re.search(r"Área Ejecutora:\s*(.+)", full_text, re.IGNORECASE)
        match_responsable = re.search(r"Responsable Directo:\s*(.+)", full_text, re.IGNORECASE)
        match_fecha = re.search(r"Fecha de Ejecución:\s*(.+)", full_text, re.IGNORECASE)
        match_sede = re.search(r"Modalidad y Ubicación:\s*(.+)", full_text, re.IGNORECASE)
        match_aforo = re.search(r"Aforo / Capacidad Estimada:\s*(.+)", full_text, re.IGNORECASE)

        if match_nombre: datos_extraidos["nombre"] = limpiar_texto(match_nombre.group(1))
        if match_area: datos_extraidos["area"] = limpiar_texto(match_area.group(1))
        if match_responsable: datos_extraidos["responsable"] = limpiar_texto(match_responsable.group(1))
        if match_fecha: datos_extraidos["fecha"] = limpiar_texto(match_fecha.group(1))
        if match_sede: datos_extraidos["sede"] = limpiar_texto(match_sede.group(1))
        if match_aforo: datos_extraidos["staff_requerido"] = limpiar_texto(match_aforo.group(1))

        # 5. MODO ESTRICTO: Validación de cumplimiento de plantilla
        campos_faltantes = []
        for clave, valor in datos_extraidos.items():
            if not valor or valor.lower() in ["escribir el título oficial", "elegir una", "nombre completo del líder", "dd/mm/aaaa"]:
                campos_faltantes.append(clave)

        if "nombre" in campos_faltantes or "area" in campos_faltantes or "responsable" in campos_faltantes:
            raise HTTPException(
                status_code=400, 
                detail=f"Rechazado por Modo Estricto. El acta no utiliza la plantilla oficial o faltan campos obligatorios críticos: {', '.join(campos_faltantes)}."
            )

        # 6. Inyección de datos en Supabase
        # Asumimos que el estado inicial de todo proyecto nuevo importado es "Planificación"
        datos_db = {
            "nombre": datos_extraidos["nombre"],
            "area": datos_extraidos["area"],
            "responsable": datos_extraidos["responsable"],
            "estado_actual": "Planificación",
            "sede": datos_extraidos["sede"],
            "staff_requerido": datos_extraidos["staff_requerido"]
            # Nota: La columna 'fecha' en Supabase debe aceptar texto si envían "DD/MM/AAAA", o debes convertirla a Date.
        }

        respuesta_db = supabase.table("proyectos").insert(datos_db).execute()

        return {
            "message": "Acta procesada e inyectada con éxito. Cumple con el estándar operativo.", 
            "data": respuesta_db.data
        }

    except Exception as e:
        # Captura errores internos (ej. base de datos caída o archivo corrupto)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Error interno del servidor al procesar el acta: {str(e)}")