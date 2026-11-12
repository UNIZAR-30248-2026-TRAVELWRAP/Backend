-- MEJ-12: archivar, desarchivar y eliminar viajes por usuario.
-- Migración de datos de una base ya creada. Se ejecuta UNA sola vez por parte, en este orden:
--   PARTE 1 (antes de fusionar el Backend), y después 02_politicas_rls.sql (idempotente).
--   PARTE 2 (después de desplegar el Frontend).
-- Una base nueva no la necesita: 01_create_tables.sql y 02_politicas_rls.sql ya salen en el estado final.

-- ======================================================================
-- PARTE 1 · Solo añade cosas: la app que está desplegada sigue funcionando
-- ======================================================================

ALTER TABLE public.miembros_viaje
  ADD COLUMN IF NOT EXISTS archivado_en timestamptz,
  ADD COLUMN IF NOT EXISTS eliminado_en timestamptz;

-- Relleno inicial: los viajes archivados con el modelo antiguo quedan archivados para cada miembro que sigue en ellos
UPDATE public.miembros_viaje m
SET archivado_en = COALESCE(v.finalizado_en, now())
FROM public.viajes v
WHERE v.id = m.viaje_id
  AND v.estado = 'archivado'
  AND m.abandonado_en IS NULL
  AND m.archivado_en IS NULL;

-- ======================================================================
-- PARTE 2 · Después de desplegar el Frontend nuevo
-- ======================================================================

-- El código antiguo pudo archivar viajes entre medias: repetir el relleno
UPDATE public.miembros_viaje m
SET archivado_en = COALESCE(v.finalizado_en, now())
FROM public.viajes v
WHERE v.id = m.viaje_id
  AND v.estado = 'archivado'
  AND m.abandonado_en IS NULL
  AND m.archivado_en IS NULL;

-- El estado «archivado» queda sin uso: esos viajes pasan a finalizado (se conserva finalizado_en)
UPDATE public.viajes SET estado = 'finalizado' WHERE estado = 'archivado';

-- Ya nadie borra un viaje con un DELETE directo: solo eliminar_viaje y borrar_viaje
DROP POLICY IF EXISTS viajes_delete ON public.viajes;

-- Sustituida por desarchivar_viaje_propio, que no toca el estado del viaje
DROP FUNCTION IF EXISTS public.desarchivar_viaje(uuid);
