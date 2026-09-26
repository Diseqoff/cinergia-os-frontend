-- =====================================================================
-- CINERGIA OS · Migración 001
-- KPIs con datos reales, cuentas con DNI y seguridad por filas (RLS)
--
-- Ejecutar completo, una sola vez, en Supabase > SQL Editor.
-- Es re-ejecutable: usa IF NOT EXISTS / OR REPLACE donde corresponde.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. PROYECTOS · campos que alimentan los KPIs
-- ---------------------------------------------------------------------
alter table public.proyectos
  add column if not exists fecha_programada date,
  add column if not exists aforo_estimado integer,
  add column if not exists objetivo_general text,
  add column if not exists presupuesto text,
  add column if not exists metas jsonb not null default '[]'::jsonb,
  add column if not exists riesgos jsonb not null default '[]'::jsonb,
  add column if not exists archivo_hash text,
  add column if not exists updated_at timestamptz not null default now();

-- Etapas oficiales del pipeline
update public.proyectos set estado_actual = case estado_actual
    when 'Idealización'  then 'Planificación Base'
    when 'Planificación' then 'Planificación Base'
    when 'Ejecución'     then 'Ejecución Activa'
    when 'En Ejecución'  then 'Ejecución Activa'
    when 'Terminado'     then 'Finalizado'
    else estado_actual end
where estado_actual in ('Idealización', 'Planificación', 'Ejecución', 'En Ejecución', 'Terminado');

update public.proyectos set estado_actual = 'Planificación Base' where estado_actual is null;

-- Fecha programada a partir del texto dd/mm/aaaa
update public.proyectos
set fecha_programada = to_date(trim(fecha), 'DD/MM/YYYY')
where fecha_programada is null and fecha ~ '^\s*\d{1,2}/\d{1,2}/\d{4}\s*$';

-- Aforo numérico a partir de staff_requerido
update public.proyectos
set aforo_estimado = nullif(regexp_replace(staff_requerido, '\D', '', 'g'), '')::integer
where aforo_estimado is null
  and staff_requerido ~ '\d'
  and length(regexp_replace(staff_requerido, '\D', '', 'g')) <= 6;

-- ---------------------------------------------------------------------
-- 2. COMPROMISOS · fechas límite y reales para los KPIs de tiempo
-- ---------------------------------------------------------------------
alter table public.compromisos
  add column if not exists tipo text not null default 'hito',
  add column if not exists area text,
  add column if not exists responsable text,
  add column if not exists externo boolean not null default false,
  add column if not exists fecha_solicitud timestamptz not null default now(),
  add column if not exists fecha_limite timestamptz,
  add column if not exists fecha_entrega timestamptz,
  add column if not exists correcciones integer not null default 0,
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'compromisos_tipo_check') then
    alter table public.compromisos add constraint compromisos_tipo_check check (tipo in (
      'hito', 'entregable', 'pieza_comunicacion', 'reporte',
      'insumo_reportes', 'respuesta_aliado', 'compromiso_aliado'));
  end if;
end $$;

update public.compromisos c
set area = p.area,
    responsable = coalesce(c.responsable, p.responsable)
from public.proyectos p
where c.proyecto_id = p.id and c.area is null;

update public.compromisos set fecha_entrega = now() where completado and fecha_entrega is null;

create index if not exists compromisos_proyecto_idx on public.compromisos (proyecto_id);
create index if not exists compromisos_fecha_limite_idx on public.compromisos (fecha_limite);

-- ---------------------------------------------------------------------
-- 3. HISTORIAL DE ETAPAS · etapa inicial para proyectos sin historial
-- ---------------------------------------------------------------------
insert into public.historial_etapas (proyecto_id, etapa, fecha_inicio)
select p.id, p.estado_actual, coalesce(p.created_at, now())
from public.proyectos p
where p.estado_actual <> 'Finalizado'
  and not exists (select 1 from public.historial_etapas h where h.proyecto_id = p.id);

-- ---------------------------------------------------------------------
-- 4. CIERRES DE EVENTO / PROYECTO · resultados reales
-- ---------------------------------------------------------------------
create table if not exists public.cierres_evento (
  id uuid primary key default gen_random_uuid(),
  proyecto_id text not null unique references public.proyectos(id) on delete cascade,
  fecha_real_ejecucion date not null,
  asistentes_reales integer check (asistentes_reales >= 0),
  satisfaccion_participantes numeric(3,2) check (satisfaccion_participantes between 1 and 5),
  satisfaccion_aliados numeric(3,2) check (satisfaccion_aliados between 1 and 5),
  fecha_entrega_memoria date,
  inicio_difusion date,
  incidencias_mayores integer not null default 0 check (incidencias_mayores >= 0),
  aliados_confirmados integer not null default 0 check (aliados_confirmados >= 0),
  menciones_externas integer not null default 0 check (menciones_externas >= 0),
  alcance_digital integer check (alcance_digital >= 0),
  registro_audiovisual boolean not null default false,
  horas_voluntariado numeric(8,1) check (horas_voluntariado >= 0),
  impacto_social boolean not null default false,
  observaciones text,
  registrado_por uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. MÉTRICAS MENSUALES DE MARKETING
-- ---------------------------------------------------------------------
create table if not exists public.metricas_marketing (
  id uuid primary key default gen_random_uuid(),
  periodo date not null unique,
  seguidores integer not null check (seguidores >= 0),
  alcance integer check (alcance >= 0),
  interacciones integer check (interacciones >= 0),
  publicaciones_planificadas integer check (publicaciones_planificadas >= 0),
  publicaciones_realizadas integer check (publicaciones_realizadas >= 0),
  menciones_medios integer not null default 0 check (menciones_medios >= 0),
  registrado_por uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. UMBRALES DEL SEMÁFORO · editables sin tocar código
--    sentido 'mayor': >= verde es verde, >= amarillo es amarillo, resto rojo
--    sentido 'menor': <= verde es verde, <= amarillo es amarillo, resto rojo
-- ---------------------------------------------------------------------
create table if not exists public.kpi_umbrales (
  kpi text primary key,
  area text not null,
  nombre text not null,
  unidad text not null default '',
  sentido text not null check (sentido in ('mayor', 'menor')),
  verde numeric not null,
  amarillo numeric not null,
  principal boolean not null default false,
  meta numeric,
  updated_at timestamptz not null default now()
);

insert into public.kpi_umbrales (kpi, area, nombre, unidad, sentido, verde, amarillo, principal, meta) values
  ('ev_cronograma',   'Eventos', 'Cumplimiento de cronograma',          '%',            'mayor', 95,  80,  true,  null),
  ('ev_asistencia',   'Eventos', 'Asistencia vs. aforo estimado',       '%',            'mayor', 80,  60,  false, null),
  ('ev_memoria',      'Eventos', 'Entrega de memoria técnica',          'días hábiles', 'menor', 5,   10,  false, null),
  ('ev_satisfaccion', 'Eventos', 'Satisfacción de participantes',       '/5',           'mayor', 4.2, 3.5, false, null),
  ('ev_aliados',      'Eventos', 'Aliados o patrocinios por evento',    '',             'mayor', 2,   1,   false, null),
  ('ev_incidencias',  'Eventos', 'Incidencias mayores por evento',      '',             'menor', 0,   1,   false, null),
  ('ev_difusion',     'Eventos', 'Difusión con 72 h de anticipación',   '%',            'mayor', 100, 70,  false, null),
  ('mk_piezas',       'Marketing', 'Piezas entregadas a tiempo',              '%', 'mayor', 95,  80,  true,  null),
  ('mk_calendario',   'Marketing', 'Cumplimiento del calendario editorial',   '%', 'mayor', 90,  70,  false, null),
  ('mk_seguidores',   'Marketing', 'Crecimiento de seguidores',               '%', 'mayor', 5,   2,   false, null),
  ('mk_engagement',   'Marketing', 'Engagement promedio',                     '%', 'mayor', 3,   1.5, false, null),
  ('mk_cobertura',    'Marketing', 'Eventos con registro audiovisual',        '%', 'mayor', 100, 85,  false, null),
  ('mk_menciones',    'Marketing', 'Menciones en medios externos',            '',  'mayor', 2,   1,   false, null),
  ('mk_anticipacion', 'Marketing', 'Piezas con 72 h de anticipación',         '%', 'mayor', 95,  80,  false, null),
  ('pr_avance',       'Proyectos', 'Avance real vs. planificado',             '%',            'mayor', 90,  75,  true,  null),
  ('pr_hitos',        'Proyectos', 'Hitos cumplidos en fecha',                '%',            'mayor', 90,  70,  false, null),
  ('pr_cronograma',   'Proyectos', 'Proyectos con cronograma vigente',        '%',            'mayor', 100, 85,  false, null),
  ('pr_externos',     'Proyectos', 'Entregables externos completados',        '%',            'mayor', 95,  75,  false, null),
  ('pr_respuesta',    'Proyectos', 'Respuesta a solicitudes de aliados',      'h',            'menor', 48,  72,  false, null),
  ('pr_nuevos',       'Proyectos', 'Proyectos nuevos formulados',             '% de la meta', 'mayor', 100, 50,  false, 2),
  ('go_compromisos',  'Gestión de Oportunidades', 'Compromisos bilaterales cumplidos', '%',  'mayor', 90,  70,  true,  null),
  ('go_respuesta',    'Gestión de Oportunidades', 'Respuesta a aliados',               'h',  'menor', 48,  72,  false, null),
  ('go_satisfaccion', 'Gestión de Oportunidades', 'Satisfacción de aliados',           '/5', 'mayor', 4.2, 3.5, false, null),
  ('go_activados',    'Gestión de Oportunidades', 'Aliados activados por evento',      '',   'mayor', 2,   1,   false, null),
  ('rp_reportes',     'Reportes', 'Reportes entregados a tiempo',            '%',    'mayor', 100, 85, true,  null),
  ('rp_insumos',      'Reportes', 'Áreas con insumos completos y a tiempo',  '%',    'mayor', 90,  70, false, null),
  ('rp_consolidacion','Reportes', 'Tiempo de consolidación',                 'días', 'menor', 2,   3,  false, null),
  ('rp_calidad',      'Reportes', 'Correcciones por insumo recibido',        '',     'menor', 0,   2,  false, null),
  ('tr_externos',     'Transversal', 'Cumplimiento de entregables externos', '%',  'mayor', 90,  70, false, null),
  ('tr_satisfaccion', 'Transversal', 'Satisfacción de aliados y clientes',   '/5', 'mayor', 4,   3,  false, null),
  ('tr_puntualidad',  'Transversal', 'Puntualidad interáreas',               '%',  'mayor', 85,  65, false, null),
  ('tr_planes',       'Transversal', 'Zonas rojas con plan correctivo',      '%',  'mayor', 100, 80, false, null)
on conflict (kpi) do nothing;

-- ---------------------------------------------------------------------
-- 7. USUARIOS · cuentas enlazadas a Supabase Auth con DNI
-- ---------------------------------------------------------------------
-- Los registros existentes son de prueba y no corresponden a cuentas reales.
delete from public.usuarios_directiva
where id not in (select id from auth.users);

alter table public.usuarios_directiva
  add column if not exists dni text,
  add column if not exists usuario text,
  add column if not exists debe_cambiar_credenciales boolean not null default true,
  add column if not exists activo boolean not null default true,
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'usuarios_directiva_dni_key') then
    alter table public.usuarios_directiva add constraint usuarios_directiva_dni_key unique (dni);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'usuarios_directiva_usuario_key') then
    alter table public.usuarios_directiva add constraint usuarios_directiva_usuario_key unique (usuario);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'usuarios_directiva_auth_fkey') then
    alter table public.usuarios_directiva add constraint usuarios_directiva_auth_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'usuarios_directiva_rol_check') then
    alter table public.usuarios_directiva add constraint usuarios_directiva_rol_check
      check (rol in ('SuperAdmin', 'Editor', 'Lector'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 8. FUNCIONES DE PERMISOS
-- ---------------------------------------------------------------------
create or replace function public.rol_actual()
returns text language sql stable security definer set search_path = public as $$
  select rol from public.usuarios_directiva where id = auth.uid() and activo
$$;

create or replace function public.puede_editar()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.rol_actual() in ('Editor', 'SuperAdmin'), false)
$$;

create or replace function public.es_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.rol_actual() = 'SuperAdmin', false)
$$;

-- Login con DNI o usuario: devuelve el correo interno de la cuenta
create or replace function public.email_para_login(identificador text)
returns text language sql stable security definer set search_path = public, auth as $$
  select u.email
  from auth.users u
  join public.usuarios_directiva d on d.id = u.id
  where d.activo
    and (d.dni = trim(identificador) or lower(d.usuario) = lower(trim(identificador)))
  limit 1
$$;

-- Cambio de usuario propio; marca las credenciales como personalizadas
create or replace function public.actualizar_mi_usuario(nuevo_usuario text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v text := lower(trim(nuevo_usuario));
begin
  if auth.uid() is null then
    raise exception 'Sesión no válida.';
  end if;
  if v !~ '^[a-z0-9._]{4,30}$' then
    raise exception 'El usuario debe tener entre 4 y 30 caracteres: letras, números, punto o guion bajo.';
  end if;
  if v ~ '^\d+$' then
    raise exception 'El usuario no puede ser solo números.';
  end if;
  if exists (select 1 from public.usuarios_directiva where lower(usuario) = v and id <> auth.uid()) then
    raise exception 'Ese usuario ya está en uso.';
  end if;
  update public.usuarios_directiva
  set usuario = v, debe_cambiar_credenciales = false
  where id = auth.uid();
end $$;

-- Cambio de etapa con registro de tiempos en historial_etapas
create or replace function public.registrar_etapa(p_proyecto text, p_etapa text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.puede_editar() then
    raise exception 'Permisos insuficientes para modificar proyectos.';
  end if;
  if p_etapa not in ('Planificación Base', 'Aprobación Directiva', 'Ejecución Activa',
                     'Revisión / QA', 'Cierre Operativo', 'Finalizado') then
    raise exception 'Etapa no válida: %', p_etapa;
  end if;

  update public.historial_etapas
  set fecha_fin = now()
  where proyecto_id = p_proyecto and fecha_fin is null and etapa <> p_etapa;

  update public.proyectos
  set estado_actual = p_etapa, updated_at = now()
  where id = p_proyecto;

  if p_etapa = 'Finalizado' then
    insert into public.historial_etapas (proyecto_id, etapa, fecha_inicio, fecha_fin)
    select p_proyecto, p_etapa, now(), now()
    where not exists (select 1 from public.historial_etapas where proyecto_id = p_proyecto and etapa = 'Finalizado');
  else
    insert into public.historial_etapas (proyecto_id, etapa, fecha_inicio)
    select p_proyecto, p_etapa, now()
    where not exists (
      select 1 from public.historial_etapas
      where proyecto_id = p_proyecto and etapa = p_etapa and fecha_fin is null);
  end if;
end $$;

revoke all on function public.email_para_login(text) from public;
revoke all on function public.actualizar_mi_usuario(text) from public;
revoke all on function public.registrar_etapa(text, text) from public;
grant execute on function public.email_para_login(text) to anon, authenticated;
grant execute on function public.actualizar_mi_usuario(text) to authenticated;
grant execute on function public.registrar_etapa(text, text) to authenticated, service_role;
grant execute on function public.rol_actual() to authenticated;
grant execute on function public.puede_editar() to authenticated;
grant execute on function public.es_superadmin() to authenticated;

-- ---------------------------------------------------------------------
-- 9. SEGURIDAD POR FILAS
--    Lectura: usuarios activos. Escritura: Editor y SuperAdmin.
--    Usuarios y umbrales: solo SuperAdmin escribe.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  p record;
begin
  foreach t in array array['proyectos', 'compromisos', 'historial_etapas', 'cierres_evento',
                           'metricas_marketing', 'kpi_umbrales', 'usuarios_directiva']
  loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format(
      'create policy lectura_usuarios_activos on public.%I for select to authenticated using (public.rol_actual() is not null)', t);
  end loop;

  foreach t in array array['proyectos', 'compromisos', 'historial_etapas', 'cierres_evento', 'metricas_marketing']
  loop
    execute format(
      'create policy escritura_editores on public.%I for all to authenticated using (public.puede_editar()) with check (public.puede_editar())', t);
  end loop;

  foreach t in array array['kpi_umbrales', 'usuarios_directiva']
  loop
    execute format(
      'create policy escritura_superadmin on public.%I for all to authenticated using (public.es_superadmin()) with check (public.es_superadmin())', t);
  end loop;
end $$;

-- Permisos de tabla para las tablas nuevas; el acceso real lo limitan las políticas
grant select, insert, update, delete on public.cierres_evento, public.metricas_marketing, public.kpi_umbrales to authenticated;
grant all on public.cierres_evento, public.metricas_marketing, public.kpi_umbrales to service_role;
revoke all on public.cierres_evento, public.metricas_marketing, public.kpi_umbrales from anon;

-- La vista respeta los permisos de quien consulta
alter view public.vista_tiempos_etapas set (security_invoker = true);

commit;
