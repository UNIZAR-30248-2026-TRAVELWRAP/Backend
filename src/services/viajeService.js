// Recibe el cliente de supabase del usuario (req.supabase) para que se apliquen las políticas RLS

const SELECCION =
  'id, nombre, destino, descripcion, fecha_inicio, fecha_fin, moneda, presupuesto, estado, creado_en, ' +
  'miembros_viaje(usuario_id, rol, abandonado_en, archivado_en, eliminado_en, perfiles(nombre, avatar_url))';

// Un viaje está pendiente de destino cuando está activo y todavía no lo tiene
const conPendiente = (viaje) => ({
  ...viaje,
  pendiente_destino: viaje.estado === 'activo' && viaje.destino === null,
});

// Da al viaje el formato de la API. Devuelve null si el usuario no es miembro activo o ya lo ha eliminado
// (para él desaparece, aunque los demás miembros lo sigan viendo)
const formatear = (fila, usuarioId) => {
  const { miembros_viaje: filas, ...viaje } = fila;
  const miembros = (filas ?? []).filter((m) => m.abandonado_en === null);
  const yo = miembros.find((m) => m.usuario_id === usuarioId);
  if (!yo || yo.eliminado_en) return null;

  return {
    ...conPendiente(viaje),
    rol: yo.rol,
    archivado: Boolean(yo.archivado_en),
    miembros: miembros.map((m) => ({
      usuario_id: m.usuario_id,
      nombre: m.perfiles?.nombre ?? null,
      avatar_url: m.perfiles?.avatar_url ?? null,
      rol: m.rol,
    })),
  };
};

// Por defecto solo los viajes no archivados por el usuario; con archivados: true, solo los que ha archivado.
// El archivado es personal (está en la fila del propio usuario), así que se filtra tras formatear
const listar = async (cliente, usuarioId, { estado, archivados = false } = {}) => {
  let consulta = cliente.from('viajes').select(SELECCION).order('creado_en', { ascending: false });
  if (estado) consulta = consulta.eq('estado', estado);

  const { data, error } = await consulta;
  if (error) return { error };

  const viajes = (data ?? []).map((fila) => formatear(fila, usuarioId)).filter(Boolean);
  return { viajes: viajes.filter((viaje) => viaje.archivado === archivados) };
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

// Finaliza el viaje para todos: queda de solo lectura en «Viajes anteriores» y ya no vuelve a activo
// Devuelve { error } | { estado: no_existe | no_creador | ya_finalizado | ok (con viaje) }
const finalizar = async (cliente, usuarioId, viajeId) => {
  const previo = await viajeDelCreador(cliente, usuarioId, viajeId);
  if (previo.error || previo.estado !== 'ok') return previo;
  if (previo.viaje.estado !== 'activo') return { estado: 'ya_finalizado' };

  return actualizar(cliente, usuarioId, viajeId, { estado: 'finalizado', finalizado_en: new Date().toISOString() });
};

// Archiva el viaje solo para el usuario: pasa a su «Viajes archivados». Los demás miembros lo siguen viendo igual.
// Solo se archiva un viaje finalizado. Se usa la función SQL archivar_viaje porque nadie puede modificar
// directamente su fila de miembros_viaje
// Devuelve { error } | { estado: no_existe | no_finalizado | ya_archivado | ok (con viaje) }
const archivar = async (cliente, usuarioId, viajeId) => {
  const previo = await obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };
  if (previo.viaje.estado !== 'finalizado') return { estado: 'no_finalizado' };
  if (previo.viaje.archivado) return { estado: 'ya_archivado' };

  return cambiarArchivado(cliente, usuarioId, viajeId, 'archivar_viaje');
};

// Desarchiva el viaje solo para el usuario. No cambia su estado: sigue finalizado y vuelve a «Viajes anteriores»
// Devuelve { error } | { estado: no_existe | no_estaba_archivado | ok (con viaje) }
const desarchivar = async (cliente, usuarioId, viajeId) => {
  const previo = await obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };
  if (!previo.viaje.archivado) return { estado: 'no_estaba_archivado' };

  return cambiarArchivado(cliente, usuarioId, viajeId, 'desarchivar_viaje_propio');
};

const cambiarArchivado = async (cliente, usuarioId, viajeId, funcion) => {
  const { data, error } = await cliente.rpc(funcion, { p_viaje_id: viajeId });
  if (error) return { error };
  if (data !== true) return { error: { code: 'sin_filas' } };

  const resultado = await obtener(cliente, usuarioId, viajeId);
  if (resultado.error || !resultado.viaje) return { error: resultado.error ?? { code: 'sin_filas' } };
  return { estado: 'ok', viaje: resultado.viaje };
};

const TAMANO_LOTE = 100;

// Borra archivos de un bucket con el cliente del usuario, en lotes. Quitar uno que ya no existe no da error
const borrarArchivos = async (cliente, bucket, rutas) => {
  for (let i = 0; i < (rutas ?? []).length; i += TAMANO_LOTE) {
    const { error } = await cliente.storage.from(bucket).remove(rutas.slice(i, i + TAMANO_LOTE));
    if (error) return { error };
  }
  return {};
};

// Elimina el viaje solo para el usuario (debe tenerlo archivado): deja de aparecerle, pero los demás lo conservan.
// Cuando lo eliminan todos los miembros que siguen en él, el último lo borra de verdad: eliminar_viaje no cambia nada
// y devuelve las rutas de sus archivos, que se borran de Storage con el token del usuario; solo entonces
// borrar_viaje borra el viaje y todo lo suyo en cascada. Si algo falla antes, la base de datos no ha cambiado
// y se puede repetir. Las rutas no salen de este servicio
// Devuelve { error } | { estado: no_existe | no_archivado | ok }
const eliminar = async (cliente, usuarioId, viajeId) => {
  const previo = await obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };
  if (!previo.viaje.archivado) return { estado: 'no_archivado' };

  const { data, error } = await cliente.rpc('eliminar_viaje', { p_viaje_id: viajeId });
  if (error) return { error };
  if (!data || data.estado !== 'ok') return { error: { code: 'no_permitido' } };
  if (!data.ultimo) return { estado: 'ok' };

  for (const [bucket, rutas] of [['documentos', data.documentos], ['fotos', data.fotos]]) {
    const borrado = await borrarArchivos(cliente, bucket, rutas);
    if (borrado.error) return { error: borrado.error };
  }

  const borrar = await cliente.rpc('borrar_viaje', { p_viaje_id: viajeId });
  if (borrar.error) return { error: borrar.error };
  // También es false si Storage no ha borrado algún archivo (una política puede impedirlo sin dar error)
  if (borrar.data !== true) return { error: { code: 'sin_filas' } };
  return { estado: 'ok' };
};

// Abandona el viaje: el usuario deja de ser miembro, pero sus gastos y repartos se conservan. Solo puede hacerlo
// si no es el creador y tiene el saldo a cero. Se usa la función SQL abandonar_viaje porque nadie puede modificar
// directamente su fila de miembros_viaje
// Devuelve { error } | { estado: no_miembro | es_creador | ok } | { estado: saldo_pendiente, saldo }
const abandonar = async (cliente, viajeId) => {
  const { data, error } = await cliente.rpc('abandonar_viaje', { p_viaje_id: viajeId });
  if (error) return { error };
  if (!data || typeof data.estado !== 'string') return { error: { code: 'respuesta_vacia' } };

  return data.estado === 'saldo_pendiente' ? { estado: data.estado, saldo: data.saldo } : { estado: data.estado };
};

module.exports = { listar, obtener, crear, editar, finalizar, archivar, desarchivar, eliminar, abandonar };
