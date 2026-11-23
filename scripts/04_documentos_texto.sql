-- Los documentos de la cartera pueden ser también resúmenes en texto (.txt) que la app guarda al escanear
-- un documento que no es ni un gasto ni una actividad. Se añade text/plain a la tabla y al bucket «documentos».
-- Ejecutar una vez en Supabase, después de 01, 02 y 03.

ALTER TABLE public.documentos
  DROP CONSTRAINT IF EXISTS documentos_tipo_mime_check,
  ADD CONSTRAINT documentos_tipo_mime_check
    CHECK (tipo_mime IN ('application/pdf', 'image/jpeg', 'image/png', 'text/plain'));

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'text/plain']
WHERE id = 'documentos';
