"""Gestión de cuentas de CINERGIA OS sobre Supabase Auth.

Cada integrante tiene una cuenta con correo interno <DNI>@cinergia.local y
su DNI como contraseña inicial. En el primer ingreso la aplicación obliga a
definir un usuario y una contraseña propios.

Requiere un cliente de Supabase creado con la service role key.
"""

import re

DOMINIO_INTERNO = "cinergia.local"
ROLES_VALIDOS = {"SuperAdmin", "Editor", "Lector"}
AREAS_VALIDAS = {"Eventos", "Marketing", "Proyectos", "Gestión de Oportunidades", "Reportes"}
BLOQUEO_INDEFINIDO = "876000h"


class ErrorCuenta(Exception):
    pass


def correo_interno(dni: str) -> str:
    return f"{dni}@{DOMINIO_INTERNO}"


def validar_datos(dni: str, nombre: str, area: str, rol: str) -> None:
    if not re.fullmatch(r"\d{8}", dni or ""):
        raise ErrorCuenta("El DNI debe tener 8 dígitos.")
    if not (nombre or "").strip():
        raise ErrorCuenta("El nombre es obligatorio.")
    if area not in AREAS_VALIDAS:
        raise ErrorCuenta(f"Área no válida: {area}.")
    if rol not in ROLES_VALIDOS:
        raise ErrorCuenta(f"Rol no válido: {rol}.")


def crear_cuenta(supabase, dni: str, nombre: str, area: str, rol: str) -> dict:
    dni = (dni or "").strip()
    nombre = (nombre or "").strip()
    area = (area or "").strip()
    rol = (rol or "").strip()
    validar_datos(dni, nombre, area, rol)

    existente = supabase.table("usuarios_directiva").select("id").eq("dni", dni).limit(1).execute()
    if existente.data:
        raise ErrorCuenta(f"Ya existe una cuenta con el DNI {dni}.")

    try:
        respuesta = supabase.auth.admin.create_user({
            "email": correo_interno(dni),
            "password": dni,
            "email_confirm": True,
            "user_metadata": {"nombre": nombre},
        })
    except Exception as e:
        raise ErrorCuenta(f"No se pudo crear la cuenta de acceso: {e}") from e

    usuario_id = respuesta.user.id
    perfil = {
        "id": usuario_id,
        "nombre": nombre,
        "area_asignada": area,
        "rol": rol,
        "dni": dni,
        "debe_cambiar_credenciales": True,
        "activo": True,
    }
    try:
        supabase.table("usuarios_directiva").insert(perfil).execute()
    except Exception as e:
        supabase.auth.admin.delete_user(usuario_id)
        raise ErrorCuenta(f"No se pudo registrar el perfil: {e}") from e

    return perfil


def actualizar_cuenta(supabase, usuario_id: str, rol: str | None = None, activo: bool | None = None) -> None:
    cambios = {}
    if rol is not None:
        if rol not in ROLES_VALIDOS:
            raise ErrorCuenta(f"Rol no válido: {rol}.")
        cambios["rol"] = rol
    if activo is not None:
        cambios["activo"] = activo
        supabase.auth.admin.update_user_by_id(
            usuario_id, {"ban_duration": "none" if activo else BLOQUEO_INDEFINIDO}
        )
    if cambios:
        supabase.table("usuarios_directiva").update(cambios).eq("id", usuario_id).execute()


def restablecer_credenciales(supabase, usuario_id: str) -> None:
    fila = supabase.table("usuarios_directiva").select("dni").eq("id", usuario_id).limit(1).execute()
    if not fila.data or not fila.data[0].get("dni"):
        raise ErrorCuenta("La cuenta no tiene DNI registrado.")
    dni = fila.data[0]["dni"]
    supabase.auth.admin.update_user_by_id(usuario_id, {"password": dni})
    supabase.table("usuarios_directiva").update({"debe_cambiar_credenciales": True}).eq("id", usuario_id).execute()
