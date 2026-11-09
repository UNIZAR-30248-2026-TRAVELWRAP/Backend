const rutaService = require('../services/rutaService');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const responderError = (res, estado, codigo, mensaje) =>
  res.status(estado).json({ error: { codigo, mensaje } });

const fechaValida = (texto) => {
  if (!FECHA_REGEX.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().startsWith(texto);
};

const ERRORES = {
  no_existe: [404, 'viaje_no_encontrado', 'El viaje no existe o no perteneces a él'],
  demasiados_puntos: [
    400,
    'datos_invalidos',
    `Hay demasiadas actividades con ubicación para trazar la ruta (máximo ${rutaService.MAX_PUNTOS})`,
  ],
  sin_ruta: [422, 'sin_ruta', 'No se ha encontrado un camino entre las actividades de ese día'],
  demasiado_rapido: [429, 'demasiadas_rutas', 'Espera un segundo entre un cálculo de ruta y otro'],
  ocupado: [429, 'servicio_ocupado', 'Hay muchos cálculos de ruta en este momento. Inténtalo de nuevo en unos segundos'],
};

const calcular = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) {
    return responderError(res, 400, 'datos_invalidos', 'El identificador del viaje no es válido');
  }

  const { fecha } = req.query;
  if (typeof fecha !== 'string' || !fechaValida(fecha)) {
    return responderError(res, 400, 'datos_invalidos', 'La fecha es obligatoria y debe tener el formato AAAA-MM-DD');
  }

  try {
    const resultado = await rutaService.calcular(req.supabase, req.usuario.id, viajeId, fecha);

    if (resultado.error) return responderError(res, 502, 'error_ruta', 'No se ha podido calcular la ruta');
    if (resultado.estado !== 'ok') {
      const [codigoHttp, codigo, mensaje] = ERRORES[resultado.estado] ?? [
        502,
        'error_ruta',
        'No se ha podido calcular la ruta',
      ];
      return responderError(res, codigoHttp, codigo, mensaje);
    }
    return res.status(200).json({
      puntos: resultado.puntos,
      orden_sugerido: resultado.orden_sugerido,
      ahorro_m: resultado.ahorro_m,
      ruta: resultado.ruta,
    });
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

module.exports = { calcular };
