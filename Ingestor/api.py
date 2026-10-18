import hmac
import os
import sys
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import Client, create_client

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

import instagram  # noqa: E402
from actas import ErrorActa, leer_acta  # noqa: E402
from cuentas import ErrorCuenta, actualizar_cuenta, crear_cuenta, restablecer_credenciales  # noqa: E402
from registro import registrar  # noqa: E402

# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------
load_dotenv(BASE_DIR / "credenciales.env")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError(
        "Faltan credenciales: credenciales.env debe definir SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY."
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

app = FastAPI(title="Cinergia API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

TAMANO_MAXIMO_ACTA = 15 * 1024 * 1024

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
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/api/upload-acta")
def upload_acta(
    file: UploadFile = File(...),
    estado_actual: str = Form("Planificación Base"),
    enlace_excel: str | None = Form(None),
    modo_estricto: bool = Form(True),
    perfil: dict = Depends(requiere_editor),
):
    if not file.filename.lower().endswith((".docx", ".pdf")):
        raise HTTPException(status_code=400, detail="Formato inválido. Solo se admiten archivos .docx o .pdf.")
    contenido = file.file.read(TAMANO_MAXIMO_ACTA + 1)
    if len(contenido) > TAMANO_MAXIMO_ACTA:
        raise HTTPException(status_code=413, detail="El archivo supera los 15 MB.")

    try:
        acta = leer_acta(file.filename, contenido)
    except ErrorActa as e:
        raise HTTPException(status_code=400, detail=str(e))

    if modo_estricto and acta.faltantes:
        raise HTTPException(
            status_code=400,
            detail=f"Acta rechazada por Modo Estricto. Campos faltantes o sin completar: {', '.join(acta.faltantes)}.",
        )

    try:
        r = registrar(
            supabase, acta, estado=estado_actual, contenido=contenido, nombre_archivo=file.filename,
            enlace_excel=enlace_excel,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al registrar el acta: {e}")

    mensajes = {
        "creado": "Acta procesada y proyecto registrado.",
        "actualizado": "El proyecto ya existía; se actualizó con los datos del acta.",
        "sin_cambios": "Este archivo ya estaba cargado. No se hicieron cambios.",
    }
    return {
        "status": "success",
        "message": mensajes[r.accion],
        "data": {
            "id": r.id,
            "nombre": r.nombre,
            "area": acta.area,
            "responsable": acta.responsable,
            "accion": r.accion,
            "metas": acta.metas,
            "riesgos": len(acta.riesgos),
            "hitos_creados": r.compromisos_nuevos,
            "campos_faltantes": acta.faltantes,
            "avisos": r.avisos,
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


# ---------------------------------------------------------------------------
# Instagram
# ---------------------------------------------------------------------------
CRON_SECRET = os.environ.get("CRON_SECRET", "")
LARGO_MINIMO_CRON_SECRET = 20
INTERVALO_MINIMO_MANUAL = timedelta(minutes=5)
_candado_instagram = threading.Lock()


class TokenInstagram(BaseModel):
    access_token: str


def _sincronizar_con_candado() -> dict:
    """Ejecuta la sincronización; los fallos quedan guardados en el estado de la conexión."""
    with _candado_instagram:
        return instagram.sincronizar(supabase).como_dict()


def _sincronizar_en_segundo_plano() -> None:
    try:
        _sincronizar_con_candado()
    except instagram.ErrorInstagram:
        pass  # el mensaje ya quedó en instagram_conexion.ultimo_error


@app.post("/api/instagram/token")
def conectar_instagram(datos: TokenInstagram, perfil: dict = Depends(requiere_superadmin)):
    try:
        resumen = instagram.conectar(supabase, datos.access_token, perfil["id"])
    except instagram.ErrorInstagram as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"status": "success", "data": resumen}


@app.delete("/api/instagram/token")
def desconectar_instagram(perfil: dict = Depends(requiere_superadmin)):
    instagram.desconectar(supabase)
    return {"status": "success"}


@app.post("/api/instagram/sincronizar", status_code=202)
def sincronizar_instagram(tareas: BackgroundTasks, perfil: dict = Depends(requiere_editor)):
    """Inicia la actualización y responde enseguida. El avance se lee en instagram_conexion."""
    filas = supabase.table("instagram_conexion").select("ultimo_intento, conectada").eq("id", 1).limit(1).execute().data
    estado = filas[0] if filas else {}
    if not estado.get("conectada"):
        raise HTTPException(status_code=409, detail="Instagram no está conectado. Un SuperAdmin debe cargar el token.")
    previo = instagram.parsear_fecha_iso(estado.get("ultimo_intento"))
    if previo and datetime.now(timezone.utc) - previo < INTERVALO_MINIMO_MANUAL:
        raise HTTPException(status_code=429, detail="Instagram se actualizó hace menos de 5 minutos. Espera un momento.")
    if _candado_instagram.locked():
        raise HTTPException(status_code=409, detail="Ya hay una actualización en curso.")
    instagram.registrar_intento(supabase)
    tareas.add_task(_sincronizar_en_segundo_plano)
    return {"status": "started"}


@app.post("/api/instagram/cron")
def sincronizar_programado(x_cron_secret: str | None = Header(None)):
    if len(CRON_SECRET) < LARGO_MINIMO_CRON_SECRET:
        raise HTTPException(status_code=503, detail="La sincronización programada no está habilitada.")
    if not x_cron_secret or not hmac.compare_digest(x_cron_secret.encode("utf-8"), CRON_SECRET.encode("utf-8")):
        raise HTTPException(status_code=401, detail="Clave no válida.")
    if _candado_instagram.locked():
        raise HTTPException(status_code=409, detail="Ya hay una actualización en curso.")
    try:
        return {"status": "success", "data": _sincronizar_con_candado()}
    except instagram.ErrorInstagram as e:
        raise HTTPException(status_code=502, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
