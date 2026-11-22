// Comprobación y normalización del enlace de la playlist del viaje (PB-56).
// Acepta los enlaces de Spotify de una playlist, con o sin idioma (intl-es) y con parámetros (?si=...),
// y el formato de URI (spotify:playlist:...). Se guarda siempre la forma canónica, para que el mismo enlace
// no quede guardado de dos maneras distintas.

const ID_PLAYLIST = '[A-Za-z0-9]{10,40}';
const ENLACE_WEB = new RegExp(`^https://open\\.spotify\\.com/(?:intl-[a-z]{2}/)?playlist/(${ID_PLAYLIST})(?:[/?#].*)?$`, 'i');
const URI_SPOTIFY = new RegExp(`^spotify:playlist:(${ID_PLAYLIST})$`, 'i');

const MENSAJE_NO_VALIDA = 'El enlace tiene que ser de una playlist de Spotify (por ejemplo, https://open.spotify.com/playlist/...)';

// Devuelve { valor: 'https://open.spotify.com/playlist/<id>' } o { error }
const normalizarPlaylist = (texto) => {
  const limpio = typeof texto === 'string' ? texto.trim() : '';
  const coincidencia = limpio.match(ENLACE_WEB) ?? limpio.match(URI_SPOTIFY);
  if (!coincidencia) return { error: MENSAJE_NO_VALIDA };
  return { valor: `https://open.spotify.com/playlist/${coincidencia[1]}` };
};

module.exports = { normalizarPlaylist };
