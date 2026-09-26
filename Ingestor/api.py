import hashlib
import io
import os
import re
import unicodedata
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from docx import Document
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import Client, create_client

from cuentas import ErrorCuenta, actualizar_cuenta, crear_cuenta, restablecer_credenciales

# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / "credenciales.env")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError(
        "Faltan credenciales: credenciales.env debe definir SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY."
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

app = FastAPI(title="Cinergia OS Ingestor API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

ETAPAS = ["Planificación Base", "Aprobación Directiva", "Ejecución Activa", "Revisión / QA", "Cierre Operativo"]
AREAS = ["Eventos", "Marketing", "Proyectos", "Gestión de Oportunidades", "Reportes"]
MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
ZONA_LIMA = timezone(timedelta(hours=-5))
MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

PLACEHOLDERS = [
    "escribir el título oficial", "elegir una", "nombre completo del líder", "dd/mm/aaaa",
    "número de personas", "pegar url aquí", "ej. presencial",
]

# ---------------------------------------------------------------------------
# Autenticación y permisos
# ---------------------------------------------------------------------------

def usuario_actual(authorization: str | None = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Sesión requerida.")
    token = authorization.split(" ", 1)[1].strip()
    try:
        respuesta = supabase.auth.get_user(token)
        usuario = respuesta.user
    except Exception:
        raise HTTPException(status_code=401, detail="Sesión no válida o expirada.")
    if not usuario:
        raise HTTPException(status_code=401, detail="Sesión no válida o expirada.")

    perfil = supabase.table("usuarios_directiva").select("id, nombre, rol, activo").eq("id", usuario.id).limit(1).execute()
    if not perfil.data or not perfil.data[0].get("activo"):
        raise HTTPException(status_code=403, detail="La cuenta no tiene acceso activo.")
    return perfil.data[0]


def requiere_editor(perfil: dict = Depends(usuario_actual)) -> dict:
    if perfil.get("rol") not in ("Editor", "SuperAdmin"):
        raise HTTPException(status_code=403, detail="Se requiere rol Editor o SuperAdmin.")
    return perfil


def requiere_superadmin(perfil: dict = Depends(usuario_actual)) -> dict:
    if perfil.get("rol") != "SuperAdmin":
        raise HTTPException(status_code=403, detail="Se requiere rol SuperAdmin.")
    return perfil

# ---------------------------------------------------------------------------
# Lectura del acta
# ---------------------------------------------------------------------------

def limpiar_texto(texto: str | None) -> str:
    if not texto:
        return ""
    return texto.replace("[", "").replace("]", "").strip()


def es_placeholder(valor: str) -> bool:
    v = (valor or "").strip().lower()
    return not v or any(p in v for p in PLACEHOLDERS)


def sin_acentos(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn").lower()


def normalizar_area(valor: str) -> str | None:
    clave = sin_acentos(valor or "")
    for area in AREAS:
        if sin_acentos(area) in clave:
            return area
    return None


def texto_del_documento(doc: Document) -> str:
    lineas = [p.text for p in doc.paragraphs]
    for tabla in doc.tables:
        for fila in tabla.rows:
            for celda in fila.cells:
                lineas.extend(p.text for p in celda.paragraphs)
    return "\n".join(lineas)


def campo(texto: str, etiqueta: str) -> str:
    m = re.search(rf"{etiqueta}\s*:\s*(.+)", texto, re.IGNORECASE)
    valor = limpiar_texto(m.group(1)) if m else ""
    return "" if es_placeholder(valor) else valor


def bloque(texto: str, inicio: str, fin: str) -> list[str]:
    m = re.search(rf"{inicio}\s*:?(.*?)(?={fin}|\Z)", texto, re.IGNORECASE | re.DOTALL)
    if not m:
        return []
    return [l.strip().strip("*-•").strip() for l in m.group(1).split("\n") if l.strip()]


def parsear_fecha(valor: str) -> date | None:
    m = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", valor or "")
    if not m:
        return None
    try:
        return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
    except ValueError:
        return None


def fecha_legible(d: date | None) -> str | None:
    return f"{d.day:02d} {MESES_CORTOS[d.month - 1]} {d.year}" if d else None


def extraer_metas(texto: str) -> list[dict]:
    metas = []
    for linea in bloque(texto, r"Métricas de Éxito \(KPIs Objetivo\)", r"Riesgos y Plan de Contingencia"):
        linea = re.sub(r"\(Ej\..*?\)", "", linea, flags=re.IGNORECASE)
        for parte in linea.split("|"):
            parte = limpiar_texto(parte)
            if ":" not in parte:
                continue
            nombre, valor = [x.strip() for x in parte.split(":", 1)]
            if not nombre or not valor or nombre.lower().startswith("métrica") or valor.lower().startswith("valor esperado"):
                continue
            metas.append({"metrica": nombre, "objetivo": valor})
    return metas


def extraer_riesgos(texto: str) -> list[dict]:
    riesgos = []
    for linea in bloque(texto, r"Riesgos y Plan de Contingencia", r"5\.\s*VALIDACI[ÓO]N Y CIERRE"):
        m = re.match(r"Riesgo\s*\d*\s*:\s*(.+?)\s*(?:->|→)\s*Mitigaci[óo]n\s*:\s*(.+)", linea, re.IGNORECASE)
        if not m:
            continue
        riesgo, mitigacion = limpiar_texto(m.group(1)), limpiar_texto(m.group(2))
        if riesgo.lower().startswith("describir riesgo"):
            continue
        riesgos.append({"riesgo": riesgo, "mitigacion": mitigacion})
    return riesgos


def extraer_cronograma(texto: str, fecha_base: date | None) -> list[dict]:
    actividades = []
    for linea in bloque(texto, r"Cronograma / Agenda de Actividades", r"Recursos y Materiales Requeridos"):
        m = re.match(r"(.+?)\s+[-–]\s+(.+)", linea)
        if not m:
            continue
        cuando, actividad = limpiar_texto(m.group(1)), limpiar_texto(m.group(2))
        if not actividad or actividad.lower() == "actividad" or cuando.lower().startswith("hora/fecha"):
            continue
        dia = parsear_fecha(cuando) or fecha_base
        hora = re.search(r"(\d{1,2}):(\d{2})", cuando)
        limite = None
        if dia:
            h, mi = (int(hora.group(1)), int(hora.group(2))) if hora else (23, 59)
            limite = datetime(dia.year, dia.month, dia.day, h, mi, tzinfo=ZONA_LIMA).isoformat()
        actividades.append({"descripcion": actividad, "fecha_limite": limite})
    return actividades


def entero(valor: str) -> int | None:
    digitos = re.sub(r"\D", "", valor or "")
    return int(digitos) if digitos and len(digitos) <= 6 else None


def nuevo_id_proyecto() -> str:
    for _ in range(10):
        candidato = f"PRJ-{uuid.uuid4().hex[:4].upper()}"
        existe = supabase.table("proyectos").select("id").eq("id", candidato).limit(1).execute()
        if not existe.data:
            return candidato
    raise HTTPException(status_code=500, detail="No se pudo generar un identificador de proyecto.")

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/api/upload-acta")
async def upload_acta(
    file: UploadFile = File(...),
    estado_actual: str = Form("Planificación Base"),
    enlace_excel: str | None = Form(None),
    modo_estricto: bool = Form(True),
    perfil: dict = Depends(requiere_editor),
):
    if not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Formato inválido. Solo se admiten archivos .docx.")
    if estado_actual not in ETAPAS:
        estado_actual = ETAPAS[0]

    try:
        contenido = await file.read()
        texto = texto_del_documento(Document(io.BytesIO(contenido)))
    except Exception:
        raise HTTPException(status_code=400, detail="El archivo no es un documento Word válido.")

    nombre = campo(texto, r"Nombre del Proyecto")
    area_texto = campo(texto, r"Área Ejecutora")
    area = normalizar_area(area_texto)
    responsable = campo(texto, r"Responsable Directo")
    fecha_texto = campo(texto, r"Fecha de Ejecución")
    fecha_programada = parsear_fecha(fecha_texto)
    sede = campo(texto, r"Modalidad y Ubicación")
    aforo_texto = campo(texto, r"Aforo / Capacidad Estimada")
    enlace_acta = campo(texto, r"Enlace de Participantes.*?")
    objetivo_general = campo(texto, r"Objetivo General")
    presupuesto = campo(texto, r"Presupuesto Estimado")
    resumen_lineas = bloque(texto, r"Resumen Ejecutivo / Alcance", r"Objetivo General")
    resumen = limpiar_texto(" ".join(resumen_lineas))
    if es_placeholder(resumen) or resumen.lower().startswith("explicar en un párrafo"):
        resumen = ""

    faltantes = []
    if not nombre:
        faltantes.append("Nombre del Proyecto")
    if not area:
        faltantes.append("Área Ejecutora")
    if not responsable:
        faltantes.append("Responsable Directo")

    if modo_estricto and faltantes:
        raise HTTPException(
            status_code=400,
            detail=f"Acta rechazada por Modo Estricto. Campos faltantes o sin completar: {', '.join(faltantes)}.",
        )
    if not area:
        raise HTTPException(status_code=400, detail="El Área Ejecutora es obligatoria para calcular los KPIs.")
    nombre = nombre or Path(file.filename).stem.replace("_", " ")
    responsable = responsable or "Por asignar"

    enlace = enlace_excel or (enlace_acta if enlace_acta and enlace_acta.upper() != "N/A" else None)
    metas = extraer_metas(texto)
    riesgos = extraer_riesgos(texto)
    cronograma = extraer_cronograma(texto, fecha_programada)

    proyecto_id = nuevo_id_proyecto()
    ruta_archivo = f"{proyecto_id}_{re.sub(r'[^A-Za-z0-9._-]', '_', file.filename)}"

    try:
        supabase.storage.from_("actas").upload(
            path=ruta_archivo, file=contenido, file_options={"content-type": MIME_DOCX}
        )
        archivo_url = supabase.storage.from_("actas").get_public_url(ruta_archivo)

        supabase.table("proyectos").insert({
            "id": proyecto_id,
            "nombre": nombre,
            "area": area,
            "responsable": responsable,
            "estado_actual": estado_actual,
            "sede": sede or None,
            "fecha": fecha_legible(fecha_programada) or (fecha_texto or None),
            "fecha_programada": fecha_programada.isoformat() if fecha_programada else None,
            "staff_requerido": aforo_texto or None,
            "aforo_estimado": entero(aforo_texto),
            "resumen": resumen or None,
            "objetivo_general": objetivo_general or None,
            "presupuesto": presupuesto or None,
            "enlace_excel": enlace,
            "metas": metas,
            "riesgos": riesgos,
            "compromisos": [r["mitigacion"] for r in riesgos],
            "archivo_url": archivo_url,
            "archivo_hash": hashlib.sha256(contenido).hexdigest(),
        }).execute()

        if cronograma:
            supabase.table("compromisos").insert([
                {
                    "proyecto_id": proyecto_id,
                    "descripcion": a["descripcion"],
                    "tipo": "hito",
                    "area": area,
                    "responsable": responsable,
                    "fecha_limite": a["fecha_limite"],
                    "completado": False,
                }
                for a in cronograma
            ]).execute()

        supabase.rpc("registrar_etapa", {"p_proyecto": proyecto_id, "p_etapa": estado_actual}).execute()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al registrar el acta: {e}")

    return {
        "status": "success",
        "message": "Acta procesada y proyecto registrado.",
        "data": {
            "id": proyecto_id,
            "nombre": nombre,
            "area": area,
            "responsable": responsable,
            "metas": metas,
            "riesgos": len(riesgos),
            "hitos_creados": len(cronograma),
            "campos_faltantes": faltantes,
        },
    }


class NuevaCuenta(BaseModel):
    dni: str
    nombre: str
    area_asignada: str
    rol: str


class CambioCuenta(BaseModel):
    rol: str | None = None
    activo: bool | None = None


@app.post("/api/admin/usuarios")
def crear_usuario(datos: NuevaCuenta, perfil: dict = Depends(requiere_superadmin)):
    try:
        cuenta = crear_cuenta(supabase, datos.dni, datos.nombre, datos.area_asignada, datos.rol)
    except ErrorCuenta as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"status": "success", "data": {k: v for k, v in cuenta.items() if k != "dni"}}


@app.patch("/api/admin/usuarios/{usuario_id}")
def modificar_usuario(usuario_id: str, datos: CambioCuenta, perfil: dict = Depends(requiere_superadmin)):
    if usuario_id == perfil["id"] and (datos.activo is False or (datos.rol and datos.rol != "SuperAdmin")):
        raise HTTPException(status_code=400, detail="No es posible retirar el acceso o el rol a la propia cuenta.")
    try:
        actualizar_cuenta(supabase, usuario_id, rol=datos.rol, activo=datos.activo)
    except ErrorCuenta as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"status": "success"}


@app.post("/api/admin/usuarios/{usuario_id}/restablecer")
def restablecer_usuario(usuario_id: str, perfil: dict = Depends(requiere_superadmin)):
    try:
        restablecer_credenciales(supabase, usuario_id)
    except ErrorCuenta as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"status": "success"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
