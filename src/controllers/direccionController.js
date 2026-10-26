const geocodificacionService = require('../services/geocodificacionService');

const MIN_CONSULTA = 3;
const MAX_CONSULTA = 200;

const responderError = (res, estado, codigo, mensaje) =>
  res.status(estado).json({ error: { codigo, mensaje } });

const ERRORES = {
  demasiado_rapido: [429, 'demasiadas_busquedas', 'Espera un segundo entre una búsqueda y otra'],
  ocupado: [429, 'servicio_ocupado', 'Hay muchas búsquedas en este momento. Inténtalo de nuevo en unos segundos'],
};

const buscar = async (req, res) => {
  const { q } = req.query;
  const consulta = typeof q === 'string' ? q.trim() : '';
  if (consulta.length < MIN_CONSULTA || consulta.length > MAX_CONSULTA) {
    return responderError(
      res,
      400,
      'datos_invalidos',
      `La búsqueda debe tener entre ${MIN_CONSULTA} y ${MAX_CONSULTA} caracteres`,
    );
  }

  try {
    const resultado = await geocodificacionService.buscar(consulta, req.usuario.id);

    if (resultado.error) {
      return responderError(res, 502, 'error_geocodificacion', 'No se ha podido buscar la dirección');
    }
    if (resultado.estado !== 'ok') {
      const [codigoHttp, codigo, mensaje] = ERRORES[resultado.estado] ?? [
        502,
        'error_geocodificacion',
        'No se ha podido buscar la dirección',
      ];
      return responderError(res, codigoHttp, codigo, mensaje);
    }
    return res.status(200).json({ direcciones: resultado.direcciones });
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

module.exports = { buscar };
