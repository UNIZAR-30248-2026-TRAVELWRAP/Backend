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

-- Unirse a un viaje con su token de invitación. Es SECURITY DEFINER porque quien se une
-- todavía no es miembro y las políticas no le dejan leer el viaje ni insertarse en miembros_viaje.
-- Devuelve { estado }: sin_sesion | no_existe | viaje_no_activo | ok (con viaje y miembro)
CREATE FUNCTION public.unirse_con_invitacion(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario uuid := auth.uid();
  v_viaje public.viajes;
  v_miembro public.miembros_viaje;
  v_ya_era_miembro boolean;
BEGIN
  IF v_usuario IS NULL THEN
    RETURN jsonb_build_object('estado', 'sin_sesion');
  END IF;

  SELECT * INTO v_viaje FROM public.viajes WHERE token_invitacion = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('estado', 'no_existe');
  END IF;
  IF v_viaje.estado <> 'activo' THEN
    RETURN jsonb_build_object('estado', 'viaje_no_activo');
  END IF;

  -- El login por email no crea el perfil, y miembros_viaje lo exige
  INSERT INTO public.perfiles (id, nombre, email, avatar_url)
  SELECT
    u.id,
    COALESCE(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1)),
    u.email,
    COALESCE(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
  FROM auth.users u
  WHERE u.id = v_usuario
  ON CONFLICT (id) DO NOTHING;

  SELECT EXISTS (
    SELECT 1 FROM public.miembros_viaje m
    WHERE m.viaje_id = v_viaje.id AND m.usuario_id = v_usuario AND m.abandonado_en IS NULL
  ) INTO v_ya_era_miembro;

  -- Si había abandonado el viaje se reactiva su fila; si ya estaba dentro no cambia nada
  INSERT INTO public.miembros_viaje AS m (viaje_id, usuario_id, rol)
  VALUES (v_viaje.id, v_usuario, 'miembro')
  ON CONFLICT (viaje_id, usuario_id) DO UPDATE
    SET unido_en = CASE WHEN m.abandonado_en IS NULL THEN m.unido_en ELSE now() END,
        abandonado_en = NULL
  RETURNING * INTO v_miembro;

  RETURN jsonb_build_object(
    'estado', 'ok',
    'ya_era_miembro', v_ya_era_miembro,
    'viaje', jsonb_build_object(
      'id', v_viaje.id,
      'nombre', v_viaje.nombre,
      'destino', v_viaje.destino,
      'imagen_portada_url', v_viaje.imagen_portada_url
    ),
    'miembro', jsonb_build_object('rol', v_miembro.rol, 'unido_en', v_miembro.unido_en)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.unirse_con_invitacion(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unirse_con_invitacion(text) TO authenticated;

-- Crea un viaje y añade a quien lo crea como miembro con rol creador, en una sola operación.
-- Es SECURITY DEFINER para poder crear el perfil si falta (el login por email no lo crea).
-- Un viaje sin destino (destino null) queda pendiente de decidir el destino por votación.
-- Devuelve { estado }: sin_sesion | ok (con viaje)
CREATE FUNCTION public.crear_viaje(
  p_nombre text,
  p_destino text,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_presupuesto numeric
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario uuid := auth.uid();
  v_viaje public.viajes;
BEGIN
  IF v_usuario IS NULL THEN
    RETURN jsonb_build_object('estado', 'sin_sesion');
  END IF;

  INSERT INTO public.perfiles (id, nombre, email, avatar_url)
  SELECT
    u.id,
    COALESCE(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1)),
    u.email,
    COALESCE(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
  FROM auth.users u
  WHERE u.id = v_usuario
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.viajes (creador_id, nombre, destino, fecha_inicio, fecha_fin, presupuesto)
  VALUES (v_usuario, p_nombre, p_destino, p_fecha_inicio, p_fecha_fin, p_presupuesto)
  RETURNING * INTO v_viaje;

  INSERT INTO public.miembros_viaje (viaje_id, usuario_id, rol)
  VALUES (v_viaje.id, v_usuario, 'creador');

  RETURN jsonb_build_object(
    'estado', 'ok',
    'viaje', jsonb_build_object(
      'id', v_viaje.id,
      'nombre', v_viaje.nombre,
      'destino', v_viaje.destino,
      'descripcion', v_viaje.descripcion,
      'fecha_inicio', v_viaje.fecha_inicio,
      'fecha_fin', v_viaje.fecha_fin,
      'moneda', v_viaje.moneda,
      'presupuesto', v_viaje.presupuesto,
      'estado', v_viaje.estado,
      'creado_en', v_viaje.creado_en
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.crear_viaje(text, text, date, date, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_viaje(text, text, date, date, numeric) TO authenticated;
