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

module.exports = { obtener, elegir, quitar };
