const actividadService = require('../services/actividadService');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_TITULO = 200;
const MAX_UBICACION = 200;
const CATEGORIAS = ['comida', 'cultura', 'transporte', 'alojamiento', 'otro'];

const CHECK_VIOLATION = '23514';

const responderError = (res, estado, codigo, mensaje) =>
  res.status(estado).json({ error: { codigo, mensaje } });

const fechaValida = (texto) => {
  if (!FECHA_REGEX.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().startsWith(texto);
};

const textoOpcional = (valor) => {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string') return undefined;
  const texto = valor.trim();
  return texto === '' ? null : texto;
};

const validarNuevaActividad = (cuerpo) => {
  const datos = cuerpo !== null && typeof cuerpo === 'object' ? cuerpo : {};

  const titulo = typeof datos.titulo === 'string' ? datos.titulo.trim() : '';
  if (titulo === '' || titulo.length > MAX_TITULO) {
    return { error: `El título es obligatorio y tiene un máximo de ${MAX_TITULO} caracteres` };
  }

  if (typeof datos.fecha !== 'string' || !fechaValida(datos.fecha)) {
    return { error: 'La fecha es obligatoria y debe tener el formato AAAA-MM-DD' };
  }

  const horaInicio = textoOpcional(datos.hora_inicio);
  if (horaInicio === undefined || (horaInicio !== null && !HORA_REGEX.test(horaInicio))) {
    return { error: 'La hora debe tener el formato HH:MM' };
  }

  const horaFin = textoOpcional(datos.hora_fin);
  if (horaFin === undefined || (horaFin !== null && !HORA_REGEX.test(horaFin))) {
    return { error: 'La hora de fin debe tener el formato HH:MM' };
  }
  if (horaFin !== null && horaInicio === null) {
    return { error: 'La hora de fin necesita una hora de inicio' };
  }
  if (horaFin !== null && horaFin < horaInicio) {
    return { error: 'La hora de fin no puede ser anterior a la de inicio' };
  }

  const categoria = textoOpcional(datos.categoria);
  if (categoria === undefined || (categoria !== null && !CATEGORIAS.includes(categoria))) {
    return { error: 'La categoría debe ser comida, cultura, transporte, alojamiento u otro' };
  }

  const ubicacion = textoOpcional(datos.ubicacion_nombre);
  if (ubicacion === undefined || (ubicacion !== null && ubicacion.length > MAX_UBICACION)) {
    return { error: `La ubicación debe ser un texto de ${MAX_UBICACION} caracteres como máximo` };
  }

  return {
    datos: {
      titulo,
      fecha: datos.fecha,
      hora_inicio: horaInicio,
      hora_fin: horaFin,
      ubicacion_nombre: ubicacion,
      categoria,
    },
  };
};

const ERRORES = {
  no_existe: [404, 'viaje_no_encontrado', 'El viaje no existe o no perteneces a él'],
  no_activo: [409, 'viaje_no_activo', 'El viaje está cerrado y ya no se puede modificar'],
};

const responderMotivo = (res, estado, mensajeFallo) => {
  const [codigoHttp, codigo, mensaje] = ERRORES[estado] ?? [502, 'error_actividad', mensajeFallo];
  return responderError(res, codigoHttp, codigo, mensaje);
};

const idViajeInvalido = (res) =>
  responderError(res, 400, 'datos_invalidos', 'El identificador del viaje no es válido');

const listar = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);

  const { fecha } = req.query;
  if (fecha !== undefined && (typeof fecha !== 'string' || !fechaValida(fecha))) {
    return responderError(res, 400, 'datos_invalidos', 'La fecha debe tener el formato AAAA-MM-DD');
  }

  try {
    const resultado = await actividadService.listar(req.supabase, req.usuario.id, viajeId, fecha);

    if (resultado.error) return responderError(res, 502, 'error_actividad', 'No se han podido obtener las actividades');
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se han podido obtener las actividades');
    return res.status(200).json({ actividades: resultado.actividades });
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const crear = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);

  const validacion = validarNuevaActividad(req.body);
  if (validacion.error) return responderError(res, 400, 'datos_invalidos', validacion.error);

  try {
    const resultado = await actividadService.crear(req.supabase, req.usuario.id, viajeId, validacion.datos);

    if (resultado.error) {
      if (resultado.error.code === CHECK_VIOLATION) {
        return responderError(res, 400, 'datos_invalidos', 'Los datos de la actividad no son válidos');
      }
      return responderError(res, 502, 'error_actividad', 'No se ha podido crear la actividad');
    }
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se ha podido crear la actividad');
    return res.status(201).json(resultado.actividad);
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

module.exports = { listar, crear };
