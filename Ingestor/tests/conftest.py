"""Entorno común de las pruebas: credenciales ficticias y ruta del código."""
import os
import sys
from pathlib import Path

os.environ.setdefault("SUPABASE_URL", "https://proyecto.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.firma")
os.environ["CRON_SECRET"] = "secreto-cron-de-prueba"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))
