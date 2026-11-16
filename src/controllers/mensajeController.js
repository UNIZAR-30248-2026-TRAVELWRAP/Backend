const mensajeService = require('../services/mensajeService');
const chatSocket = require('../sockets/chatSocket');
const { UUID_REGEX, responderError } = require('../utils/validacion');

const MAX_TEXTO = 1000;

// Motivos de fallo que pueden devolver los servicios de mensajes
const ERRORES = {
  no_existe: [404, 'viaje_no_encontrado', 'El viaje no existe o no perteneces a él'],
  no_activo: [409, 'viaje_no_activo', 'El viaje está finalizado y ya no se puede modificar'],
};

const responderMotivo = (res, estado, mensajeFallo) => {
  const [codigoHttp, codigo, mensaje] = ERRORES[estado] ?? [502, 'error_mensaje', mensajeFallo];
  return responderError(res, codigoHttp, codigo, mensaje);
};

const idViajeInvalido = (res) =>
  responderError(res, 400, 'datos_invalidos', 'El identificador del viaje no es válido');

// Texto del mensaje sin espacios sobrantes, de 1 a 1000 caracteres. Devuelve { valor } | { error }
const validarTexto = (texto) => {
  const recortado = typeof texto === 'string' ? texto.trim() : '';
  if (recortado === '' || recortado.length > MAX_TEXTO) {
    return { error: `El mensaje debe tener entre 1 y ${MAX_TEXTO} caracteres` };
  }
  return { valor: recortado };
};

// Mensajes anteriores a una fecha (?antes=). Sin el parámetro se devuelven los más recientes
const listar = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);

  const { antes } = req.query;
  const fecha = antes === undefined ? undefined : new Date(antes);
  if (fecha !== undefined && Number.isNaN(fecha.getTime())) {
    return responderError(res, 400, 'datos_invalidos', 'La fecha de antes no es válida');
  }

  try {
    const resultado = await mensajeService.listar(
      req.supabase,
      req.usuario.id,
      viajeId,
      fecha?.toISOString(),
    );

    if (resultado.error) return responderError(res, 502, 'error_mensaje', 'No se han podido obtener los mensajes');
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se han podido obtener los mensajes');
    return res.status(200).json({ mensajes: resultado.mensajes });
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const crear = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);

  const texto = validarTexto(req.body?.texto);
  if (texto.error) return responderError(res, 400, 'datos_invalidos', texto.error);

  try {
    const resultado = await mensajeService.crear(req.supabase, req.usuario.id, viajeId, texto.valor);

    if (resultado.error) return responderError(res, 502, 'error_mensaje', 'No se ha podido enviar el mensaje');
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se ha podido enviar el mensaje');
    // Solo después de guardarlo: los miembros conectados lo reciben con el mismo formato que la respuesta
    chatSocket.avisarMensaje(viajeId, resultado.mensaje);
    return res.status(201).json(resultado.mensaje);
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

module.exports = { listar, crear };
