const documentoService = require('../services/documentoService');
const { UUID_REGEX, CHECK_VIOLATION, responderError, textoOpcional } = require('../utils/validacion');

const MAX_NOMBRE = 150;

// Tipos admitidos, reconocidos por los primeros bytes del archivo (su «firma»): el tipo y la extensión
// que manda el navegador los puede poner cualquiera, así que no bastan para saber qué es el archivo
const FIRMAS = [
  { tipoMime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { tipoMime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { tipoMime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

// Tipo real del archivo según su contenido, o null si no es un PDF, JPEG o PNG
const detectarTipo = (buffer) =>
  FIRMAS.find(({ bytes }) => buffer.length >= bytes.length && bytes.every((byte, i) => buffer[i] === byte))
    ?.tipoMime ?? null;

// Nombre visible del documento: el que se indica en el formulario o, si no hay, el del archivo original.
// Devuelve { valor } | { error }
const validarNombre = (nombre, nombreArchivo) => {
  const indicado = textoOpcional(nombre);
  if (indicado === undefined || indicado?.length > MAX_NOMBRE) {
    return { error: `El nombre debe ser un texto de ${MAX_NOMBRE} caracteres como máximo` };
  }
  if (indicado !== null) return { valor: indicado };

  // Sin nombre indicado se usa el del archivo, recortado si es demasiado largo
  const original = (nombreArchivo ?? '').trim().slice(0, MAX_NOMBRE).trim();
  return { valor: original === '' ? 'Documento' : original };
};

// Motivos de fallo que pueden devolver los servicios de documentos
const ERRORES = {
  no_existe: [404, 'viaje_no_encontrado', 'El viaje no existe o no perteneces a él'],
  documento_no_existe: [404, 'documento_no_encontrado', 'El documento no existe en este viaje'],
  no_activo: [409, 'viaje_no_activo', 'El viaje está finalizado y ya no se puede modificar'],
};

const responderMotivo = (res, estado, mensajeFallo) => {
  const [codigoHttp, codigo, mensaje] = ERRORES[estado] ?? [502, 'error_documento', mensajeFallo];
  return responderError(res, codigoHttp, codigo, mensaje);
};

const idViajeInvalido = (res) =>
  responderError(res, 400, 'datos_invalidos', 'El identificador del viaje no es válido');

const listar = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);

  try {
    const resultado = await documentoService.listar(req.supabase, req.usuario.id, viajeId);

    if (resultado.error) return responderError(res, 502, 'error_documento', 'No se han podido obtener los documentos');
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se han podido obtener los documentos');
    return res.status(200).json({ documentos: resultado.documentos });
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

// Llega tras el middleware de subida (documentoRoutes), que deja el archivo en req.file
const subir = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);

  const archivo = req.file;
  if (!archivo?.buffer?.length) {
    return responderError(res, 400, 'datos_invalidos', 'Adjunta el archivo del documento en el campo «archivo»');
  }

  const tipoMime = detectarTipo(archivo.buffer);
  if (!tipoMime) {
    return responderError(res, 400, 'tipo_no_permitido', 'Solo se pueden subir documentos PDF o imágenes JPEG o PNG');
  }

  const nombre = validarNombre(req.body?.nombre, archivo.originalname);
  if (nombre.error) return responderError(res, 400, 'datos_invalidos', nombre.error);

  try {
    const resultado = await documentoService.subir(req.supabase, req.usuario.id, viajeId, {
      nombre: nombre.valor,
      buffer: archivo.buffer,
      tipoMime,
    });

    if (resultado.error) {
      if (resultado.error.code === CHECK_VIOLATION) {
        return responderError(res, 400, 'datos_invalidos', 'Los datos del documento no son válidos');
      }
      return responderError(res, 502, 'error_documento', 'No se ha podido subir el documento');
    }
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se ha podido subir el documento');
    return res.status(201).json(resultado.documento);
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

// Enlace temporal para abrir el documento o, con ?descargar=true, para descargarlo con su nombre
const obtenerUrl = async (req, res) => {
  const { viajeId, documentoId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);
  if (!UUID_REGEX.test(documentoId)) {
    return responderError(res, 400, 'datos_invalidos', 'El identificador del documento no es válido');
  }

  const { descargar } = req.query;
  if (descargar !== undefined && descargar !== 'true' && descargar !== 'false') {
    return responderError(res, 400, 'datos_invalidos', 'El parámetro descargar debe ser true o false');
  }

  try {
    const resultado = await documentoService.obtenerUrl(req.supabase, req.usuario.id, viajeId, documentoId, {
      descargar: descargar === 'true',
    });

    if (resultado.error) return responderError(res, 502, 'error_documento', 'No se ha podido obtener el enlace del documento');
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se ha podido obtener el enlace del documento');
    const { url, expira_en, nombre, tipo_mime } = resultado;
    return res.status(200).json({ url, expira_en, nombre, tipo_mime });
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

module.exports = { listar, subir, obtenerUrl, detectarTipo };
