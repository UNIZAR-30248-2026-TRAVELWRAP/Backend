-- 1. FUNCIONES AUXILIARES
CREATE OR REPLACE FUNCTION public.es_miembro(p_viaje_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.miembros_viaje
    WHERE viaje_id = p_viaje_id AND usuario_id = auth.uid() AND abandonado_en IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.es_creador(p_viaje_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.miembros_viaje
    WHERE viaje_id = p_viaje_id AND usuario_id = auth.uid() AND rol = 'creador' AND abandonado_en IS NULL
  );
$$;

-- Un viaje solo admite contenido nuevo mientras está activo: al cerrarlo o archivarlo queda de solo lectura.
-- Las tablas con contenido del viaje (gastos, tareas, actividades...) deben exigirla en sus políticas de escritura
CREATE OR REPLACE FUNCTION public.es_editable(p_viaje_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.viajes
    WHERE id = p_viaje_id AND estado = 'activo'
  );
$$;

-- Viaje al que pertenece una votación (lo usan las políticas de opciones y votos)
CREATE OR REPLACE FUNCTION public.viaje_de_votacion(p_votacion_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT viaje_id FROM public.votaciones WHERE id = p_votacion_id;
$$;

-- Se pueden proponer opciones y votar si eres miembro del viaje, el viaje está activo y la votación sigue abierta
CREATE OR REPLACE FUNCTION public.puede_votar(p_votacion_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.votaciones v
    WHERE v.id = p_votacion_id
      AND v.estado = 'abierta'
      AND public.es_miembro(v.viaje_id)
      AND public.es_editable(v.viaje_id)
  );
$$;

-- 2. ACTIVAR RLS
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miembros_viaje ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opciones_votacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actividades ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS PERFILES
DROP POLICY IF EXISTS perfiles_select ON public.perfiles;
CREATE POLICY perfiles_select ON public.perfiles FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS perfiles_insert ON public.perfiles;
CREATE POLICY perfiles_insert ON public.perfiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS perfiles_update ON public.perfiles;
CREATE POLICY perfiles_update ON public.perfiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- 4. POLÍTICAS VIAJES
DROP POLICY IF EXISTS viajes_select ON public.viajes;
CREATE POLICY viajes_select ON public.viajes FOR SELECT TO authenticated
  USING (public.es_miembro(id) OR creador_id = auth.uid());

DROP POLICY IF EXISTS viajes_insert ON public.viajes;
CREATE POLICY viajes_insert ON public.viajes FOR INSERT TO authenticated
  WITH CHECK (creador_id = auth.uid());

-- Solo el creador modifica el viaje, y un viaje archivado ya no se puede modificar (solo lectura)
DROP POLICY IF EXISTS viajes_update ON public.viajes;
CREATE POLICY viajes_update ON public.viajes FOR UPDATE TO authenticated
  USING (public.es_creador(id) AND estado <> 'archivado') WITH CHECK (public.es_creador(id));

-- Solo el creador elimina el viaje, y solo desde la papelera de archivados.
-- Sus miembros (y el resto de tablas del viaje) se borran en cascada (ON DELETE CASCADE)
DROP POLICY IF EXISTS viajes_delete ON public.viajes;
CREATE POLICY viajes_delete ON public.viajes FOR DELETE TO authenticated
  USING (public.es_creador(id) AND estado = 'archivado');

-- 5. POLÍTICAS MIEMBROS_VIAJE
DROP POLICY IF EXISTS miembros_viaje_select ON public.miembros_viaje;
CREATE POLICY miembros_viaje_select ON public.miembros_viaje FOR SELECT TO authenticated
  USING (public.es_miembro(viaje_id) OR usuario_id = auth.uid());

DROP POLICY IF EXISTS miembros_viaje_insert_creador ON public.miembros_viaje;
CREATE POLICY miembros_viaje_insert_creador ON public.miembros_viaje FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = auth.uid()
    AND rol = 'creador'
    AND EXISTS (SELECT 1 FROM public.viajes v WHERE v.id = viaje_id AND v.creador_id = auth.uid())
  );

DROP POLICY IF EXISTS miembros_viaje_update_propio ON public.miembros_viaje;
CREATE POLICY miembros_viaje_update_propio ON public.miembros_viaje FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

-- 6. POLÍTICAS VOTACIONES
DROP POLICY IF EXISTS votaciones_select ON public.votaciones;
CREATE POLICY votaciones_select ON public.votaciones FOR SELECT TO authenticated
  USING (public.es_miembro(viaje_id));

-- Cualquier miembro crea votaciones mientras el viaje está activo. La de destino solo la abre crear_viaje
DROP POLICY IF EXISTS votaciones_insert ON public.votaciones;
CREATE POLICY votaciones_insert ON public.votaciones FOR INSERT TO authenticated
  WITH CHECK (
    creado_por = auth.uid()
    AND tipo <> 'destino'
    AND estado = 'abierta'
    AND public.es_miembro(viaje_id)
    AND public.es_editable(viaje_id)
  );

-- Solo el creador del viaje cierra las votaciones, y solo con el viaje activo
DROP POLICY IF EXISTS votaciones_update ON public.votaciones;
CREATE POLICY votaciones_update ON public.votaciones FOR UPDATE TO authenticated
  USING (public.es_creador(viaje_id) AND public.es_editable(viaje_id)) WITH CHECK (public.es_creador(viaje_id));

-- 7. POLÍTICAS OPCIONES_VOTACION
DROP POLICY IF EXISTS opciones_votacion_select ON public.opciones_votacion;
CREATE POLICY opciones_votacion_select ON public.opciones_votacion FOR SELECT TO authenticated
  USING (public.es_miembro(public.viaje_de_votacion(votacion_id)));

-- Cualquier miembro propone opciones mientras la votación está abierta
DROP POLICY IF EXISTS opciones_votacion_insert ON public.opciones_votacion;
CREATE POLICY opciones_votacion_insert ON public.opciones_votacion FOR INSERT TO authenticated
  WITH CHECK (public.puede_votar(votacion_id));

-- 8. POLÍTICAS VOTOS
-- Los miembros ven los votos de su viaje (para el recuento y quién ha votado)
DROP POLICY IF EXISTS votos_select ON public.votos;
CREATE POLICY votos_select ON public.votos FOR SELECT TO authenticated
  USING (public.es_miembro(public.viaje_de_votacion(votacion_id)));

-- Cada miembro emite, cambia o retira solo su propio voto, y solo mientras la votación está abierta
DROP POLICY IF EXISTS votos_insert ON public.votos;
CREATE POLICY votos_insert ON public.votos FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid() AND public.puede_votar(votacion_id));

DROP POLICY IF EXISTS votos_update ON public.votos;
CREATE POLICY votos_update ON public.votos FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid() AND public.puede_votar(votacion_id))
  WITH CHECK (usuario_id = auth.uid() AND public.puede_votar(votacion_id));

DROP POLICY IF EXISTS votos_delete ON public.votos;
CREATE POLICY votos_delete ON public.votos FOR DELETE TO authenticated
  USING (usuario_id = auth.uid() AND public.puede_votar(votacion_id));

DROP POLICY IF EXISTS actividades_select ON public.actividades;
CREATE POLICY actividades_select ON public.actividades FOR SELECT TO authenticated
  USING (public.es_miembro(viaje_id));

DROP POLICY IF EXISTS actividades_insert ON public.actividades;
CREATE POLICY actividades_insert ON public.actividades FOR INSERT TO authenticated
  WITH CHECK (creado_por = auth.uid() AND public.es_miembro(viaje_id) AND public.es_editable(viaje_id));

DROP POLICY IF EXISTS actividades_update ON public.actividades;
CREATE POLICY actividades_update ON public.actividades FOR UPDATE TO authenticated
  USING (public.es_miembro(viaje_id) AND public.es_editable(viaje_id))
  WITH CHECK (public.es_miembro(viaje_id) AND public.es_editable(viaje_id));

DROP POLICY IF EXISTS actividades_delete ON public.actividades;
CREATE POLICY actividades_delete ON public.actividades FOR DELETE TO authenticated
  USING (public.es_miembro(viaje_id) AND public.es_editable(viaje_id));

-- 9. FUNCIÓN UNIRSE CON INVITACIÓN
CREATE OR REPLACE FUNCTION public.unirse_con_invitacion(p_token text)
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

-- 10. FUNCIÓN CREAR VIAJE
-- Crea un viaje y añade a quien lo crea como miembro con rol creador, en una sola operación.
-- Es SECURITY DEFINER para poder crear el perfil si falta (el login por email no lo crea).
-- Un viaje sin destino (destino null) queda pendiente y se abre su votación de destino.
-- Devuelve { estado }: sin_sesion | ok (con viaje)
CREATE OR REPLACE FUNCTION public.crear_viaje(
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

  IF v_viaje.destino IS NULL THEN
    INSERT INTO public.votaciones (viaje_id, titulo, tipo, creado_por)
    VALUES (v_viaje.id, '¿A dónde queremos ir?', 'destino', v_usuario);
  END IF;

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

-- 11. FUNCIÓN CREAR VOTACIÓN
-- Crea una votación con sus opciones iniciales en una sola operación: si falla una opción, no se crea nada.
-- Es SECURITY INVOKER: se aplican las mismas políticas RLS que a un insert directo en las tablas.
-- p_opciones es una lista JSON de { texto, valor_fecha }; el orden de la lista es el de las opciones.
-- Devuelve { estado }: no_existe | no_activo | ok (con votacion_id)
CREATE OR REPLACE FUNCTION public.crear_votacion(
  p_viaje_id uuid,
  p_titulo text,
  p_descripcion text,
  p_tipo public.tipo_votacion,
  p_opciones jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_votacion_id uuid;
BEGIN
  IF NOT public.es_miembro(p_viaje_id) THEN
    RETURN jsonb_build_object('estado', 'no_existe');
  END IF;
  IF NOT public.es_editable(p_viaje_id) THEN
    RETURN jsonb_build_object('estado', 'no_activo');
  END IF;

  INSERT INTO public.votaciones (viaje_id, titulo, descripcion, tipo, creado_por)
  VALUES (p_viaje_id, p_titulo, p_descripcion, p_tipo, auth.uid())
  RETURNING id INTO v_votacion_id;

  INSERT INTO public.opciones_votacion (votacion_id, texto, valor_fecha, orden)
  SELECT v_votacion_id, o.opcion ->> 'texto', (o.opcion ->> 'valor_fecha')::date, o.posicion - 1
  FROM jsonb_array_elements(COALESCE(p_opciones, '[]'::jsonb)) WITH ORDINALITY AS o (opcion, posicion);

  RETURN jsonb_build_object('estado', 'ok', 'votacion_id', v_votacion_id);
END;
$$;

REVOKE ALL ON FUNCTION public.crear_votacion(uuid, text, text, public.tipo_votacion, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_votacion(uuid, text, text, public.tipo_votacion, jsonb) TO authenticated;

-- 12. FUNCIÓN CERRAR VOTACIÓN
-- Cierra una votación y guarda la opción ganadora: la más votada o, si hay empate, una de las empatadas al azar.
-- En la votación de destino fija además el destino del viaje, todo en una sola operación.
-- Solo la cierra el creador del viaje, con el viaje activo y cuando han votado todos sus miembros (RF9).
-- Es SECURITY INVOKER (se aplican las políticas RLS).
-- Devuelve { estado }: no_existe | no_creador | no_activo | ya_cerrada | faltan_votos | ok (con opcion_ganadora_id, hubo_empate y destino)
CREATE OR REPLACE FUNCTION public.cerrar_votacion(p_viaje_id uuid, p_votacion_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_votacion public.votaciones;
  v_ganadora_id uuid;
  v_empatadas int;
  v_destino text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.votaciones WHERE id = p_votacion_id AND viaje_id = p_viaje_id) THEN
    RETURN jsonb_build_object('estado', 'no_existe');
  END IF;
  IF NOT public.es_creador(p_viaje_id) THEN
    RETURN jsonb_build_object('estado', 'no_creador');
  END IF;
  IF NOT public.es_editable(p_viaje_id) THEN
    RETURN jsonb_build_object('estado', 'no_activo');
  END IF;

  -- Bloquea la votación para que no se cierre dos veces a la vez
  SELECT * INTO v_votacion FROM public.votaciones WHERE id = p_votacion_id FOR UPDATE;
  IF v_votacion.estado = 'cerrada' THEN
    RETURN jsonb_build_object('estado', 'ya_cerrada');
  END IF;

  -- RF9: solo se cierra cuando han votado todos los miembros activos del viaje
  IF EXISTS (
    SELECT 1 FROM public.miembros_viaje m
    WHERE m.viaje_id = p_viaje_id
      AND m.abandonado_en IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.votos v WHERE v.votacion_id = p_votacion_id AND v.usuario_id = m.usuario_id)
  ) THEN
    RETURN jsonb_build_object('estado', 'faltan_votos');
  END IF;

  -- Opciones con más votos (al menos uno) y, entre ellas, una al azar
  WITH recuento AS (
    SELECT o.id, count(v.id) AS votos
    FROM public.opciones_votacion o
    LEFT JOIN public.votos v ON v.opcion_id = o.id
    WHERE o.votacion_id = p_votacion_id
    GROUP BY o.id
  ),
  empatadas AS (
    SELECT id FROM recuento WHERE votos > 0 AND votos = (SELECT max(votos) FROM recuento)
  )
  SELECT (SELECT count(*) FROM empatadas), (SELECT id FROM empatadas ORDER BY random() LIMIT 1)
  INTO v_empatadas, v_ganadora_id;

  UPDATE public.votaciones
  SET estado = 'cerrada', cerrada_en = now(), opcion_ganadora_id = v_ganadora_id
  WHERE id = p_votacion_id;

  IF v_votacion.tipo = 'destino' THEN
    SELECT btrim(texto) INTO v_destino FROM public.opciones_votacion WHERE id = v_ganadora_id;
    UPDATE public.viajes SET destino = v_destino WHERE id = p_viaje_id;
  END IF;

  RETURN jsonb_build_object(
    'estado', 'ok',
    'opcion_ganadora_id', v_ganadora_id,
    'hubo_empate', v_empatadas > 1,
    'destino', v_destino
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cerrar_votacion(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cerrar_votacion(uuid, uuid) TO authenticated;

-- 13. VIAJES PENDIENTES CREADOS ANTES DE LAS VOTACIONES
-- Abre la votación de destino de los viajes activos sin destino que todavía no la tienen.
-- Se puede ejecutar varias veces: solo crea las que faltan
INSERT INTO public.votaciones (viaje_id, titulo, tipo, creado_por)
SELECT v.id, '¿A dónde queremos ir?', 'destino', v.creador_id
FROM public.viajes v
WHERE v.destino IS NULL
  AND v.estado = 'activo'
  AND NOT EXISTS (SELECT 1 FROM public.votaciones vo WHERE vo.viaje_id = v.id AND vo.tipo = 'destino');
