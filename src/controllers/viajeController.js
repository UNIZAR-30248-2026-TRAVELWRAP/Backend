const viajeService = require('../services/viajeService');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ESTADOS = ['activo', 'finalizado', 'archivado'];
const MAX_TEXTO = 100;
const MAX_PRESUPUESTO = 1e10; // numeric(12,2): 10 dígitos enteros

// Código de PostgreSQL cuando se incumple un CHECK (p. ej. fecha_fin < fecha_inicio o presupuesto < 0)
const CHECK_VIOLATION = '23514';

const responderError = (res, estado, codigo, mensaje) =>
  res.status(estado).json({ error: { codigo, mensaje } });

const fechaValida = (texto) => {
  if (!FECHA_REGEX.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().startsWith(texto);
};

// Texto opcional: null, ausente o vacío → null. Devuelve undefined si no es un texto válido
const textoOpcional = (valor) => {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string') return undefined;
  const texto = valor.trim();
  return texto === '' ? null : texto;
};

const validarNuevoViaje = (cuerpo) => {
  const datos = cuerpo ?? {};

  const nombre = typeof datos.nombre === 'string' ? datos.nombre.trim() : '';
  if (nombre === '' || nombre.length > MAX_TEXTO) {
    return { error: `El nombre es obligatorio y tiene un máximo de ${MAX_TEXTO} caracteres` };
  }

  const { presupuesto } = datos;
  if (typeof presupuesto !== 'number' || !Number.isFinite(presupuesto) || presupuesto < 0 || presupuesto >= MAX_PRESUPUESTO) {
    return { error: 'El presupuesto es obligatorio y debe ser un número entre 0 y 9999999999' };
  }

  const destino = textoOpcional(datos.destino);
  if (destino === undefined || (destino !== null && destino.length > MAX_TEXTO)) {
    return { error: `El destino debe ser un texto de ${MAX_TEXTO} caracteres como máximo` };
  }

  const fechaInicio = textoOpcional(datos.fecha_inicio);
  const fechaFin = textoOpcional(datos.fecha_fin);
  const fechas = [fechaInicio, fechaFin];
  if (fechas.some((f) => f === undefined || (f !== null && !fechaValida(f)))) {
    return { error: 'Las fechas deben tener el formato AAAA-MM-DD' };
  }
  if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
    return { error: 'La fecha de fin no puede ser anterior a la de inicio' };
  }

  return { datos: { nombre, presupuesto, destino, fechaInicio, fechaFin } };
};

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
  if (!UUID_REGEX.test(viajeId)) {
    return responderError(res, 400, 'datos_invalidos', 'El identificador del viaje no es válido');
  }

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

module.exports = { listar, obtener, crear };
