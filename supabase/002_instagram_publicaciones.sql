-- =====================================================================
-- CINERGIA OS · Migración 002
-- Publicaciones de Marketing, métricas diarias de Instagram y conexión
--
-- Requiere haber ejecutado antes la migración 001.
-- Ejecutar completo, una sola vez, en Supabase > SQL Editor.
-- Es re-ejecutable: usa IF NOT EXISTS / OR REPLACE donde corresponde.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. PUBLICACIONES · una fila por pieza publicada o planificada
--    origen 'instagram': la crea la sincronización automática
--    origen 'manual': la registra el equipo desde el formulario
--    Una publicación manual con enlace se fusiona con la de Instagram
--    cuando la sincronización encuentra el mismo código de publicación.
-- ---------------------------------------------------------------------
create table if not exists public.publicaciones (
  id uuid primary key default gen_random_uuid(),
  origen text not null default 'manual' check (origen in ('instagram', 'manual')),
  estado text not null default 'publicada' check (estado in ('planificada', 'publicada')),
  ig_media_id text unique,
  codigo text unique,
  enlace text,
  titulo text,
  descripcion text,
  formato text check (formato in ('imagen', 'carrusel', 'video', 'reel')),
  categoria text check (categoria in ('evento', 'convocatoria', 'resultado', 'institucional', 'otro')),
  proyecto_id text references public.proyectos(id) on delete set null,
  fecha_planificada date,
  fecha_publicacion timestamptz,
  alcance integer check (alcance >= 0),
  vistas integer check (vistas >= 0),
  me_gusta integer check (me_gusta >= 0),
  comentarios integer check (comentarios >= 0),
  compartidos integer check (compartidos >= 0),
  guardados integer check (guardados >= 0),
  interacciones integer check (interacciones >= 0),
  metricas_actualizadas timestamptz,
  registrado_por uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint publicaciones_publicada_con_fecha check (estado = 'planificada' or fecha_publicacion is not null)
);

create index if not exists publicaciones_fecha_idx on public.publicaciones (fecha_publicacion desc);
create index if not exists publicaciones_proyecto_idx on public.publicaciones (proyecto_id);
create index if not exists publicaciones_planificada_idx on public.publicaciones (fecha_planificada);

create or replace function public.publicaciones_antes_de_guardar()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.interacciones is null
     and (new.me_gusta is not null or new.comentarios is not null
          or new.compartidos is not null or new.guardados is not null) then
    new.interacciones := coalesce(new.me_gusta, 0) + coalesce(new.comentarios, 0)
                       + coalesce(new.compartidos, 0) + coalesce(new.guardados, 0);
  end if;
  if new.enlace is not null and new.codigo is null then
    new.codigo := substring(new.enlace from '/(?:p|reel|reels|tv)/([A-Za-z0-9_-]+)');
  end if;
  return new;
end $$;

drop trigger if exists publicaciones_guardar on public.publicaciones;
create trigger publicaciones_guardar
  before insert or update on public.publicaciones
  for each row execute function public.publicaciones_antes_de_guardar();

-- ---------------------------------------------------------------------
-- 2. MÉTRICAS DIARIAS DE LA CUENTA · una fila por día
--    Las escribe la sincronización; las gráficas de seguidores y
--    alcance se calculan desde aquí.
-- ---------------------------------------------------------------------
create table if not exists public.instagram_diario (
  fecha date primary key,
  seguidores integer check (seguidores >= 0),
  alcance integer check (alcance >= 0),
  vistas integer check (vistas >= 0),
  interacciones integer check (interacciones >= 0),
  nuevos_seguidores integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. CONEXIÓN CON INSTAGRAM
--    instagram_conexion: estado visible para el equipo, sin secretos.
--    instagram_credenciales: guarda el token y solo la lee el servidor.
-- ---------------------------------------------------------------------
create table if not exists public.instagram_conexion (
  id smallint primary key default 1 check (id = 1),
  ig_user_id text,
  usuario text,
  conectada boolean not null default false,
  token_expira timestamptz,
  ultima_sincronizacion timestamptz,
  ultimo_intento timestamptz,
  ultimo_error text,
  publicaciones_sincronizadas integer not null default 0,
  conectada_por uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.instagram_conexion add column if not exists ultimo_intento timestamptz;

insert into public.instagram_conexion (id) values (1) on conflict (id) do nothing;

create table if not exists public.instagram_credenciales (
  id smallint primary key default 1 check (id = 1),
  access_token text not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. CIERRES DE EVENTO · datos del embudo de difusión a asistencia
-- ---------------------------------------------------------------------
alter table public.cierres_evento
  add column if not exists inscritos integer check (inscritos >= 0),
  add column if not exists participantes_totales integer check (participantes_totales >= 0),
  add column if not exists respuestas_encuesta integer check (respuestas_encuesta >= 0),
  add column if not exists meta_asistencia integer check (meta_asistencia >= 0),
  add column if not exists fuentes_difusion jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------
-- 5. SEGURIDAD POR FILAS
--    Publicaciones: leen usuarios activos, escriben Editor y SuperAdmin.
--    Métricas diarias y estado de conexión: solo lectura desde la app;
--    las escribe el servidor con la clave de servicio.
--    Credenciales: ninguna política ni permiso para la app.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  p record;
begin
  foreach t in array array['publicaciones', 'instagram_diario', 'instagram_conexion', 'instagram_credenciales']
  loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
  end loop;

  foreach t in array array['publicaciones', 'instagram_diario', 'instagram_conexion']
  loop
    execute format(
      'create policy lectura_usuarios_activos on public.%I for select to authenticated using (public.rol_actual() is not null)', t);
  end loop;

  create policy escritura_editores on public.publicaciones
    for all to authenticated using (public.puede_editar()) with check (public.puede_editar());
end $$;

revoke all on public.publicaciones, public.instagram_diario,
              public.instagram_conexion, public.instagram_credenciales from anon, authenticated;
grant select, insert, update, delete on public.publicaciones to authenticated;
grant select on public.instagram_diario, public.instagram_conexion to authenticated;
grant all on public.publicaciones, public.instagram_diario,
             public.instagram_conexion, public.instagram_credenciales to service_role;

commit;
