// Recibe el cliente de supabase del usuario (req.supabase) para que se apliquen las políticas RLS

const SELECCION =
  'id, nombre, destino, descripcion, fecha_inicio, fecha_fin, moneda, presupuesto, estado, creado_en, ' +
  'miembros_viaje(usuario_id, rol, abandonado_en, perfiles(nombre, avatar_url))';

// Un viaje está pendiente de destino cuando está activo y todavía no lo tiene
const conPendiente = (viaje) => ({
  ...viaje,
  pendiente_destino: viaje.estado === 'activo' && viaje.destino === null,
});

// Da al viaje el formato de la API. Devuelve null si el usuario no es miembro activo
const formatear = (fila, usuarioId) => {
  const { miembros_viaje: filas, ...viaje } = fila;
  const miembros = (filas ?? []).filter((m) => m.abandonado_en === null);
  const yo = miembros.find((m) => m.usuario_id === usuarioId);
  if (!yo) return null;

  return {
    ...conPendiente(viaje),
    rol: yo.rol,
    miembros: miembros.map((m) => ({
      usuario_id: m.usuario_id,
      nombre: m.perfiles?.nombre ?? null,
      avatar_url: m.perfiles?.avatar_url ?? null,
      rol: m.rol,
    })),
  };
};

const listar = async (cliente, usuarioId, estado) => {
  let consulta = cliente.from('viajes').select(SELECCION).order('creado_en', { ascending: false });
  if (estado) consulta = consulta.eq('estado', estado);

  const { data, error } = await consulta;
  if (error) return { error };

  return { viajes: (data ?? []).map((fila) => formatear(fila, usuarioId)).filter(Boolean) };
};

const obtener = async (cliente, usuarioId, viajeId) => {
  const { data, error } = await cliente.from('viajes').select(SELECCION).eq('id', viajeId).maybeSingle();
  if (error) return { error };

  // Sin fila: el viaje no existe o el usuario no es miembro (RLS no deja distinguirlo)
  return { viaje: data ? formatear(data, usuarioId) : null };
};

const crear = async (cliente, datos) => {
  const { data, error } = await cliente.rpc('crear_viaje', {
    p_nombre: datos.nombre,
    p_destino: datos.destino,
    p_fecha_inicio: datos.fechaInicio,
    p_fecha_fin: datos.fechaFin,
    p_presupuesto: datos.presupuesto,
  });
  if (error || !data) return { error: error ?? { code: 'respuesta_vacia' } };

  return data.estado === 'ok' ? { estado: 'ok', viaje: conPendiente(data.viaje) } : { estado: data.estado };
};

// Antes de modificar un viaje se comprueba que existe y que el usuario es su creador, para poder
// responder con el motivo exacto: las políticas RLS rechazarían el cambio sin decir por qué.
// Devuelve { error } | { estado: no_existe | no_creador | ok (con viaje) }
const viajeDelCreador = async (cliente, usuarioId, viajeId) => {
  const resultado = await obtener(cliente, usuarioId, viajeId);
  if (resultado.error) return { error: resultado.error };
  if (!resultado.viaje) return { estado: 'no_existe' };
  if (resultado.viaje.rol !== 'creador') return { estado: 'no_creador' };
  return { estado: 'ok', viaje: resultado.viaje };
};

// Aplica los cambios y devuelve el viaje actualizado. Sin filas actualizadas, RLS ha rechazado el cambio
const actualizar = async (cliente, usuarioId, viajeId, cambios) => {
  const { data, error } = await cliente.from('viajes').update(cambios).eq('id', viajeId).select('id');
  if (error) return { error };
  if (!data || data.length === 0) return { error: { code: 'sin_filas' } };

  const resultado = await obtener(cliente, usuarioId, viajeId);
  if (resultado.error || !resultado.viaje) return { error: resultado.error ?? { code: 'sin_filas' } };
  return { estado: 'ok', viaje: resultado.viaje };
};

// Devuelve { error } | { estado: no_existe | no_creador | no_activo | ok (con viaje) }
const editar = async (cliente, usuarioId, viajeId, cambios) => {
  const previo = await viajeDelCreador(cliente, usuarioId, viajeId);
  if (previo.error || previo.estado !== 'ok') return previo;
  if (previo.viaje.estado !== 'activo') return { estado: 'no_activo' };

  return actualizar(cliente, usuarioId, viajeId, cambios);
};

// Cierra el viaje y lo pasa al historial de solo lectura
// Devuelve { error } | { estado: no_existe | no_creador | ya_archivado | ok (con viaje) }
const archivar = async (cliente, usuarioId, viajeId) => {
  const previo = await viajeDelCreador(cliente, usuarioId, viajeId);
  if (previo.error || previo.estado !== 'ok') return previo;
  if (previo.viaje.estado === 'archivado') return { estado: 'ya_archivado' };

  // Un viaje finalizado ya tiene su fecha de cierre: solo se guarda al cerrar uno activo
  const cambios =
    previo.viaje.estado === 'activo'
      ? { estado: 'archivado', finalizado_en: new Date().toISOString() }
      : { estado: 'archivado' };
  return actualizar(cliente, usuarioId, viajeId, cambios);
};

// Borra el viaje para todos sus miembros. Lo demás (miembros, gastos...) se borra en cascada
// Devuelve { error } | { estado: no_existe | no_creador | no_archivado | ok }
const eliminar = async (cliente, usuarioId, viajeId) => {
  const previo = await viajeDelCreador(cliente, usuarioId, viajeId);
  if (previo.error || previo.estado !== 'ok') return previo;
  if (previo.viaje.estado !== 'archivado') return { estado: 'no_archivado' };

  const { data, error } = await cliente.from('viajes').delete().eq('id', viajeId).select('id');
  if (error) return { error };
  if (!data || data.length === 0) return { error: { code: 'sin_filas' } };
  return { estado: 'ok' };
};

module.exports = { listar, obtener, crear, editar, archivar, eliminar };
