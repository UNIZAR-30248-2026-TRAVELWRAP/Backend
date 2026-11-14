const selloService = require('../services/selloService');
const { DISENOS_SELLO } = require('../utils/sellos');
const { UUID_REGEX, CHECK_VIOLATION, responderError } = require('../utils/validacion');

// Motivos de fallo que pueden devolver los servicios de sellos
const ERRORES = {
  no_existe: [404, 'viaje_no_encontrado', 'El viaje no existe o no perteneces a él'],
  no_terminado: [409, 'viaje_no_terminado', 'El viaje todavía no ha terminado'],
};

const responderMotivo = (res, estado, mensajeFallo) => {
  const [codigoHttp, codigo, mensaje] = ERRORES[estado] ?? [502, 'error_sello', mensajeFallo];
  return responderError(res, codigoHttp, codigo, mensaje);
};

const idViajeInvalido = (res) =>
  responderError(res, 400, 'datos_invalidos', 'El identificador del viaje no es válido');

const obtener = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);

  try {
    const resultado = await selloService.obtener(req.supabase, req.usuario.id, viajeId);

    if (resultado.error) return responderError(res, 502, 'error_sello', 'No se ha podido obtener el sello');
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se ha podido obtener el sello');
    return res.status(200).json({ sello: resultado.sello });
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const elegir = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);

  const diseno = req.body?.diseno;
  if (!DISENOS_SELLO.includes(diseno)) {
    return responderError(res, 400, 'diseno_invalido', `El diseño debe ser uno de: ${DISENOS_SELLO.join(', ')}`);
  }

  try {
    const resultado = await selloService.elegir(req.supabase, req.usuario.id, viajeId, diseno);

    if (resultado.error) {
      if (resultado.error.code === CHECK_VIOLATION) {
        return responderError(res, 400, 'datos_invalidos', 'Los datos del sello no son válidos');
      }
      return responderError(res, 502, 'error_sello', 'No se ha podido guardar el sello');
    }
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se ha podido guardar el sello');
    return res.status(200).json({ sello: resultado.sello });
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const quitar = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);

  try {
    const resultado = await selloService.quitar(req.supabase, req.usuario.id, viajeId);

    if (resultado.error) return responderError(res, 502, 'error_sello', 'No se ha podido quitar el sello');
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se ha podido quitar el sello');
    return res.status(204).end();
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

module.exports = { obtener, elegir, quitar };
