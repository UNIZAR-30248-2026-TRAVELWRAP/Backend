// Playlist compartida del viaje (PB-56). Ver el enlace lo puede hacer cualquier miembro, también en viajes finalizados.
// Enlazarla, cambiarla o quitarla solo con el viaje activo. Las políticas de RLS (scripts/06) lo garantizan también en la base de datos.
const viajeService = require('./viajeService');

const CAMPOS_PLAYLIST = 'url, actualizado_por, actualizado_en';

// Motivos comunes: el viaje no existe o el usuario no es miembro, o el viaje no está activo
const comprobarViaje = async (cliente, usuarioId, viajeId, { soloActivo = false } = {}) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };
  if (soloActivo && previo.viaje.estado !== 'activo') return { estado: 'no_activo' };
  return { estado: 'ok' };
};

// Playlist del viaje, o null si no hay ninguna
// Devuelve { error } | { estado: no_existe | ok (con playlist, que puede ser null) }
const obtener = async (cliente, usuarioId, viajeId) => {
  const viaje = await comprobarViaje(cliente, usuarioId, viajeId);
  if (viaje.error || viaje.estado !== 'ok') return viaje;

  const { data, error } = await cliente.from('playlists_viaje').select(CAMPOS_PLAYLIST).eq('viaje_id', viajeId).maybeSingle();
  if (error) return { error };
  return { estado: 'ok', playlist: data ?? null };
};

// Enlaza o cambia la playlist del viaje (una por viaje)
// Devuelve { error } | { estado: no_existe | no_activo | ok (con playlist) }
const guardar = async (cliente, usuarioId, viajeId, url) => {
  const viaje = await comprobarViaje(cliente, usuarioId, viajeId, { soloActivo: true });
  if (viaje.error || viaje.estado !== 'ok') return viaje;

  const { data, error } = await cliente
    .from('playlists_viaje')
    .upsert({ viaje_id: viajeId, url, actualizado_por: usuarioId, actualizado_en: new Date().toISOString() }, { onConflict: 'viaje_id' })
    .select(CAMPOS_PLAYLIST)
    .single();
  if (error) return { error };
  return { estado: 'ok', playlist: data };
};

// Quita la playlist del viaje
// Devuelve { error } | { estado: no_existe | no_activo | ok }
const quitar = async (cliente, usuarioId, viajeId) => {
  const viaje = await comprobarViaje(cliente, usuarioId, viajeId, { soloActivo: true });
  if (viaje.error || viaje.estado !== 'ok') return viaje;

  const { error } = await cliente.from('playlists_viaje').delete().eq('viaje_id', viajeId);
  if (error) return { error };
  return { estado: 'ok' };
};

module.exports = { obtener, guardar, quitar };
