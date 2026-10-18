# Cinergia

Panel de gestión de Cinergia. Reúne el avance de cada área a partir de las actas oficiales y de las métricas de Instagram.

## Estructura

- `src`: aplicación web en React, Vite, Tailwind y Recharts.
- `Ingestor`: servidor FastAPI. Lee las actas, administra cuentas y sincroniza Instagram.
- `supabase`: migraciones SQL que se ejecutan en orden numérico.
- `docs`: documentación de la lectura de actas y de Instagram.

## Requisitos

- Node 20 o superior.
- Python 3.11 o superior.
- Un proyecto de Supabase con las migraciones de `supabase` aplicadas.

## Aplicación web

Crear `.env` en la raíz con `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_API_URL`.

```bash
npm install
npm run dev
npm run lint
npm run build
```

## Servidor

Crear `Ingestor/credenciales.env` con `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGINS` y `CRON_SECRET`. Este archivo no se sube al repositorio.

```bash
cd Ingestor
pip install -r requirements.txt
uvicorn api:app --reload
python -m pytest
```

## Carga de actas

Cada tipo de acta aporta datos distintos. Ver `docs/actas.md`.

La carga inicial se hace con `Ingestor/cargar_actas.py` y la lista `Ingestor/actas_vigentes.txt`. Sin `--ejecutar` solo muestra lo que leería.

```bash
python cargar_actas.py /ruta/a/CINERGIA
python cargar_actas.py /ruta/a/CINERGIA --ejecutar
```

## Instagram

Ver `docs/instagram.md`.
