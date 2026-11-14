const viajeService = require('./viajeService');
const { textoDelSello } = require('../utils/sellos');

const CAMPOS_SELLO = 'id, viaje_id, diseno, destino, anio, elegido_en';

// finalizado_en no sale en el viaje que devuelve viajeService.obtener: solo hace falta como segunda opción
// para el año del sello, cuando el viaje no tiene fecha de inicio
const finalizadoEn = async (cliente, viajeId) => {
  const { data, error } = await cliente.from('viajes').select('finalizado_en').eq('id', viajeId).maybeSingle();
  if (error) return { error };
  return { valor: data?.finalizado_en ?? null };
};

// Sello del usuario en este viaje, o null si no ha elegido ninguno. Un viaje activo todavía no tiene sello
// Devuelve { error } | { estado: no_existe | ok (con sello) }
const obtener = async (cliente, usuarioId, viajeId) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };
  if (previo.viaje.estado === 'activo') return { estado: 'ok', sello: null };

  const { data, error } = await cliente
    .from('sellos')
    .select(CAMPOS_SELLO)
    .eq('usuario_id', usuarioId)
    .eq('viaje_id', viajeId)
    .maybeSingle();
  if (error) return { error };

  return { estado: 'ok', sello: data ?? null };
};

// Elige el sello del viaje o cambia el que ya tenía. El destino y el año se guardan en este momento
// Devuelve { error } | { estado: no_existe | no_terminado | ok (con sello) }
const elegir = async (cliente, usuarioId, viajeId, diseno) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };
  if (previo.viaje.estado === 'activo') return { estado: 'no_terminado' };

  const finalizacion = await finalizadoEn(cliente, viajeId);
  if (finalizacion.error) return { error: finalizacion.error };

  const { destino, anio } = textoDelSello({ ...previo.viaje, finalizado_en: finalizacion.valor });
  const { data, error } = await cliente
    .from('sellos')
    .upsert(
      { usuario_id: usuarioId, viaje_id: viajeId, diseno, destino, anio, elegido_en: new Date().toISOString() },
      { onConflict: 'usuario_id,viaje_id' },
    )
    .select(CAMPOS_SELLO)
    .single();
  if (error) return { error };

  return { estado: 'ok', sello: data };
};

// Quita el sello del viaje; si no tenía ninguno, no pasa nada
// Devuelve { error } | { estado: no_existe | no_terminado | ok }
const quitar = async (cliente, usuarioId, viajeId) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };
  if (previo.viaje.estado === 'activo') return { estado: 'no_terminado' };

  const { error } = await cliente.from('sellos').delete().eq('usuario_id', usuarioId).eq('viaje_id', viajeId);
  if (error) return { error };

  return { estado: 'ok' };
};

// Todos los sellos del usuario, leídos solo de «sellos»: siguen estando aunque el viaje se haya archivado,
// eliminado o borrado. Por año descendente y luego por fecha de elección
// Devuelve { error } | { estado: ok, sellos }
const listarMios = async (cliente, usuarioId) => {
  const { data, error } = await cliente
    .from('sellos')
    .select(CAMPOS_SELLO)
    .eq('usuario_id', usuarioId)
    .order('anio', { ascending: false })
    .order('elegido_en', { ascending: true });
  if (error) return { error };

  return { estado: 'ok', sellos: data ?? [] };
};

// Cambia el diseño de un sello propio (también si su viaje ya no existe)
// Devuelve { error } | { estado: sello_no_existe | ok (con sello) }
const cambiarDiseno = async (cliente, usuarioId, selloId, diseno) => {
  const { data, error } = await cliente
    .from('sellos')
    .update({ diseno })
    .eq('id', selloId)
    .eq('usuario_id', usuarioId)
    .select(CAMPOS_SELLO)
    .maybeSingle();
  if (error) return { error };
  if (!data) return { estado: 'sello_no_existe' };

  return { estado: 'ok', sello: data };
};

// Quita un sello propio por su id
// Devuelve { error } | { estado: sello_no_existe | ok }
const quitarPorId = async (cliente, usuarioId, selloId) => {
  const { data, error } = await cliente
    .from('sellos')
    .delete()
    .eq('id', selloId)
    .eq('usuario_id', usuarioId)
    .select('id');
  if (error) return { error };
  if (!data || data.length === 0) return { estado: 'sello_no_existe' };

  return { estado: 'ok' };
};

module.exports = { obtener, elegir, quitar, listarMios, cambiarDiseno, quitarPorId };
