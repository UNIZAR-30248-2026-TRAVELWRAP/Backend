const playlistService = require('../services/playlistService');
const { normalizarPlaylist } = require('../utils/playlist');
const { UUID_REGEX, CHECK_VIOLATION, responderError } = require('../utils/validacion');

const idViajeInvalido = (res) => responderError(res, 400, 'datos_invalidos', 'El identificador del viaje no es válido');

// Motivos de fallo de los servicios de playlist
const responderMotivo = (res, estado) => {
  if (estado === 'no_existe') return responderError(res, 404, 'viaje_no_encontrado', 'El viaje no existe o no perteneces a él');
  if (estado === 'no_activo') return responderError(res, 409, 'viaje_no_activo', 'El viaje está finalizado y ya no se puede modificar');
  return responderError(res, 502, 'error_playlist', 'No se ha podido actualizar la playlist del viaje');
};

// Formato de la playlist en la API: el enlace y cuándo se cambió (null si el viaje no tiene playlist)
const formatear = (playlist) =>
  playlist ? { url: playlist.url, actualizado_en: playlist.actualizado_en } : null;

const obtener = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);

  try {
    const resultado = await playlistService.obtener(req.supabase, req.usuario.id, viajeId);
    if (resultado.error) return responderError(res, 502, 'error_playlist', 'No se ha podido obtener la playlist del viaje');
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado);
    return res.status(200).json({ playlist: formatear(resultado.playlist) });
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

// Enlaza o cambia la playlist. Cuerpo: { url }
const guardar = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);

  const normalizada = normalizarPlaylist(req.body?.url);
  if (normalizada.error) return responderError(res, 400, 'datos_invalidos', normalizada.error);

  try {
    const resultado = await playlistService.guardar(req.supabase, req.usuario.id, viajeId, normalizada.valor);
    if (resultado.error) {
      if (resultado.error.code === CHECK_VIOLATION) return responderError(res, 400, 'datos_invalidos', 'La playlist no es válida');
      return responderError(res, 502, 'error_playlist', 'No se ha podido guardar la playlist del viaje');
    }
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado);
    return res.status(200).json({ playlist: formatear(resultado.playlist) });
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const quitar = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);

  try {
    const resultado = await playlistService.quitar(req.supabase, req.usuario.id, viajeId);
    if (resultado.error) return responderError(res, 502, 'error_playlist', 'No se ha podido quitar la playlist del viaje');
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado);
    return res.status(204).end();
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

module.exports = { obtener, guardar, quitar };
