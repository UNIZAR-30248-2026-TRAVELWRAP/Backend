const notificacionService = require('../services/notificacionService');
const { responderError } = require('../utils/validacion');

const MAX_CAMPO = 1000;

const textoValido = (valor) => typeof valor === 'string' && valor.length > 0 && valor.length <= MAX_CAMPO;

// Clave pública VAPID con la que el navegador crea la suscripción. 503 si el servidor no tiene push configurado
const obtenerClave = (req, res) => {
  const clave = notificacionService.clavePublica();
  if (!clave) return responderError(res, 503, 'push_no_disponible', 'Las notificaciones push no están disponibles');
  return res.status(200).json({ clave });
};

// Cuerpo de la suscripción tal como la da el navegador: { endpoint, keys: { p256dh, auth } }
const suscribir = async (req, res) => {
  const { endpoint, keys } = req.body ?? {};
  if (!textoValido(endpoint) || !endpoint.startsWith('https://') || !textoValido(keys?.p256dh) || !textoValido(keys?.auth)) {
    return responderError(res, 400, 'datos_invalidos', 'La suscripción debe llevar un endpoint https y las claves p256dh y auth');
  }

  try {
    const resultado = await notificacionService.suscribir(req.supabase, req.usuario.id, {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    });
    if (resultado.error) return responderError(res, 502, 'error_notificacion', 'No se ha podido activar las notificaciones');
    return res.status(201).json({ endpoint });
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const darDeBaja = async (req, res) => {
  const endpoint = req.body?.endpoint;
  if (!textoValido(endpoint)) return responderError(res, 400, 'datos_invalidos', 'Indica el endpoint de la suscripción');

  try {
    const resultado = await notificacionService.cancelar(req.supabase, req.usuario.id, endpoint);
    if (resultado.error) return responderError(res, 502, 'error_notificacion', 'No se ha podido desactivar las notificaciones');
    return res.status(204).send();
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

module.exports = { obtenerClave, suscribir, darDeBaja };
