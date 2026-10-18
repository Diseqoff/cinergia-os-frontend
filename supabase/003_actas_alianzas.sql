-- Datos de las actas que usa la Analítica de Proyectos.
-- tipo_acta: evento, proyecto, convenio, carta o propuesta.
-- vigente_hasta: fecha de vencimiento de un convenio o carta de alianza.

alter table public.proyectos add column if not exists tipo_acta text;
alter table public.proyectos add column if not exists vigente_hasta date;

notify pgrst, 'reload schema';
