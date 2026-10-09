CREATE FUNCTION public.es_miembro(p_viaje_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.miembros_viaje
    WHERE viaje_id = p_viaje_id AND usuario_id = auth.uid() AND abandonado_en IS NULL
  );
$$;

CREATE FUNCTION public.es_creador(p_viaje_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.miembros_viaje
    WHERE viaje_id = p_viaje_id AND usuario_id = auth.uid() AND rol = 'creador' AND abandonado_en IS NULL
  );
$$;

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miembros_viaje ENABLE ROW LEVEL SECURITY;

CREATE POLICY perfiles_select ON public.perfiles FOR SELECT TO authenticated
  USING (true);
CREATE POLICY perfiles_insert ON public.perfiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY perfiles_update ON public.perfiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY viajes_select ON public.viajes FOR SELECT TO authenticated
  USING (public.es_miembro(id) OR creador_id = auth.uid());
CREATE POLICY viajes_insert ON public.viajes FOR INSERT TO authenticated
  WITH CHECK (creador_id = auth.uid());
CREATE POLICY viajes_update ON public.viajes FOR UPDATE TO authenticated
  USING (public.es_creador(id)) WITH CHECK (public.es_creador(id));
CREATE POLICY viajes_delete ON public.viajes FOR DELETE TO authenticated
  USING (public.es_creador(id));

CREATE POLICY miembros_viaje_select ON public.miembros_viaje FOR SELECT TO authenticated
  USING (public.es_miembro(viaje_id) OR usuario_id = auth.uid());
CREATE POLICY miembros_viaje_insert_creador ON public.miembros_viaje FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = auth.uid()
    AND rol = 'creador'
    AND EXISTS (SELECT 1 FROM public.viajes v WHERE v.id = viaje_id AND v.creador_id = auth.uid())
  );
CREATE POLICY miembros_viaje_update_propio ON public.miembros_viaje FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());
