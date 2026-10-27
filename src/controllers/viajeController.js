const viajeService = require('../services/viajeService');
const { UUID_REGEX, CHECK_VIOLATION, responderError, fechaValida, textoOpcional } = require('../utils/validacion');

const ESTADOS = ['activo', 'finalizado', 'archivado'];
const MAX_TEXTO = 100;
const MAX_PRESUPUESTO = 1e10; // numeric(12,2): 10 dígitos enteros

const FECHAS_INVERTIDAS = 'La fecha de fin no puede ser anterior a la de inicio';

// Validadores de cada campo del viaje: devuelven { valor } o { error }
const validarNombre = (valor) => {
  const nombre = typeof valor === 'string' ? valor.trim() : '';
  if (nombre === '' || nombre.length > MAX_TEXTO) {
    return { error: `El nombre es obligatorio y tiene un máximo de ${MAX_TEXTO} caracteres` };
  }
  return { valor: nombre };
};

const validarPresupuesto = (presupuesto) => {
  if (typeof presupuesto !== 'number' || !Number.isFinite(presupuesto) || presupuesto < 0 || presupuesto >= MAX_PRESUPUESTO) {
    return { error: 'El presupuesto es obligatorio y debe ser un número entre 0 y 9999999999' };
  }
  return { valor: presupuesto };
};

// Al crear, un destino vacío deja el viaje pendiente de votación
const validarDestino = (valor) => {
  const destino = textoOpcional(valor);
  if (destino === undefined || (destino !== null && destino.length > MAX_TEXTO)) {
    return { error: `El destino debe ser un texto de ${MAX_TEXTO} caracteres como máximo` };
  }
  return { valor: destino };
};

// Al editar, el destino se puede cambiar pero no quitar
const validarDestinoEditado = (valor) => {
  const resultado = validarDestino(valor);
  if (resultado.valor === null) return { error: 'El destino no puede quedar vacío' };
  return resultado;
};

const validarFecha = (valor) => {
  const fecha = textoOpcional(valor);
  if (fecha === undefined || (fecha !== null && !fechaValida(fecha))) {
    return { error: 'Las fechas deben tener el formato AAAA-MM-DD' };
  }
  return { valor: fecha };
};

const validarNuevoViaje = (cuerpo) => {
  const datos = cuerpo ?? {};

  const nombre = validarNombre(datos.nombre);
  if (nombre.error) return nombre;
  const presupuesto = validarPresupuesto(datos.presupuesto);
  if (presupuesto.error) return presupuesto;
  const destino = validarDestino(datos.destino);
  if (destino.error) return destino;
  const fechaInicio = validarFecha(datos.fecha_inicio);
  if (fechaInicio.error) return fechaInicio;
  const fechaFin = validarFecha(datos.fecha_fin);
  if (fechaFin.error) return fechaFin;
  if (fechaInicio.valor && fechaFin.valor && fechaFin.valor < fechaInicio.valor) {
    return { error: FECHAS_INVERTIDAS };
  }

  return {
    datos: {
      nombre: nombre.valor,
      presupuesto: presupuesto.valor,
      destino: destino.valor,
      fechaInicio: fechaInicio.valor,
      fechaFin: fechaFin.valor,
    },
  };
};

// Campos que se pueden cambiar al editar un viaje (con el nombre de su columna) y su validador
const CAMPOS_EDITABLES = {
  nombre: validarNombre,
  presupuesto: validarPresupuesto,
  destino: validarDestinoEditado,
  fecha_inicio: validarFecha,
  fecha_fin: validarFecha,
};

// Al editar solo se envían los campos que cambian (al menos uno). Los campos desconocidos se ignoran
const validarCambiosViaje = (cuerpo) => {
  const datos = cuerpo !== null && typeof cuerpo === 'object' ? cuerpo : {};
  const cambios = {};

  for (const [campo, validar] of Object.entries(CAMPOS_EDITABLES)) {
    if (!Object.hasOwn(datos, campo)) continue;
    const resultado = validar(datos[campo]);
    if (resultado.error) return resultado;
    cambios[campo] = resultado.valor;
  }

  if (Object.keys(cambios).length === 0) {
    return { error: 'Indica al menos un dato del viaje que cambiar' };
  }
  if (cambios.fecha_inicio && cambios.fecha_fin && cambios.fecha_fin < cambios.fecha_inicio) {
    return { error: FECHAS_INVERTIDAS };
  }
  return { cambios };
};

// Respuesta de error para cada motivo por el que no se puede editar, archivar o eliminar un viaje
const ERRORES_GESTION = {
  no_existe: [404, 'viaje_no_encontrado', 'El viaje no existe o no perteneces a él'],
  no_creador: [403, 'no_creador', 'Solo el creador del viaje puede hacerlo'],
  no_activo: [409, 'viaje_no_activo', 'El viaje está cerrado y ya no se puede modificar'],
  ya_archivado: [409, 'viaje_archivado', 'El viaje ya está archivado'],
  no_archivado: [409, 'viaje_no_archivado', 'Solo se pueden eliminar viajes archivados'],
};

const responderMotivo = (res, estado, mensajeFallo) => {
  const [codigoHttp, codigo, mensaje] = ERRORES_GESTION[estado] ?? [502, 'error_viaje', mensajeFallo];
  return responderError(res, codigoHttp, codigo, mensaje);
};

const idInvalido = (res) => responderError(res, 400, 'datos_invalidos', 'El identificador del viaje no es válido');

const listar = async (req, res) => {
  const { estado } = req.query;
  if (estado !== undefined && !ESTADOS.includes(estado)) {
    return responderError(res, 400, 'datos_invalidos', 'El estado debe ser activo, finalizado o archivado');
  }

  try {
    const resultado = await viajeService.listar(req.supabase, req.usuario.id, estado);
    if (resultado.error) {
      return responderError(res, 502, 'error_viaje', 'No se han podido obtener los viajes');
    }
    return res.status(200).json({ viajes: resultado.viajes });
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const obtener = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idInvalido(res);

  try {
    const resultado = await viajeService.obtener(req.supabase, req.usuario.id, viajeId);
    if (resultado.error) {
      return responderError(res, 502, 'error_viaje', 'No se ha podido obtener el viaje');
    }
    if (!resultado.viaje) {
      return responderError(res, 404, 'viaje_no_encontrado', 'El viaje no existe o no perteneces a él');
    }
    return res.status(200).json(resultado.viaje);
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const crear = async (req, res) => {
  const validacion = validarNuevoViaje(req.body);
  if (validacion.error) return responderError(res, 400, 'datos_invalidos', validacion.error);

  try {
    const resultado = await viajeService.crear(req.supabase, validacion.datos);

    if (resultado.error) {
      if (resultado.error.code === CHECK_VIOLATION) {
        return responderError(res, 400, 'datos_invalidos', 'Los datos del viaje no son válidos');
      }
      return responderError(res, 502, 'error_viaje', 'No se ha podido crear el viaje');
    }
    if (resultado.estado === 'sin_sesion') {
      return responderError(res, 401, 'sesion_invalida', 'La sesión ha caducado o no es válida');
    }
    if (resultado.estado !== 'ok') {
      return responderError(res, 502, 'error_viaje', 'No se ha podido crear el viaje');
    }
    return res.status(201).json(resultado.viaje);
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const editar = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idInvalido(res);

  const validacion = validarCambiosViaje(req.body);
  if (validacion.error) return responderError(res, 400, 'datos_invalidos', validacion.error);

  try {
    const resultado = await viajeService.editar(req.supabase, req.usuario.id, viajeId, validacion.cambios);

    if (resultado.error) {
      // Solo puede fallar el CHECK de las fechas: p. ej. una fecha de fin anterior a la de inicio ya guardada
      if (resultado.error.code === CHECK_VIOLATION) {
        return responderError(res, 400, 'datos_invalidos', FECHAS_INVERTIDAS);
      }
      return responderError(res, 502, 'error_viaje', 'No se ha podido modificar el viaje');
    }
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se ha podido modificar el viaje');
    return res.status(200).json(resultado.viaje);
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const archivar = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idInvalido(res);

  try {
    const resultado = await viajeService.archivar(req.supabase, req.usuario.id, viajeId);

    if (resultado.error) return responderError(res, 502, 'error_viaje', 'No se ha podido archivar el viaje');
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se ha podido archivar el viaje');
    return res.status(200).json(resultado.viaje);
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const eliminar = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idInvalido(res);

  try {
    const resultado = await viajeService.eliminar(req.supabase, req.usuario.id, viajeId);

    if (resultado.error) return responderError(res, 502, 'error_viaje', 'No se ha podido eliminar el viaje');
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se ha podido eliminar el viaje');
    return res.status(204).end();
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

module.exports = { listar, obtener, crear, editar, archivar, eliminar };
