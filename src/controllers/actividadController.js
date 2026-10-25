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

const validarTitulo = (valor) => {
  const titulo = typeof valor === 'string' ? valor.trim() : '';
  if (titulo === '' || titulo.length > MAX_TITULO) {
    return { error: `El título es obligatorio y tiene un máximo de ${MAX_TITULO} caracteres` };
  }
  return { valor: titulo };
};

const validarFecha = (valor) => {
  if (typeof valor !== 'string' || !fechaValida(valor)) {
    return { error: 'La fecha es obligatoria y debe tener el formato AAAA-MM-DD' };
  }
  return { valor };
};

const validarHoraInicio = (valor) => {
  const hora = textoOpcional(valor);
  if (hora === undefined || (hora !== null && !HORA_REGEX.test(hora))) {
    return { error: 'La hora debe tener el formato HH:MM' };
  }
  return { valor: hora };
};

const validarHoraFin = (valor) => {
  const hora = textoOpcional(valor);
  if (hora === undefined || (hora !== null && !HORA_REGEX.test(hora))) {
    return { error: 'La hora de fin debe tener el formato HH:MM' };
  }
  return { valor: hora };
};

const validarCategoria = (valor) => {
  const categoria = textoOpcional(valor);
  if (categoria === undefined || (categoria !== null && !CATEGORIAS.includes(categoria))) {
    return { error: 'La categoría debe ser comida, cultura, transporte, alojamiento u otro' };
  }
  return { valor: categoria };
};

const validarUbicacion = (valor) => {
  const ubicacion = textoOpcional(valor);
  if (ubicacion === undefined || (ubicacion !== null && ubicacion.length > MAX_UBICACION)) {
    return { error: `La ubicación debe ser un texto de ${MAX_UBICACION} caracteres como máximo` };
  }
  return { valor: ubicacion };
};

const validarNuevaActividad = (cuerpo) => {
  const datos = cuerpo !== null && typeof cuerpo === 'object' ? cuerpo : {};

  const titulo = validarTitulo(datos.titulo);
  if (titulo.error) return titulo;
  const fecha = validarFecha(datos.fecha);
  if (fecha.error) return fecha;
  const horaInicio = validarHoraInicio(datos.hora_inicio);
  if (horaInicio.error) return horaInicio;

  const horaFin = validarHoraFin(datos.hora_fin);
  if (horaFin.error) return horaFin;
  if (horaFin.valor !== null && horaInicio.valor === null) {
    return { error: 'La hora de fin necesita una hora de inicio' };
  }
  if (horaFin.valor !== null && horaFin.valor < horaInicio.valor) {
    return { error: 'La hora de fin no puede ser anterior a la de inicio' };
  }

  const categoria = validarCategoria(datos.categoria);
  if (categoria.error) return categoria;
  const ubicacion = validarUbicacion(datos.ubicacion_nombre);
  if (ubicacion.error) return ubicacion;

  return {
    datos: {
      titulo: titulo.valor,
      fecha: fecha.valor,
      hora_inicio: horaInicio.valor,
      hora_fin: horaFin.valor,
      ubicacion_nombre: ubicacion.valor,
      categoria: categoria.valor,
    },
  };
};

const CAMPOS_EDITABLES = {
  titulo: validarTitulo,
  fecha: validarFecha,
  hora_inicio: validarHoraInicio,
  hora_fin: validarHoraFin,
  ubicacion_nombre: validarUbicacion,
  categoria: validarCategoria,
};

const validarCambiosActividad = (cuerpo) => {
  const datos = cuerpo !== null && typeof cuerpo === 'object' ? cuerpo : {};
  const cambios = {};

  for (const [campo, validar] of Object.entries(CAMPOS_EDITABLES)) {
    if (!Object.hasOwn(datos, campo)) continue;
    const resultado = validar(datos[campo]);
    if (resultado.error) return resultado;
    cambios[campo] = resultado.valor;
  }

  if (Object.keys(cambios).length === 0) {
    return { error: 'Indica al menos un dato de la actividad que cambiar' };
  }
  return { cambios };
};

const ERRORES = {
  no_existe: [404, 'viaje_no_encontrado', 'El viaje no existe o no perteneces a él'],
  no_encontrada: [404, 'actividad_no_encontrada', 'La actividad no existe en este viaje'],
  no_activo: [409, 'viaje_no_activo', 'El viaje está cerrado y ya no se puede modificar'],
  hora_fin_sin_inicio: [400, 'datos_invalidos', 'La hora de fin necesita una hora de inicio'],
  horas_invertidas: [400, 'datos_invalidos', 'La hora de fin no puede ser anterior a la de inicio'],
};

const responderMotivo = (res, estado, mensajeFallo) => {
  const [codigoHttp, codigo, mensaje] = ERRORES[estado] ?? [502, 'error_actividad', mensajeFallo];
  return responderError(res, codigoHttp, codigo, mensaje);
};

const idViajeInvalido = (res) =>
  responderError(res, 400, 'datos_invalidos', 'El identificador del viaje no es válido');

const idsInvalidos = (res) =>
  responderError(res, 400, 'datos_invalidos', 'El identificador del viaje o de la actividad no es válido');

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

const editar = async (req, res) => {
  const { viajeId, actividadId } = req.params;
  if (!UUID_REGEX.test(viajeId) || !UUID_REGEX.test(actividadId)) return idsInvalidos(res);

  const validacion = validarCambiosActividad(req.body);
  if (validacion.error) return responderError(res, 400, 'datos_invalidos', validacion.error);

  try {
    const resultado = await actividadService.editar(req.supabase, req.usuario.id, viajeId, actividadId, validacion.cambios);

    if (resultado.error) {
      if (resultado.error.code === CHECK_VIOLATION) {
        return responderError(res, 400, 'datos_invalidos', 'Los datos de la actividad no son válidos');
      }
      return responderError(res, 502, 'error_actividad', 'No se ha podido modificar la actividad');
    }
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se ha podido modificar la actividad');
    return res.status(200).json(resultado.actividad);
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const eliminar = async (req, res) => {
  const { viajeId, actividadId } = req.params;
  if (!UUID_REGEX.test(viajeId) || !UUID_REGEX.test(actividadId)) return idsInvalidos(res);

  try {
    const resultado = await actividadService.eliminar(req.supabase, req.usuario.id, viajeId, actividadId);

    if (resultado.error) return responderError(res, 502, 'error_actividad', 'No se ha podido eliminar la actividad');
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se ha podido eliminar la actividad');
    return res.status(204).end();
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

module.exports = { listar, crear, editar, eliminar };
