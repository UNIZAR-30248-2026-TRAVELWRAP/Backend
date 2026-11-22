-- Foto del ticket o del documento escaneado, guardada junto al gasto o a la actividad que se crea con ella.
-- La foto va en el bucket «documentos», en la carpeta del viaje (<viaje>/escaneos/...), y aquí se guarda su ruta.
-- Ejecutar una vez en Supabase, después de 01 a 04.

ALTER TABLE public.gastos
  ADD COLUMN IF NOT EXISTS foto_ruta text NULL;
ALTER TABLE public.gastos
  DROP CONSTRAINT IF EXISTS gastos_foto_del_viaje,
  ADD CONSTRAINT gastos_foto_del_viaje
    CHECK (foto_ruta IS NULL OR foto_ruta LIKE viaje_id::text || '/escaneos/%');

ALTER TABLE public.actividades
  ADD COLUMN IF NOT EXISTS foto_ruta text NULL;
ALTER TABLE public.actividades
  DROP CONSTRAINT IF EXISTS actividades_foto_del_viaje,
  ADD CONSTRAINT actividades_foto_del_viaje
    CHECK (foto_ruta IS NULL OR foto_ruta LIKE viaje_id::text || '/escaneos/%');
