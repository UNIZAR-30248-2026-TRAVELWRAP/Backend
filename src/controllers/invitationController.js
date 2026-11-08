const invitationService = require('../services/invitationService');
const votacionesSocket = require('../sockets/votacionesSocket');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_REGEX = /^[0-9a-f]{32}$/;

const frontendUrl = () => process.env.FRONTEND_URL ?? 'http://localhost:5173';

const responderError = (res, estado, codigo, mensaje) =>
  res.status(estado).json({ error: { codigo, mensaje } });

const invitacionNoEncontrada = (res) =>
  responderError(res, 404, 'invitacion_no_encontrada', 'El enlace de invitación no es válido');

const obtenerEnlace = async (req, res) => {
  const { viajeId } = req.params;

  if (!UUID_REGEX.test(viajeId)) {
    return responderError(res, 400, 'datos_invalidos', 'El identificador del viaje no es válido');
  }

  try {
    const resultado = await invitationService.obtenerToken(req.supabase, viajeId);

    if (resultado.error) {
      return responderError(res, 502, 'error_invitacion', 'No se ha podido obtener el enlace de invitación');
    }
    if (!resultado.token) {
      return responderError(res, 404, 'viaje_no_encontrado', 'El viaje no existe o no perteneces a él');
    }

    return res.status(200).json({
      token: resultado.token,
      enlace: `${frontendUrl()}/unirse/${resultado.token}`,
    });
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const unirse = async (req, res) => {
  const { token } = req.params;

  if (!TOKEN_REGEX.test(token)) return invitacionNoEncontrada(res);

  try {
    const resultado = await invitationService.unirse(req.supabase, token);

    if (resultado.error) {
      return responderError(res, 502, 'error_invitacion', 'No se ha podido completar la unión al viaje');
    }

    switch (resultado.estado) {
      case 'ok':
        // Un miembro nuevo cambia quién puede votar: se avisa a las pantallas de votaciones abiertas
        if (!resultado.ya_era_miembro) votacionesSocket.avisarCambio(resultado.viaje.id, { motivo: 'miembros' });
        return res.status(200).json({
          viaje: resultado.viaje,
          miembro: resultado.miembro,
          ya_era_miembro: resultado.ya_era_miembro,
        });
      case 'no_existe':
        return invitacionNoEncontrada(res);
      case 'viaje_no_activo':
        return responderError(res, 409, 'viaje_no_activo', 'El viaje ya no admite nuevos miembros');
      case 'sin_sesion':
        return responderError(res, 401, 'sesion_invalida', 'La sesión ha caducado o no es válida');
      default:
        return responderError(res, 502, 'error_invitacion', 'No se ha podido completar la unión al viaje');
    }
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

module.exports = { obtenerEnlace, unirse };
