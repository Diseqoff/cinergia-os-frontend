import os
import re
import glob
import pdfplumber
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

# 1. Configuración de Entorno
load_dotenv()
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Faltan SUPABASE_URL o SUPABASE_KEY en el archivo .env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# 2. Funciones de Normalización y Extracción Flexible
def normalizar_fecha(texto):
    """Detecta fechas en formatos comunes (YYYY-MM-DD, DD/MM/YYYY, etc.) y devuelve YYYY-MM-DD."""
    patron_iso = r"\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b"
    patron_latam = r"\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b"
    
    coincidencia_iso = re.search(patron_iso, texto)
    if coincidencia_iso:
        y, m, d = coincidencia_iso.groups()
        return f"{y}-{int(m):02d}-{int(d):02d}"
        
    coincidencia_latam = re.search(patron_latam, texto)
    if coincidencia_latam:
        d, m, y = coincidencia_latam.groups()
        return f"{y}-{int(m):02d}-{int(d):02d}"
        
    return datetime.today().strftime("%Y-%m-%d")

def inferir_area(texto):
    """Determina el ID_Area según palabras clave en el contenido."""
    t = texto.lower()
    if any(k in t for k in ["evento", "taller", "conferencia", "sede", "aforo", "sctr"]):
        return 1  # Eventos
    elif any(k in t for k in ["marketing", "campaña", "redes", "publicidad", "merch"]):
        return 2  # Marketing
    elif any(k in t for k in ["proyecto", "investigación", "desarrollo", "software"]):
        return 3  # Proyectos / Investigación
    return 4      # Gestión / Otros

def extraer_datos_flexibles(texto_crudo, nombre_archivo):
    """Extrae campos esenciales usando patrones contextuales tolerantes a variaciones."""
    # 1. ID de Proyecto
    match_id = re.search(r"\b([A-Z]{3}-\d{4}-\d{3})\b", texto_crudo)
    id_proyecto = match_id.group(1) if match_id else f"PRJ-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    # 2. Nombre del Proyecto
    match_nombre = re.search(r"(?:nombre(?: del proyecto)?|proyecto|título)[\s:]+([^\n\r]+)", texto_crudo, re.IGNORECASE)
    if match_nombre:
        nombre = match_nombre.group(1).strip()
    else:
        # Si no encuentra etiqueta, usa el nombre del archivo limpio
        nombre = os.path.splitext(os.path.basename(nombre_archivo))[0].replace("_", " ").title()

    # 3. Estado de Flujo (Validado contra los valores del CHECK en base de datos)
    estado = "Planificación"
    t_lower = texto_crudo.lower()
    if "ejecución" in t_lower or "ejecucion" in t_lower or "en curso" in t_lower:
        estado = "En Ejecución"
    elif "finalizado" in t_lower or "concluido" in t_lower or "completado" in t_lower:
        estado = "Finalizado"
    elif "ideación" in t_lower or "ideacion" in t_lower:
        estado = "Ideación"

    # 4. Fecha de Lanzamiento
    fecha = normalizar_fecha(texto_crudo)

    # 5. ID de Área
    id_area = inferir_area(texto_crudo)

    # 6. Presupuesto y Gastos
    match_presupuesto = re.search(r"(?:presupuesto(?: proyectado| aprobado)?|costo|monto)[\s:]*(?:S/\.?|\$)?\s*([\d,.]+)", texto_crudo, re.IGNORECASE)
    presupuesto = 0.0
    if match_presupuesto:
        valor_limpio = match_presupuesto.group(1).replace(",", "")
        try:
            presupuesto = float(valor_limpio)
        except ValueError:
            presupuesto = 0.0

    # 7. Aforo y Sede (Satélite Eventos)
    match_aforo = re.search(r"(?:aforo(?: máximo)?|capacidad|asistentes)[\s:]*(\d+)", texto_crudo, re.IGNORECASE)
    aforo = int(match_aforo.group(1)) if match_aforo else None

    match_sede = re.search(r"(?:sede|ubicación|lugar)[\s:]+([^\n\r]+)", texto_crudo, re.IGNORECASE)
    sede = match_sede.group(1).strip() if match_sede else "Virtual"

    return {
        "id_proyecto": id_proyecto,
        "id_area": id_area,
        "nombre_proyecto": nombre,
        "estado_flujo": estado,
        "fecha_lanzamiento": fecha,
        "presupuesto": presupuesto,
        "aforo": aforo,
        "sede": sede
    }

# 3. Inserción a la Base de Datos
def insertar_en_supabase(datos):
    print(f"[*] Inyectando en base de datos: {datos['id_proyecto']} - {datos['nombre_proyecto']}")
    try:
        # A. Núcleo: proyectos_main
        payload_main = {
            "id_proyecto": datos["id_proyecto"],
            "id_area": datos["id_area"],
            "nombre_proyecto": datos["nombre_proyecto"],
            "estado_flujo": datos["estado_flujo"],
            "fecha_lanzamiento": datos["fecha_lanzamiento"]
        }
        res_main = supabase.table("proyectos_main").upsert(payload_main).execute()

        # B. Finanzas: finanzas_proyectos
        payload_finanzas = {
            "id_proyecto": datos["id_proyecto"],
            "presupuesto_proyectado": datos["presupuesto"],
            "gasto_real": 0.00,
            "fuente_financiamiento": "Presupuesto Operativo"
        }
        supabase.table("finanzas_proyectos").upsert(payload_finanzas).execute()

        # C. Satélite Eventos (si aplica)
        if datos["id_area"] == 1 or datos["aforo"] is not None:
            payload_eventos = {
                "id_proyecto": datos["id_proyecto"],
                "sede_principal": datos["sede"],
                "capacidad_max_aforo": datos["aforo"] if datos["aforo"] else 0,
                "requiere_sctr": False,
                "estatus_sctr": "No Aplica"
            }
            supabase.table("detalle_eventos").upsert(payload_eventos).execute()

        print(f"[+] Ingesta exitosa para: {datos['id_proyecto']}")
        return True

    except Exception as err:
        print(f"[-] ERROR en transacción Supabase: {err}")
        return False

# 4. Pipeline Principal de Ingesta Masiva
def procesar_directorio_documentos(directorio="documentos"):
    archivos = glob.glob(os.path.join(directorio, "*.pdf"))
    if not archivos:
        print(f"[!] No se encontraron archivos PDF en la carpeta '{directorio}/'")
        return

    print(f"[*] Se encontraron {len(archivos)} documentos para procesar.\n")

    for ruta in archivos:
        print(f"--- Procesando: {os.path.basename(ruta)} ---")
        texto_acumulado = ""
        try:
            with pdfplumber.open(ruta) as pdf:
                for pagina in pdf.pages:
                    texto_extraido = pagina.extract_text()
                    if texto_extraido:
                        texto_acumulado += texto_extraido + "\n"
        except Exception as e:
            print(f"[-] Error al leer {ruta}: {e}")
            continue

        if not texto_acumulado.strip():
            print(f"[-] Documento vacío o sin capa de texto legible: {ruta}")
            continue

        datos_procesados = extraer_datos_flexibles(texto_acumulado, ruta)
        insertar_en_supabase(datos_procesados)
        print()

if __name__ == "__main__":
    print("=== MOTOR DE INGESTA AUTOMÁTICA CINERGIA ===")
    procesar_directorio_documentos("documentos")