-- Playlist compartida del viaje (PB-56): un enlace de Spotify por viaje que todos los miembros ven en el inicio.
-- Cualquier miembro la enlaza, la cambia o la quita mientras el viaje está activo. Ejecutar una vez en Supabase.

CREATE TABLE IF NOT EXISTS public.playlists_viaje (
  viaje_id uuid PRIMARY KEY REFERENCES public.viajes (id) ON DELETE CASCADE,
  -- Enlace canónico de la playlist (https://open.spotify.com/playlist/<id>), comprobado por el backend
  url text NOT NULL CHECK (char_length(url) BETWEEN 10 AND 300),
  actualizado_por uuid REFERENCES public.perfiles (id) ON DELETE SET NULL,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.playlists_viaje ENABLE ROW LEVEL SECURITY;

-- Los miembros ven la playlist del viaje, también en viajes finalizados
DROP POLICY IF EXISTS playlists_select ON public.playlists_viaje;
CREATE POLICY playlists_select ON public.playlists_viaje FOR SELECT TO authenticated
  USING (public.es_miembro(viaje_id));

-- Enlazar una playlist: cualquier miembro, con el viaje activo
DROP POLICY IF EXISTS playlists_insert ON public.playlists_viaje;
CREATE POLICY playlists_insert ON public.playlists_viaje FOR INSERT TO authenticated
  WITH CHECK (public.es_miembro(viaje_id) AND public.es_editable(viaje_id) AND actualizado_por = auth.uid());

-- Cambiarla: cualquier miembro, con el viaje activo
DROP POLICY IF EXISTS playlists_update ON public.playlists_viaje;
CREATE POLICY playlists_update ON public.playlists_viaje FOR UPDATE TO authenticated
  USING (public.es_miembro(viaje_id) AND public.es_editable(viaje_id))
  WITH CHECK (public.es_miembro(viaje_id) AND public.es_editable(viaje_id) AND actualizado_por = auth.uid());

-- Quitarla: cualquier miembro, con el viaje activo
DROP POLICY IF EXISTS playlists_delete ON public.playlists_viaje;
CREATE POLICY playlists_delete ON public.playlists_viaje FOR DELETE TO authenticated
  USING (public.es_miembro(viaje_id) AND public.es_editable(viaje_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlists_viaje TO authenticated;
