const resumenService = require('../services/resumenService');
const { UUID_REGEX, responderError } = require('../utils/validacion');

const obtener = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) {
    return responderError(res, 400, 'datos_invalidos', 'El identificador del viaje no es válido');
  }

  try {
    const resultado = await resumenService.obtener(req.supabase, req.usuario.id, viajeId);

    if (resultado.error) {
      return responderError(res, 502, 'error_resumen', 'No se ha podido calcular el resumen del viaje');
    }
    if (resultado.estado === 'no_existe') {
      return responderError(res, 404, 'viaje_no_encontrado', 'El viaje no existe o no perteneces a él');
    }
    return res.status(200).json(resultado.resumen);
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

module.exports = { obtener };
