const gastoService = require('../services/gastoService');
const viajeService = require('../services/viajeService');
const ocrService = require('../services/ocrService');
const { clasificarDocumento } = require('../utils/ticketOcr');
const fotoEscaneoService = require('../services/fotoEscaneoService');
const { detectarTipo } = require('./documentoController');
const { UUID_REGEX, CHECK_VIOLATION, responderError, fechaValida, textoOpcional } = require('../utils/validacion');

const MAX_CONCEPTO = 100;
// numeric(12,2): diez cifras enteras y dos decimales
const MAX_IMPORTE = 9999999999.99;
const CATEGORIAS = new Set(['comida', 'transporte', 'entradas', 'alojamiento', 'ocio', 'otros']);

const validarConcepto = (valor) => {
  const concepto = typeof valor === 'string' ? valor.trim() : '';
  if (concepto === '' || concepto.length > MAX_CONCEPTO) {
    return { error: `El concepto es obligatorio y tiene un máximo de ${MAX_CONCEPTO} caracteres` };
  }
  return { valor: concepto };
};

const validarImporte = (valor) => {
  const centimos = typeof valor === 'number' ? valor * 100 : Number.NaN;
  const dosDecimales = Number.isFinite(centimos) && Math.abs(centimos - Math.round(centimos)) < 1e-6;
  if (!dosDecimales || valor <= 0 || valor > MAX_IMPORTE) {
    return { error: 'El importe debe ser un número mayor que 0 con dos decimales como máximo' };
  }
  return { valor: Math.round(centimos) / 100 };
};

const validarCategoria = (valor) => {
  const categoria = textoOpcional(valor);
  if (categoria === undefined || (categoria !== null && !CATEGORIAS.has(categoria))) {
    return { error: 'La categoría debe ser comida, transporte, entradas, alojamiento, ocio u otros' };
  }
  return { valor: categoria };
};

const validarPagadoPor = (valor) => {
  if (typeof valor !== 'string' || !UUID_REGEX.test(valor)) {
    return { error: 'Indica qué miembro del viaje ha pagado el gasto' };
  }
  return { valor };
};

const validarFecha = (valor) => {
  const fecha = textoOpcional(valor);
  if (fecha === undefined || (fecha !== null && !fechaValida(fecha))) {
    return { error: 'La fecha debe tener el formato AAAA-MM-DD' };
  }
  return { valor: fecha };
};

const validarParticipantes = (valor) => {
  const valido = Array.isArray(valor) && valor.length > 0 && valor.every((id) => typeof id === 'string' && UUID_REGEX.test(id));
  if (!valido) return { error: 'Indica al menos un miembro del viaje entre los que se divide el gasto' };

  const participantes = valor.map((id) => id.toLowerCase());
  if (new Set(participantes).size !== participantes.length) {
    return { error: 'Cada miembro solo puede aparecer una vez en el reparto' };
  }
  return { valor: participantes };
};

// La foto del ticket es opcional, pero si llega tiene que ser una foto escaneada de este mismo viaje
const validarFotoRuta = (valor, viajeId) => {
  if (valor === undefined || valor === null) return { valor: null };
  if (!fotoEscaneoService.rutaDeFotoValida(valor, viajeId)) {
    return { error: 'La foto no pertenece a este viaje o no es una foto escaneada' };
  }
  return { valor };
};

const validarNuevoGasto = (cuerpo, viajeId) => {
  const datos = cuerpo !== null && typeof cuerpo === 'object' ? cuerpo : {};

  const concepto = validarConcepto(datos.concepto);
  if (concepto.error) return concepto;
  const importe = validarImporte(datos.importe);
  if (importe.error) return importe;
  const categoria = validarCategoria(datos.categoria);
  if (categoria.error) return categoria;
  const pagadoPor = validarPagadoPor(datos.pagado_por);
  if (pagadoPor.error) return pagadoPor;
  const fecha = validarFecha(datos.fecha);
  if (fecha.error) return fecha;
  const participantes = validarParticipantes(datos.participantes);
  if (participantes.error) return participantes;
  const fotoRuta = validarFotoRuta(datos.foto_ruta, viajeId);
  if (fotoRuta.error) return fotoRuta;

  return {
    datos: {
      concepto: concepto.valor,
      importe: importe.valor,
      categoria: categoria.valor,
      pagado_por: pagadoPor.valor.toLowerCase(),
      fecha: fecha.valor,
      participantes: participantes.valor,
      // Solo si hay foto del ticket: sin ella el gasto se crea como antes
      ...(fotoRuta.valor ? { foto_ruta: fotoRuta.valor } : {}),
    },
  };
};

// Motivos de fallo que pueden devolver los servicios de gasto
const ERRORES = {
  no_existe: [404, 'viaje_no_encontrado', 'El viaje no existe o no perteneces a él'],
  no_activo: [409, 'viaje_no_activo', 'El viaje está finalizado y ya no se puede modificar'],
  no_miembro: [400, 'datos_invalidos', 'Quien paga y los participantes tienen que ser miembros del viaje'],
  no_encontrado: [404, 'gasto_no_encontrado', 'El gasto no existe o no pertenece a este viaje'],
  sin_permiso: [403, 'sin_permiso', 'Solo puede editar el gasto quien lo registró o el creador del viaje'],
  sin_deuda: [404, 'deuda_no_encontrada', 'No hay ninguna deuda saldada que deshacer'],
};

const responderMotivo = (res, estado, mensajeFallo) => {
  const [codigoHttp, codigo, mensaje] = ERRORES[estado] ?? [502, 'error_gasto', mensajeFallo];
  return responderError(res, codigoHttp, codigo, mensaje);
};

const idViajeInvalido = (res) =>
  responderError(res, 400, 'datos_invalidos', 'El identificador del viaje no es válido');

const listar = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);

  try {
    const resultado = await gastoService.listar(req.supabase, req.usuario.id, viajeId);

    if (resultado.error) return responderError(res, 502, 'error_gasto', 'No se han podido obtener los gastos');
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se han podido obtener los gastos');
    return res.status(200).json({ gastos: resultado.gastos, total: resultado.total });
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const balance = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);

  try {
    const resultado = await gastoService.balance(req.supabase, req.usuario.id, viajeId);

    if (resultado.error) return responderError(res, 502, 'error_gasto', 'No se ha podido calcular el balance');
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se ha podido calcular el balance');
    return res.status(200).json({ saldos: resultado.saldos });
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const liquidacion = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);

  try {
    const resultado = await gastoService.liquidacion(req.supabase, req.usuario.id, viajeId);

    if (resultado.error) return responderError(res, 502, 'error_gasto', 'No se ha podido calcular la liquidación');
    if (resultado.estado !== 'ok') {
      return responderMotivo(res, resultado.estado, 'No se ha podido calcular la liquidación');
    }
    return res.status(200).json({ transferencias: resultado.transferencias, saldadas: resultado.saldadas });
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const detalle = async (req, res) => {
  const { viajeId, gastoId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);
  if (!UUID_REGEX.test(gastoId)) {
    return responderError(res, 400, 'datos_invalidos', 'El identificador del gasto no es válido');
  }

  try {
    const resultado = await gastoService.detalle(req.supabase, req.usuario.id, viajeId, gastoId);

    if (resultado.error) return responderError(res, 502, 'error_gasto', 'No se ha podido obtener el gasto');
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se ha podido obtener el gasto');
    return res.status(200).json(resultado.gasto);
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const editar = async (req, res) => {
  const { viajeId, gastoId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);
  if (!UUID_REGEX.test(gastoId)) {
    return responderError(res, 400, 'datos_invalidos', 'El identificador del gasto no es válido');
  }

  const validacion = validarNuevoGasto(req.body, viajeId);
  if (validacion.error) return responderError(res, 400, 'datos_invalidos', validacion.error);

  try {
    const resultado = await gastoService.editar(req.supabase, viajeId, gastoId, validacion.datos);

    if (resultado.error) {
      if (resultado.error.code === CHECK_VIOLATION) {
        return responderError(res, 400, 'datos_invalidos', 'Los datos del gasto no son válidos');
      }
      return responderError(res, 502, 'error_gasto', 'No se han podido guardar los cambios del gasto');
    }
    if (resultado.estado !== 'ok') {
      return responderMotivo(res, resultado.estado, 'No se han podido guardar los cambios del gasto');
    }
    return res.status(200).json(resultado.gasto);
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const eliminar = async (req, res) => {
  const { viajeId, gastoId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);
  if (!UUID_REGEX.test(gastoId)) {
    return responderError(res, 400, 'datos_invalidos', 'El identificador del gasto no es válido');
  }

  try {
    const resultado = await gastoService.eliminar(req.supabase, req.usuario.id, viajeId, gastoId);

    if (resultado.error) return responderError(res, 502, 'error_gasto', 'No se ha podido eliminar el gasto');
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se ha podido eliminar el gasto');
    return res.status(204).end();
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const crear = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);

  const validacion = validarNuevoGasto(req.body, viajeId);
  if (validacion.error) return responderError(res, 400, 'datos_invalidos', validacion.error);

  try {
    const resultado = await gastoService.crear(req.supabase, viajeId, validacion.datos);

    if (resultado.error) {
      if (resultado.error.code === CHECK_VIOLATION) {
        return responderError(res, 400, 'datos_invalidos', 'Los datos del gasto no son válidos');
      }
      return responderError(res, 502, 'error_gasto', 'No se ha podido registrar el gasto');
    }
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se ha podido registrar el gasto');
    return res.status(201).json(resultado.gasto);
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

// Marcar como saldada la transferencia que le deben a quien usa la app. El cuerpo indica el deudor y el importe
const marcarSaldada = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);

  const { de_usuario_id: deudorId, importe } = req.body ?? {};
  if (typeof deudorId !== 'string' || !UUID_REGEX.test(deudorId)) {
    return responderError(res, 400, 'datos_invalidos', 'Indica qué miembro del viaje tiene que pagar');
  }
  // Importe en euros con dos decimales como máximo, mayor que 0
  const enCentimos = typeof importe === 'number' && Number.isFinite(importe) ? importe * 100 : NaN;
  if (!(enCentimos > 0) || Math.abs(enCentimos - Math.round(enCentimos)) > 1e-6) {
    return responderError(res, 400, 'datos_invalidos', 'El importe debe ser un número mayor que 0 con dos decimales como máximo');
  }

  try {
    const resultado = await gastoService.marcarSaldada(req.supabase, req.usuario.id, viajeId, deudorId, importe);

    if (resultado.error) return responderError(res, 502, 'error_gasto', 'No se ha podido marcar la deuda como saldada');
    if (resultado.estado === 'no_coincide') {
      return responderError(res, 409, 'deuda_cambiada', 'La deuda ha cambiado: actualiza la liquidación antes de marcarla');
    }
    if (resultado.estado !== 'ok') {
      return responderMotivo(res, resultado.estado, 'No se ha podido marcar la deuda como saldada');
    }
    return res.status(204).end();
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

// Deshacer la marca de saldado de la deuda de un miembro (solo quien la marcó)
const desmarcarSaldada = async (req, res) => {
  const { viajeId, deudorId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);
  if (!UUID_REGEX.test(deudorId)) return responderError(res, 400, 'datos_invalidos', 'El miembro no es válido');

  try {
    const resultado = await gastoService.desmarcarSaldada(req.supabase, req.usuario.id, viajeId, deudorId);

    if (resultado.error) return responderError(res, 502, 'error_gasto', 'No se ha podido deshacer la marca');
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se ha podido deshacer la marca');
    return res.status(204).end();
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

// Lee la foto de un documento (campo «archivo», tras el middleware de subida), detecta si es un gasto, una
// actividad u otro documento, y devuelve sus datos para la pantalla de confirmación. Nada se guarda aquí:
// el usuario revisa y confirma después
const escanear = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);

  const archivo = req.file;
  if (!archivo?.buffer?.length) {
    return responderError(res, 400, 'datos_invalidos', 'Adjunta la foto del ticket en el campo «archivo»');
  }
  const tipoMime = detectarTipo(archivo.buffer);
  if (tipoMime !== 'image/jpeg' && tipoMime !== 'image/png') {
    return responderError(res, 400, 'tipo_no_permitido', 'Solo se pueden escanear fotos JPEG o PNG');
  }

  try {
    const previo = await viajeService.obtener(req.supabase, req.usuario.id, viajeId);
    if (previo.error) return responderError(res, 502, 'error_gasto', 'No se ha podido leer el viaje');
    if (!previo.viaje) return responderError(res, 404, 'viaje_no_encontrado', 'El viaje no existe o no perteneces a él');

    let texto;
    try {
      texto = await ocrService.reconocerTexto(archivo.buffer);
    } catch {
      return responderError(res, 502, 'error_ocr', 'No se ha podido leer el ticket');
    }
    const resultado = clasificarDocumento(texto);
    const fotoRuta = await guardarFotoSiHaceFalta(req.supabase, viajeId, archivo.buffer, tipoMime, resultado.tipo);
    return res.status(200).json({ ...resultado, foto_ruta: fotoRuta });
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

// La foto se guarda solo si el documento es un gasto o una actividad: un resumen de texto no necesita imagen.
// Si Supabase no la guarda, el escaneo sigue funcionando y el gasto o la actividad se crean sin foto
const guardarFotoSiHaceFalta = async (cliente, viajeId, buffer, tipoMime, tipo) => {
  if (tipo === 'otro') return null;
  try {
    const guardada = await fotoEscaneoService.guardar(cliente, viajeId, buffer, tipoMime);
    return guardada.error ? null : guardada.ruta;
  } catch {
    return null;
  }
};

// Enlace temporal para ver la foto del ticket de un gasto
const fotoUrl = async (req, res) => {
  const { viajeId, gastoId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);
  if (!UUID_REGEX.test(gastoId)) return responderError(res, 400, 'datos_invalidos', 'El identificador del gasto no es válido');

  try {
    const resultado = await gastoService.obtenerFoto(req.supabase, req.usuario.id, viajeId, gastoId);
    if (resultado.error) return responderError(res, 502, 'error_gasto', 'No se ha podido obtener la foto del gasto');
    if (resultado.estado === 'no_existe') return responderError(res, 404, 'viaje_no_encontrado', 'El viaje no existe o no perteneces a él');
    if (resultado.estado === 'no_encontrado') return responderError(res, 404, 'gasto_no_encontrado', 'El gasto no existe en este viaje');
    if (resultado.estado === 'sin_foto') return responderError(res, 404, 'sin_foto', 'Este gasto no tiene foto del ticket');
    return res.status(200).json({ url: resultado.url, expira_en: resultado.expira_en });
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

module.exports = {
  listar,
  balance,
  liquidacion,
  detalle,
  crear,
  editar,
  eliminar,
  marcarSaldada,
  desmarcarSaldada,
  escanear,
  fotoUrl,
};
