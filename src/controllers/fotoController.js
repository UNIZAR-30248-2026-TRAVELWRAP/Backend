const fotoService = require('../services/fotoService');
const { UUID_REGEX, CHECK_VIOLATION, responderError } = require('../utils/validacion');

const MAX_NOMBRE = 150;

const FIRMAS = [
  { tipoMime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { tipoMime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

const esWebp = (buffer) =>
  buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';

const detectarTipo = (buffer) => {
  const conocida = FIRMAS.find(
    ({ bytes }) => buffer.length >= bytes.length && bytes.every((byte, i) => buffer[i] === byte),
  );
  if (conocida) return conocida.tipoMime;
  return esWebp(buffer) ? 'image/webp' : null;
};

const nombreDeLaFoto = (nombreArchivo) => {
  const original = (nombreArchivo ?? '').trim().slice(0, MAX_NOMBRE).trim();
  return original === '' ? 'Foto' : original;
};

const ERRORES = {
  no_existe: [404, 'viaje_no_encontrado', 'El viaje no existe o no perteneces a él'],
  no_activo: [409, 'viaje_no_activo', 'El viaje está finalizado y ya no se puede modificar'],
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
    return res.status(200).json({ fotos: resultado.fotos });
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

const subir = async (req, res) => {
  const { viajeId } = req.params;
  if (!UUID_REGEX.test(viajeId)) return idViajeInvalido(res);

  const archivo = req.file;
  if (!archivo?.buffer?.length) {
    return responderError(res, 400, 'datos_invalidos', 'Adjunta la foto en el campo «archivo»');
  }

  const tipoMime = detectarTipo(archivo.buffer);
  if (!tipoMime) {
    return responderError(res, 400, 'tipo_no_permitido', 'Solo se pueden subir fotos JPEG, PNG o WebP');
  }

  try {
    const resultado = await fotoService.subir(req.supabase, req.usuario.id, viajeId, {
      nombre: nombreDeLaFoto(archivo.originalname),
      buffer: archivo.buffer,
      tipoMime,
    });

    if (resultado.error) {
      if (resultado.error.code === CHECK_VIOLATION) {
        return responderError(res, 400, 'datos_invalidos', 'Los datos de la foto no son válidos');
      }
      return responderError(res, 502, 'error_foto', 'No se ha podido subir la foto');
    }
    if (resultado.estado !== 'ok') return responderMotivo(res, resultado.estado, 'No se ha podido subir la foto');
    return res.status(201).json(resultado.foto);
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

module.exports = { listar, subir, detectarTipo };
