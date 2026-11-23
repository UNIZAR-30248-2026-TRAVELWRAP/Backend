// Fotos de los tickets y documentos escaneados que se guardan junto a un gasto o una actividad.
// Van en el bucket privado «documentos», en la carpeta del viaje y dentro de «escaneos», así que las políticas
// de Storage (scripts/02) ya dejan verlas solo a los miembros. No aparecen en la cartera, que lee la tabla documentos.
const { randomUUID } = require('node:crypto');

const BUCKET = 'documentos';
// Segundos que vive el enlace para ver la foto. Se pide uno nuevo cada vez que se abre
const SEGUNDOS_DE_ENLACE = 300;

// Ruta de la foto dentro del bucket: <viaje>/escaneos/<uuid>.<extensión>
const RUTA_FOTO = /^([0-9a-f-]{36})\/escaneos\/[0-9a-f-]{36}\.(jpg|png)$/i;

// Guarda la foto escaneada y devuelve su ruta, o { error } si Supabase no la ha podido guardar
const guardar = async (cliente, viajeId, buffer, tipoMime) => {
  const extension = tipoMime === 'image/png' ? 'png' : 'jpg';
  const ruta = `${viajeId}/escaneos/${randomUUID()}.${extension}`;
  const { error } = await cliente.storage.from(BUCKET).upload(ruta, buffer, { contentType: tipoMime, upsert: false });
  return error ? { error } : { ruta };
};

// Comprueba que una ruta de foto es de este viaje y tiene la forma que genera guardar().
// Así un gasto o una actividad no puede enlazar la foto de otro viaje
const rutaDeFotoValida = (ruta, viajeId) => {
  const coincidencia = typeof ruta === 'string' ? ruta.match(RUTA_FOTO) : null;
  return coincidencia !== null && coincidencia[1].toLowerCase() === String(viajeId).toLowerCase();
};

// La foto es opcional: si llega, tiene que ser una foto escaneada de este viaje. Devuelve { valor } | { error }
const validarRutaOpcional = (valor, viajeId) => {
  if (valor === undefined || valor === null) return { valor: null };
  if (!rutaDeFotoValida(valor, viajeId)) return { error: 'La foto no pertenece a este viaje o no es una foto escaneada' };
  return { valor };
};

// Enlace temporal para ver la foto. La ruta no sale del servidor: solo sale el enlace firmado
const urlFirmada = async (cliente, ruta) => {
  const expira = new Date(Date.now() + SEGUNDOS_DE_ENLACE * 1000);
  const { data, error } = await cliente.storage.from(BUCKET).createSignedUrl(ruta, SEGUNDOS_DE_ENLACE);
  if (error) return { error };
  return { url: data.signedUrl, expira_en: expira.toISOString() };
};

module.exports = { guardar, rutaDeFotoValida, validarRutaOpcional, urlFirmada, BUCKET, SEGUNDOS_DE_ENLACE };
