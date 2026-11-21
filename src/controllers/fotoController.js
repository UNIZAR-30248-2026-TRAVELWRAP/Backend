const fotoService = require('../services/fotoService');
const { UUID_REGEX, CHECK_VIOLATION, responderError } = require('../utils/validacion');

const MAX_NOMBRE = 150;

const MAX_BYTES_FOTO = 8_000_000;

const FIRMAS = [
  { tipoMime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { tipoMime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

const esWebp = (buffer) =>
  buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';

const EBML = [0x1a, 0x45, 0xdf, 0xa3];

const esWebm = (buffer) =>
  buffer.length >= 12 && EBML.every((byte, i) => buffer[i] === byte) && buffer.subarray(0, 64).includes('webm');

const tipoDeVideoMp4 = (buffer) => {
  if (buffer.length < 12 || buffer.toString('ascii', 4, 8) !== 'ftyp') return null;
  return buffer.toString('ascii', 8, 12) === 'qt  ' ? 'video/quicktime' : 'video/mp4';
};

const detectarTipo = (buffer) => {
  const conocida = FIRMAS.find(
    ({ bytes }) => buffer.length >= bytes.length && bytes.every((byte, i) => buffer[i] === byte),
  );
  if (conocida) return conocida.tipoMime;
  if (esWebp(buffer)) return 'image/webp';
  if (esWebm(buffer)) return 'video/webm';
  return tipoDeVideoMp4(buffer);
};

const esVideo = (tipoMime) => tipoMime.startsWith('video/');

const nombreDeLaFoto = (nombreArchivo, tipoMime) => {
  const original = (nombreArchivo ?? '').trim().slice(0, MAX_NOMBRE).trim();
  if (original !== '') return original;
  return esVideo(tipoMime) ? 'Vídeo' : 'Foto';
};

const ERRORES = {
  no_existe: [404, 'viaje_no_encontrado', 'El viaje no existe o no perteneces a él'],
  no_activo: [409, 'viaje_no_activo', 'El viaje está finalizado y ya no se puede modificar'],
  foto_no_existe: [404, 'foto_no_encontrada', 'La foto no existe en este viaje'],
  almacenamiento_lleno: [413, 'almacenamiento_lleno', 'El viaje ha alcanzado su límite de almacenamiento'],
};

const responderMotivo = (res, estado, mensajeFallo) => {
  const [codigoHttp, codigo, mensaje] = ERRORES[estado] ?? [502, 'error_foto', mensajeFallo];
  return responderError(res, codigoHttp, codigo, mensaje);
};

const idViajeInvalido = (res) =>
  responderError(res, 400, 'datos_invalidos', 'El identificador del viaje no es válido');

const listar = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);

  try {
    const resultado = await fotoService.listar(req.supabase, req.usuario.id, viajeId);

    if (resultado.error) return responderError(res, 502, 'error_foto', 'No se han podido obtener las fotos');
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se han podido obtener las fotos');
    return res.status(200).json({ fotos: resultado.fotos, almacenamiento: resultado.almacenamiento });
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const subir = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);

  const archivo = req.file;
  if (!archivo?.buffer?.length) {
    return responderError(res, 400, 'datos_invalidos', 'Adjunta la foto o el vídeo en el campo «archivo»');
  }

  const tipoMime = detectarTipo(archivo.buffer);
  if (!tipoMime) {
    return responderError(
      res,
      400,
      'tipo_no_permitido',
      'Solo se pueden subir fotos (JPEG, PNG o WebP) o vídeos (MP4, WebM o MOV)',
    );
  }
  if (!esVideo(tipoMime) && archivo.buffer.length > MAX_BYTES_FOTO) {
    return responderError(res, 400, 'archivo_demasiado_grande', 'La foto no puede ocupar más de 8 MB');
  }

  try {
    const resultado = await fotoService.subir(req.supabase, req.usuario.id, viajeId, {
      nombre: nombreDeLaFoto(archivo.originalname, tipoMime),
      buffer: archivo.buffer,
      tipoMime,
    });

    if (resultado.error) {
      if (resultado.error.code === CHECK_VIOLATION) {
        return responderError(res, 400, 'datos_invalidos', 'Los datos del archivo no son válidos');
      }
      return responderError(res, 502, 'error_foto', 'No se ha podido subir el archivo');
    }
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se ha podido subir el archivo');
    return res.status(201).json(resultado.foto);
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const eliminar = async (req, res) => {
  const { viajeId, fotoId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);
  if (!UUID_REGEX.test(fotoId)) {
    return responderError(res, 400, 'datos_invalidos', 'El identificador de la foto no es válido');
  }

  try {
    const resultado = await fotoService.eliminar(req.supabase, req.usuario.id, viajeId, fotoId);

    if (resultado.error) return responderError(res, 502, 'error_foto', 'No se ha podido borrar el archivo');
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se ha podido borrar el archivo');
    return res.status(204).end();
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

module.exports = { listar, subir, eliminar, detectarTipo };
