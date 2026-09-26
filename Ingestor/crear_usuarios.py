"""Carga masiva de cuentas de CINERGIA OS desde un CSV.

Uso:
    python crear_usuarios.py usuarios.csv

Formato del CSV, con encabezado:
    dni,nombre,area_asignada,rol
    71234567,Nombre Apellido,Eventos,Editor

Áreas válidas: Eventos, Marketing, Proyectos, Gestión de Oportunidades, Reportes.
Roles válidos: SuperAdmin, Editor, Lector.

Cada cuenta ingresa por primera vez con su DNI como usuario y contraseña, y la
aplicación le exige definir un usuario y una contraseña propios.

El archivo usuarios.csv contiene datos personales: no se sube al repositorio.
"""

import csv
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

from cuentas import ErrorCuenta, crear_cuenta

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / "credenciales.env")


def main() -> int:
    ruta = Path(sys.argv[1]) if len(sys.argv) > 1 else BASE_DIR / "usuarios.csv"
    if not ruta.exists():
        print(f"No se encontró el archivo {ruta}.")
        return 1

    url = os.environ.get("SUPABASE_URL")
    clave = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not clave:
        print("credenciales.env debe definir SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.")
        return 1
    supabase = create_client(url, clave)

    creadas, errores = 0, 0
    with ruta.open(encoding="utf-8-sig", newline="") as f:
        for n, fila in enumerate(csv.DictReader(f), start=2):
            try:
                crear_cuenta(supabase, fila.get("dni", ""), fila.get("nombre", ""),
                             fila.get("area_asignada", ""), fila.get("rol", ""))
                creadas += 1
                print(f"Fila {n}: cuenta creada para {fila.get('nombre', '').strip()}.")
            except ErrorCuenta as e:
                errores += 1
                print(f"Fila {n}: {e}")

    print(f"\nCuentas creadas: {creadas} · Filas con error: {errores}")
    return 0 if errores == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
