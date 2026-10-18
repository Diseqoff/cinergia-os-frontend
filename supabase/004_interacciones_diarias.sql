-- Las interacciones diarias de la cuenta pueden ser negativas.
-- Instagram descuenta ese día los me gusta, comentarios o guardados que se retiran.

alter table public.instagram_diario drop constraint if exists instagram_diario_interacciones_check;

notify pgrst, 'reload schema';
