// Recibe el cliente de supabase del usuario (req.supabase) para que se apliquen las políticas RLS
const viajeService = require('./viajeService');

const CAMPOS_VOTACION =
  'id, viaje_id, titulo, descripcion, tipo, estado, opcion_ganadora_id, creado_por, creado_en, cerrada_en';
const CAMPOS_OPCION = 'id, votacion_id, texto, valor_fecha, orden';

// Opciones y votos de las votaciones dadas, en dos consultas (y no embebidos: votaciones y opciones se
// referencian entre sí y PostgREST no sabría por qué relación unirlas)
const opcionesYVotos = async (cliente, ids) => {
  const [opciones, votos] = await Promise.all([
    cliente.from('opciones_votacion').select(CAMPOS_OPCION).in('votacion_id', ids).order('orden').order('texto'),
    cliente.from('votos').select('votacion_id, opcion_id, usuario_id').in('votacion_id', ids),
  ]);
  if (opciones.error || votos.error) return { error: opciones.error ?? votos.error };
  return { opciones: opciones.data ?? [], votos: votos.data ?? [] };
};

// Da a la votación el formato de la API: sus opciones con el recuento, el voto del usuario, cuántos pueden
// votar y si ya han votado todos (solo entonces se puede cerrar, RF9)
const formatear = (votacion, opciones, votos, usuarioId, miembros) => {
  const { viaje_id: _viaje, ...datos } = votacion;
  const propios = votos.filter((v) => v.votacion_id === votacion.id);
  return {
    ...datos,
    opciones: opciones
      .filter((o) => o.votacion_id === votacion.id)
      .map(({ votacion_id: _votacion, ...opcion }) => {
        const votantes = propios.filter((v) => v.opcion_id === opcion.id).map((v) => v.usuario_id);
        return { ...opcion, votos: votantes.length, votantes };
      }),
    total_votos: propios.length,
    total_miembros: miembros.length,
    todos_han_votado: miembros.every((m) => propios.some((v) => v.usuario_id === m.usuario_id)),
    mi_voto: propios.find((v) => v.usuario_id === usuarioId)?.opcion_id ?? null,
  };
};

const conRecuento = async (cliente, usuarioId, viaje, votaciones) => {
  if (votaciones.length === 0) return { votaciones: [] };
  const resultado = await opcionesYVotos(cliente, votaciones.map((v) => v.id));
  if (resultado.error) return { error: resultado.error };
  return {
    votaciones: votaciones.map((v) => formatear(v, resultado.opciones, resultado.votos, usuarioId, viaje.miembros)),
  };
};

// Devuelve { error } | { estado: no_existe | ok (con votaciones) }. Filtros opcionales: estado y tipo
const listar = async (cliente, usuarioId, viajeId, filtros = {}) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };

  let consulta = cliente
    .from('votaciones')
    .select(CAMPOS_VOTACION)
    .eq('viaje_id', viajeId)
    .order('creado_en', { ascending: false });
  if (filtros.estado) consulta = consulta.eq('estado', filtros.estado);
  if (filtros.tipo) consulta = consulta.eq('tipo', filtros.tipo);

  const { data, error } = await consulta;
  if (error) return { error };

  const resultado = await conRecuento(cliente, usuarioId, previo.viaje, data ?? []);
  if (resultado.error) return { error: resultado.error };
  return { estado: 'ok', votaciones: resultado.votaciones };
};

// Viaje del usuario y votación de ese viaje, sin recuento: lo que hace falta para comprobar si se puede
// votar o cerrar antes de intentarlo (las políticas RLS lo rechazarían sin decir por qué).
// Devuelve { error } | { estado: no_existe | no_encontrada | ok (con viaje y votacion) }
const votacionDelViaje = async (cliente, usuarioId, viajeId, votacionId) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };

  const { data, error } = await cliente
    .from('votaciones')
    .select(CAMPOS_VOTACION)
    .eq('id', votacionId)
    .eq('viaje_id', viajeId)
    .maybeSingle();
  if (error) return { error };
  if (!data) return { estado: 'no_encontrada' };
  return { estado: 'ok', viaje: previo.viaje, votacion: data };
};

// Devuelve { error } | { estado: no_existe | no_encontrada | ok (con votacion) }
const obtener = async (cliente, usuarioId, viajeId, votacionId) => {
  const previo = await votacionDelViaje(cliente, usuarioId, viajeId, votacionId);
  if (previo.error || previo.estado !== 'ok') return previo;

  const resultado = await conRecuento(cliente, usuarioId, previo.viaje, [previo.votacion]);
  if (resultado.error) return { error: resultado.error };
  return { estado: 'ok', votacion: resultado.votaciones[0] };
};

// Votación con su recuento después de un cambio: si ya no se encuentra, es un fallo
// Devuelve { error } | { estado: ok (con votacion) }
const recontar = async (cliente, usuarioId, viajeId, votacionId) => {
  const resultado = await obtener(cliente, usuarioId, viajeId, votacionId);
  if (!resultado.error && resultado.estado !== 'ok') return { error: { code: 'sin_filas' } };
  return resultado;
};

// Crea la votación con sus opciones en una sola operación (función crear_votacion)
// Devuelve { error } | { estado: no_existe | no_activo | ok (con votacion) }
const crear = async (cliente, usuarioId, viajeId, datos) => {
  const { data, error } = await cliente.rpc('crear_votacion', {
    p_viaje_id: viajeId,
    p_titulo: datos.titulo,
    p_descripcion: datos.descripcion,
    p_tipo: datos.tipo,
    p_opciones: datos.opciones,
  });
  if (error || !data) return { error: error ?? { code: 'respuesta_vacia' } };
  if (data.estado !== 'ok') return { estado: data.estado };

  return recontar(cliente, usuarioId, viajeId, data.votacion_id);
};

// Comprueba que la votación admite opciones y votos: viaje activo y votación abierta
// Devuelve { error } | { estado: no_existe | no_encontrada | no_activo | votacion_cerrada | ok (con viaje y votacion) }
const votacionAbierta = async (cliente, usuarioId, viajeId, votacionId) => {
  const previo = await votacionDelViaje(cliente, usuarioId, viajeId, votacionId);
  if (previo.error || previo.estado !== 'ok') return previo;
  if (previo.viaje.estado !== 'activo') return { estado: 'no_activo' };
  if (previo.votacion.estado !== 'abierta') return { estado: 'votacion_cerrada' };
  return previo;
};

// Añade una opción al final de la lista. Devuelve { error } | { estado: ...votacionAbierta | ok (con votacion) }
const anadirOpcion = async (cliente, usuarioId, viajeId, votacionId, opcion) => {
  const previo = await votacionAbierta(cliente, usuarioId, viajeId, votacionId);
  if (previo.error || previo.estado !== 'ok') return previo;

  const ultima = await cliente
    .from('opciones_votacion')
    .select('orden')
    .eq('votacion_id', votacionId)
    .order('orden', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ultima.error) return { error: ultima.error };

  const { error } = await cliente.from('opciones_votacion').insert({
    votacion_id: votacionId,
    texto: opcion.texto,
    valor_fecha: opcion.valor_fecha,
    orden: ultima.data ? ultima.data.orden + 1 : 0,
  });
  if (error) return { error };

  return recontar(cliente, usuarioId, viajeId, votacionId);
};

// Emite el voto del usuario o lo cambia si ya había votado
// Devuelve { error } | { estado: ...votacionAbierta | opcion_no_valida | ok (con votacion) }
const votar = async (cliente, usuarioId, viajeId, votacionId, opcionId) => {
  const previo = await votacionAbierta(cliente, usuarioId, viajeId, votacionId);
  if (previo.error || previo.estado !== 'ok') return previo;

  const opcion = await cliente
    .from('opciones_votacion')
    .select('id')
    .eq('id', opcionId)
    .eq('votacion_id', votacionId)
    .maybeSingle();
  if (opcion.error) return { error: opcion.error };
  if (!opcion.data) return { estado: 'opcion_no_valida' };

  const { error } = await cliente
    .from('votos')
    .upsert(
      { votacion_id: votacionId, opcion_id: opcionId, usuario_id: usuarioId, emitido_en: new Date().toISOString() },
      { onConflict: 'votacion_id,usuario_id' },
    );
  if (error) return { error };

  return recontar(cliente, usuarioId, viajeId, votacionId);
};

// Retira el voto del usuario (si no había votado, no cambia nada)
// Devuelve { error } | { estado: ...votacionAbierta | ok (con votacion) }
const retirarVoto = async (cliente, usuarioId, viajeId, votacionId) => {
  const previo = await votacionAbierta(cliente, usuarioId, viajeId, votacionId);
  if (previo.error || previo.estado !== 'ok') return previo;

  const { error } = await cliente.from('votos').delete().eq('votacion_id', votacionId).eq('usuario_id', usuarioId);
  if (error) return { error };

  return recontar(cliente, usuarioId, viajeId, votacionId);
};

// Cierra la votación con la función cerrar_votacion: elige la ganadora (al azar si hay empate) y, si es
// la de destino, lo guarda en el viaje en la misma operación
// Devuelve { error } | { estado: no_existe | no_encontrada | no_creador | no_activo | votacion_cerrada | faltan_votos
//   | ok (con votacion, hubo_empate y destino) }
const cerrar = async (cliente, usuarioId, viajeId, votacionId) => {
  const previo = await votacionDelViaje(cliente, usuarioId, viajeId, votacionId);
  if (previo.error || previo.estado !== 'ok') return previo;
  if (previo.viaje.rol !== 'creador') return { estado: 'no_creador' };
  if (previo.viaje.estado !== 'activo') return { estado: 'no_activo' };
  if (previo.votacion.estado !== 'abierta') return { estado: 'votacion_cerrada' };

  const { data, error } = await cliente.rpc('cerrar_votacion', { p_viaje_id: viajeId, p_votacion_id: votacionId });
  if (error || !data) return { error: error ?? { code: 'respuesta_vacia' } };
  // Otro la ha cerrado justo antes
  if (data.estado === 'ya_cerrada') return { estado: 'votacion_cerrada' };
  if (data.estado !== 'ok') return { estado: data.estado };

  const resultado = await recontar(cliente, usuarioId, viajeId, votacionId);
  if (resultado.error) return resultado;
  return { estado: 'ok', votacion: resultado.votacion, hubo_empate: data.hubo_empate, destino: data.destino ?? null };
};

module.exports = { listar, obtener, crear, anadirOpcion, votar, retirarVoto, cerrar };
