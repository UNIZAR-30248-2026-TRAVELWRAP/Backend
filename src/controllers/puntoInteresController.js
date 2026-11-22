const puntoInteresService = require('../services/puntoInteresService');
const { UUID_REGEX, CHECK_VIOLATION, responderError, textoOpcional } = require('../utils/validacion');

const MAX_NOMBRE = 120;
const MAX_NOTA = 300;
const MAX_LUGAR_EXTERNO = 100;
const MAX_DIRECCION = 300;
const CATEGORIAS = ['comida', 'cultura', 'transporte', 'alojamiento', 'otro'];

const validarNombre = (valor) => {
  const nombre = typeof valor === 'string' ? valor.trim() : '';
  if (nombre === '' || nombre.length > MAX_NOMBRE) {
    return { error: `El nombre es obligatorio y tiene un máximo de ${MAX_NOMBRE} caracteres` };
  }
  return { valor: nombre };
};

const validarNota = (valor) => {
  const nota = textoOpcional(valor);
  if (nota === undefined || (nota !== null && nota.length > MAX_NOTA)) {
    return { error: `La nota debe ser un texto de ${MAX_NOTA} caracteres como máximo` };
  }
  return { valor: nota };
};

const validarCategoria = (valor) => {
  const categoria = textoOpcional(valor);
  if (categoria === undefined || (categoria !== null && !CATEGORIAS.includes(categoria))) {
    return { error: 'La categoría debe ser comida, cultura, transporte, alojamiento u otro' };
  }
  return { valor: categoria };
};

const validarCoordenada = (valor, limite, nombre) => {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || Math.abs(valor) > limite) {
    return { error: `La ${nombre} es obligatoria y debe ser un número entre -${limite} y ${limite}` };
  }
  return { valor: Math.round(valor * 1e6) / 1e6 };
};

const validarLugarExterno = (valor) => {
  const lugar = textoOpcional(valor);
  if (lugar === undefined || (lugar !== null && lugar.length > MAX_LUGAR_EXTERNO)) {
    return { error: `El identificador del lugar debe ser un texto de ${MAX_LUGAR_EXTERNO} caracteres como máximo` };
  }
  return { valor: lugar };
};

const validarDireccion = (valor) => {
  const direccion = textoOpcional(valor);
  if (direccion === undefined || (direccion !== null && direccion.length > MAX_DIRECCION)) {
    return { error: `La dirección debe ser un texto de ${MAX_DIRECCION} caracteres como máximo` };
  }
  return { valor: direccion };
};

const validarNuevoPunto = (cuerpo) => {
  const datos = cuerpo !== null && typeof cuerpo === 'object' ? cuerpo : {};

  const nombre = validarNombre(datos.nombre);
  if (nombre.error) return nombre;
  const nota = validarNota(datos.nota);
  if (nota.error) return nota;
  const categoria = validarCategoria(datos.categoria);
  if (categoria.error) return categoria;
  const latitud = validarCoordenada(datos.latitud, 90, 'latitud');
  if (latitud.error) return latitud;
  const longitud = validarCoordenada(datos.longitud, 180, 'longitud');
  if (longitud.error) return longitud;
  const lugarExterno = validarLugarExterno(datos.lugar_externo_id);
  if (lugarExterno.error) return lugarExterno;
  const direccion = validarDireccion(datos.direccion);
  if (direccion.error) return direccion;

  return {
    datos: {
      nombre: nombre.valor,
      nota: nota.valor,
      categoria: categoria.valor,
      latitud: latitud.valor,
      longitud: longitud.valor,
      lugar_externo_id: lugarExterno.valor,
      direccion: direccion.valor,
    },
  };
};

const ERRORES = {
  no_existe: [404, 'viaje_no_encontrado', 'El viaje no existe o no perteneces a él'],
  no_encontrado: [404, 'punto_no_encontrado', 'El punto de interés no existe en este viaje'],
  no_activo: [409, 'viaje_no_activo', 'El viaje está finalizado y ya no se puede modificar'],
};

const responderMotivo = (res, estado, mensajeFallo) => {
  const [codigoHttp, codigo, mensaje] = ERRORES[estado] ?? [502, 'error_punto_interes', mensajeFallo];
  return responderError(res, codigoHttp, codigo, mensaje);
};

const idViajeInvalido = (res) =>
  responderError(res, 400, 'datos_invalidos', 'El identificador del viaje no es válido');

const idsInvalidos = (res) =>
  responderError(res, 400, 'datos_invalidos', 'El identificador del viaje o del punto de interés no es válido');

const listar = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);

  try {
    const resultado = await puntoInteresService.listar(req.supabase, req.usuario.id, viajeId);

    if (resultado.error) {
      return responderError(res, 502, 'error_punto_interes', 'No se han podido obtener los puntos de interés');
    }
    if (resultado.estado !== 'ok') {
      return responderMotivo(res, resultado.estado, 'No se han podido obtener los puntos de interés');
    }
    return res.status(200).json({ puntos_interes: resultado.puntos_interes });
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const crear = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);

  const validacion = validarNuevoPunto(req.body);
  if (validacion.error) return responderError(res, 400, 'datos_invalidos', validacion.error);

  try {
    const resultado = await puntoInteresService.crear(req.supabase, req.usuario.id, viajeId, validacion.datos);

    if (resultado.error) {
      if (resultado.error.code === CHECK_VIOLATION) {
        return responderError(res, 400, 'datos_invalidos', 'Los datos del punto de interés no son válidos');
      }
      return responderError(res, 502, 'error_punto_interes', 'No se ha podido crear el punto de interés');
    }
    if (resultado.estado !== 'ok') {
      return responderMotivo(res, resultado.estado, 'No se ha podido crear el punto de interés');
    }
    return res.status(201).json(resultado.punto);
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const eliminar = async (req, res) => {
  const { viajeId, puntoId } = req.params;
  if (!UUID_REGEX.test(viajeId) || !UUID_REGEX.test(puntoId)) return idsInvalidos(res);

  try {
    const resultado = await puntoInteresService.eliminar(req.supabase, req.usuario.id, viajeId, puntoId);

    if (resultado.error) {
      return responderError(res, 502, 'error_punto_interes', 'No se ha podido eliminar el punto de interés');
    }
    if (resultado.estado !== 'ok') {
      return responderMotivo(res, resultado.estado, 'No se ha podido eliminar el punto de interés');
    }
    return res.status(204).end();
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

module.exports = { listar, crear, eliminar };
