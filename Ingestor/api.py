import io
import re
import os
import uuid
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from supabase import create_client, Client
from docx import Document

# 1. Configuración Inicial
app = FastAPI(title="Cinergia OS Ingestor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Conexión a Supabase (Ruta Absoluta a Prueba de Balas)
BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / "credenciales.env"

load_dotenv(ENV_PATH)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError(f"❌ ERROR FATAL: Faltan credenciales. Verifica que {ENV_PATH} exista y tenga SUPABASE_URL y SUPABASE_KEY.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# 3. Helpers
def limpiar_texto(texto):
    """Limpia los corchetes vacíos o espacios en blanco de la plantilla"""
    if not texto:
        return ""
    return texto.replace("[", "").replace("]", "").strip()

# 4. El Endpoint Único y Definitivo
@app.post("/api/upload-acta")
async def upload_acta(file: UploadFile = File(...)):
    if not file.filename.endswith(".docx"):
        raise HTTPException(status_code=400, detail="Formato inválido. Solo se admiten archivos .docx")

    try:
        # Procesamiento rápido en memoria (Sin usar el disco duro de Render)
        content = await file.read()
        doc = Document(io.BytesIO(content))
        full_text = "\n".join([p.text for p in doc.paragraphs])
        
        # Generar ID único para el proyecto
        nuevo_id = f"PRJ-{str(uuid.uuid4())[:4].upper()}"

        datos_extraidos = {
            "nombre": None,
            "area": None,
            "responsable": None,
            "fecha": None,
            "sede": None,
            "staff_requerido": None
        }

        # Anclas de búsqueda basadas en la NUEVA PLANTILLA OFICIAL
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

        # MODO ESTRICTO: Validación implacable
        campos_faltantes = []
        for clave, valor in datos_extraidos.items():
            if not valor or valor.lower() in ["escribir el título oficial", "elegir una", "nombre completo del líder", "dd/mm/aaaa"]:
                campos_faltantes.append(clave)

        # Si faltan los datos críticos, el sistema rechaza el archivo
        if "nombre" in campos_faltantes or "area" in campos_faltantes or "responsable" in campos_faltantes:
            raise HTTPException(
                status_code=400, 
                detail=f"Rechazado por Modo Estricto. El acta no utiliza la plantilla oficial o faltan campos obligatorios críticos: {', '.join(campos_faltantes)}."
            )

        # Inyección de datos en Supabase (Tabla principal)
        supabase.table("proyectos").insert({
            "id": nuevo_id,
            "nombre": datos_extraidos["nombre"],
            "area": datos_extraidos["area"],
            "responsable": datos_extraidos["responsable"],
            "estado_actual": "Planificación",
            "sede": datos_extraidos["sede"],
            "fecha": datos_extraidos["fecha"],
            "staff_requerido": datos_extraidos["staff_requerido"]
        }).execute()

        # Inyección en la tabla de historial para alimentar el pipeline
        supabase.table("historial_etapas").insert({
            "proyecto_id": nuevo_id,
            "etapa": "Planificación Base"
        }).execute()

        return {
            "status": "success",
            "message": "Acta procesada e inyectada con éxito. Cumple con el estándar operativo.", 
            "data": datos_extraidos
        }

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Error interno del servidor al procesar el acta: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)