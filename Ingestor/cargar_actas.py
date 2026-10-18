"""Carga inicial de actas vigentes a Supabase.

Uso:
    python cargar_actas.py /ruta/a/CINERGIA                 # muestra qué se cargaría, sin escribir nada
    python cargar_actas.py /ruta/a/CINERGIA --ejecutar      # carga en Supabase

La lista de archivos está en actas_vigentes.txt: una ruta por línea, relativa a la carpeta CINERGIA,
con un estado opcional después de "|". Es seguro repetir la carga: un archivo ya cargado se omite y
un proyecto ya existente se actualiza en lugar de duplicarse.
"""
from __future__ import annotations

import argparse
import os
import sys
import unicodedata
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from actas import ActaLeida, ErrorActa, leer_acta  # noqa: E402
from registro import ETAPAS, registrar  # noqa: E402


def estado_por_carpeta(ruta_relativa: str, acta: ActaLeida) -> str:
    """Etapa inicial según la carpeta donde está el acta; los demás tipos usan lo que dice el documento."""
    ruta = ruta_relativa.lower()
    if "culminados" in ruta:
        return "Finalizado"
    if "actas en aprobaci" in ruta:
        return "Aprobación Directiva"
    if "activos" in ruta:
        return "Ejecución Activa"
    return acta.estado_sugerido or ETAPAS[0]


def leer_lista(ruta: Path) -> list[tuple[str, str | None]]:
    entradas = []
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#"):
            continue
        archivo, _, estado = linea.partition("|")
        entradas.append((archivo.strip(), estado.strip() or None))
    return entradas


def resolver(raiz: Path, relativa: str) -> Path | None:
    for forma in ("NFC", "NFD"):
        candidato = raiz / unicodedata.normalize(forma, relativa)
        if candidato.is_file():
            return candidato
    return None


def main() -> int:
    p = argparse.ArgumentParser(description="Carga inicial de actas vigentes.")
    p.add_argument("carpeta", type=Path, help="Carpeta CINERGIA que contiene EVENTOS, PROYECTOS, etc.")
    p.add_argument("--lista", type=Path, default=BASE_DIR / "actas_vigentes.txt")
    p.add_argument("--ejecutar", action="store_true", help="Escribe en Supabase. Sin esta opción solo se muestra el resultado.")
    p.add_argument("--sin-archivos", action="store_true", help="No sube los archivos al almacenamiento.")
    args = p.parse_args()

    if not args.carpeta.is_dir():
        print(f"No existe la carpeta {args.carpeta}.")
        return 2

    db = None
    if args.ejecutar:
        from dotenv import load_dotenv
        from supabase import create_client

        load_dotenv(BASE_DIR / "credenciales.env")
        url = os.environ.get("SUPABASE_URL")
        clave = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
        if not url or not clave:
            print("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en credenciales.env.")
            return 2
        db = create_client(url, clave)

    fallos = 0
    for relativa, estado_manual in leer_lista(args.lista):
        archivo = resolver(args.carpeta, relativa)
        print(f"\n{relativa}")
        if not archivo:
            print("   NO ENCONTRADO")
            fallos += 1
            continue
        contenido = archivo.read_bytes()
        try:
            acta = leer_acta(archivo.name, contenido)
        except ErrorActa as e:
            print(f"   RECHAZADO: {e}")
            fallos += 1
            continue
        estado = estado_manual or estado_por_carpeta(relativa, acta)
        if estado not in ETAPAS:
            print(f"   Estado no válido: {estado}")
            fallos += 1
            continue
        fecha = acta.fecha_programada.strftime("%d/%m/%Y") if acta.fecha_programada else "sin fecha"
        print(f"   {acta.area} | {acta.nombre}")
        print(f"   Responsable: {acta.responsable or 'sin responsable'} | Fecha: {fecha} | Aforo: {acta.aforo or '-'} | Estado: {estado}")
        print(f"   Metas: {len(acta.metas)} | Riesgos: {len(acta.riesgos)} | Compromisos: {len(acta.hitos)}")
        for aviso in acta.advertencias:
            print(f"   Aviso: {aviso}")
        if db is not None:
            try:
                r = registrar(db, acta, estado=estado, contenido=contenido, nombre_archivo=archivo.name, subir_archivo=not args.sin_archivos)
            except Exception as e:  # noqa: BLE001
                print(f"   ERROR al guardar: {e}")
                fallos += 1
                continue
            print(f"   -> {r.accion} ({r.id}), compromisos nuevos: {r.compromisos_nuevos}")

    if not args.ejecutar:
        print("\nNo se escribió nada. Revisa el resultado y vuelve a ejecutar con --ejecutar.")
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
