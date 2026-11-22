const tareaService = require('../services/tareaService');
const { avisarEvento } = require('../utils/avisosViaje');
const { UUID_REGEX, CHECK_VIOLATION, responderError } = require('../utils/validacion');

const MAX_TEXTO = 200;

// Motivos de fallo que pueden devolver los servicios de tareas
const ERRORES = {
  no_existe: [404, 'viaje_no_encontrado', 'El viaje no existe o no perteneces a él'],
  tarea_no_existe: [404, 'tarea_no_encontrada', 'La tarea no existe en este viaje'],
  no_activo: [409, 'viaje_no_activo', 'El viaje está finalizado y ya no se puede modificar'],
  responsable_no_miembro: [400, 'datos_invalidos', 'El responsable tiene que ser miembro del viaje'],
};

const responderMotivo = (res, estado, mensajeFallo) => {
  const [codigoHttp, codigo, mensaje] = ERRORES[estado] ?? [502, 'error_tarea', mensajeFallo];
  return responderError(res, codigoHttp, codigo, mensaje);
};

const idViajeInvalido = (res) =>
  responderError(res, 400, 'datos_invalidos', 'El identificador del viaje no es válido');

const idTareaInvalido = (res) =>
  responderError(res, 400, 'datos_invalidos', 'El identificador de la tarea no es válido');

// Texto de la tarea recortado, de 1 a 200 caracteres. Devuelve { valor } | { error }
const validarTexto = (texto) => {
  const recortado = typeof texto === 'string' ? texto.trim() : '';
  if (recortado === '' || recortado.length > MAX_TEXTO) {
    return { error: `El texto debe tener entre 1 y ${MAX_TEXTO} caracteres` };
  }
  return { valor: recortado };
};

// null es válido: la tarea queda sin asignar
const validarResponsable = (responsableId) =>
  responsableId === null || (typeof responsableId === 'string' && UUID_REGEX.test(responsableId))
    ? { valor: responsableId }
    : { error: 'El responsable no es válido' };

// Cuerpo de un PATCH: al menos uno de texto, responsable_id y hecha. Devuelve { cambios } | { error }
const validarCambios = (cuerpo) => {
  const cambios = {};

  if (cuerpo?.texto !== undefined) {
    const texto = validarTexto(cuerpo.texto);
    if (texto.error) return { error: texto.error };
    cambios.texto = texto.valor;
  }
  if (cuerpo?.responsable_id !== undefined) {
    const responsable = validarResponsable(cuerpo.responsable_id);
    if (responsable.error) return { error: responsable.error };
    cambios.responsableId = responsable.valor;
  }
  if (cuerpo?.hecha !== undefined) {
    if (typeof cuerpo.hecha !== 'boolean') return { error: 'El campo hecha debe ser verdadero o falso' };
    cambios.hecha = cuerpo.hecha;
  }

  if (Object.keys(cambios).length === 0) {
    return { error: 'Indica al menos un campo que cambiar: texto, responsable_id o hecha' };
  }
  return { cambios };
};

const listar = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);

  try {
    const resultado = await tareaService.listar(req.supabase, req.usuario.id, viajeId);

    if (resultado.error) return responderError(res, 502, 'error_tarea', 'No se han podido obtener las tareas');
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se han podido obtener las tareas');
    return res.status(200).json({ tareas: resultado.tareas });
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const crear = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);

  const texto = validarTexto(req.body?.texto);
  if (texto.error) return responderError(res, 400, 'datos_invalidos', texto.error);
  // Sin responsable_id (o null) la tarea se crea sin asignar
  const responsable = validarResponsable(req.body?.responsable_id ?? null);
  if (responsable.error) return responderError(res, 400, 'datos_invalidos', responsable.error);

  try {
    const resultado = await tareaService.crear(req.supabase, req.usuario.id, viajeId, {
      texto: texto.valor,
      responsableId: responsable.valor,
    });

    if (resultado.error) {
      if (resultado.error.code === CHECK_VIOLATION) {
        return responderError(res, 400, 'datos_invalidos', 'Los datos de la tarea no son válidos');
      }
      return responderError(res, 502, 'error_tarea', 'No se ha podido crear la tarea');
    }
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se ha podido crear la tarea');
    void avisarEvento(req.supabase, req.usuario.id, viajeId, 'tarea', resultado.tarea.texto);
    return res.status(201).json(resultado.tarea);
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const editar = async (req, res) => {
  const { viajeId, tareaId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);
  if (!UUID_REGEX.test(tareaId)) return idTareaInvalido(res);

  const validacion = validarCambios(req.body);
  if (validacion.error) return responderError(res, 400, 'datos_invalidos', validacion.error);

  try {
    const resultado = await tareaService.editar(req.supabase, req.usuario.id, viajeId, tareaId, validacion.cambios);

    if (resultado.error) {
      if (resultado.error.code === CHECK_VIOLATION) {
        return responderError(res, 400, 'datos_invalidos', 'Los datos de la tarea no son válidos');
      }
      return responderError(res, 502, 'error_tarea', 'No se ha podido actualizar la tarea');
    }
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se ha podido actualizar la tarea');
    return res.status(200).json(resultado.tarea);
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const borrar = async (req, res) => {
  const { viajeId, tareaId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);
  if (!UUID_REGEX.test(tareaId)) return idTareaInvalido(res);

  try {
    const resultado = await tareaService.borrar(req.supabase, req.usuario.id, viajeId, tareaId);

    if (resultado.error) return responderError(res, 502, 'error_tarea', 'No se ha podido eliminar la tarea');
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se ha podido eliminar la tarea');
    return res.status(204).end();
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

module.exports = { listar, crear, editar, borrar };
