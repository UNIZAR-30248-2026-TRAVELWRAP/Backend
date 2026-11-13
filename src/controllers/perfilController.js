const perfilService = require('../services/perfilService');
const { detectarTipo } = require('./documentoController');
const { CHECK_VIOLATION, responderError } = require('../utils/validacion');

const MAX_NOMBRE = 100;
const TIPOS_AVATAR = ['image/jpeg', 'image/png'];

const errorInterno = (res) => responderError(res, 500, 'error_interno', 'Error interno del servidor');

const perfilNoEncontrado = (res) => responderError(res, 404, 'perfil_no_encontrado', 'El perfil no existe');

const actualizarNombre = async (req, res) => {
  const { nombre } = req.body ?? {};
  const limpio = typeof nombre === 'string' ? nombre.trim() : '';
  if (limpio.length < 1 || limpio.length > MAX_NOMBRE) {
    return responderError(res, 400, 'datos_invalidos', `El nombre debe tener entre 1 y ${MAX_NOMBRE} caracteres`);
  }

  try {
    const resultado = await perfilService.actualizarNombre(req.supabase, req.usuario.id, limpio);

    if (resultado.error) {
      if (resultado.error.code === CHECK_VIOLATION) {
        return responderError(res, 400, 'datos_invalidos', `El nombre debe tener entre 1 y ${MAX_NOMBRE} caracteres`);
      }
      return errorInterno(res);
    }
    if (resultado.estado !== 'ok') return perfilNoEncontrado(res);
    return res.status(200).json({ usuario: resultado.usuario });
  } catch {
    return errorInterno(res);
  }
};

// Llega tras el middleware de subida (perfilRoutes), que deja el archivo en req.file
const cambiarAvatar = async (req, res) => {
  const archivo = req.file;
  if (!archivo?.buffer?.length) {
    return responderError(res, 400, 'datos_invalidos', 'Adjunta la foto en el campo «avatar»');
  }

  // El tipo que manda el cliente se puede falsear: se comprueba también la firma del archivo
  const tipoMime = detectarTipo(archivo.buffer);
  if (!TIPOS_AVATAR.includes(archivo.mimetype) || !TIPOS_AVATAR.includes(tipoMime)) {
    return responderError(res, 400, 'tipo_no_permitido', 'La foto debe ser una imagen JPEG o PNG');
  }

  try {
    const resultado = await perfilService.cambiarAvatar(req.supabase, req.usuario.id, {
      buffer: archivo.buffer,
      tipoMime,
    });

    if (resultado.error) return responderError(res, 502, 'error_storage', 'No se ha podido guardar la foto');
    if (resultado.estado !== 'ok') return perfilNoEncontrado(res);
    return res.status(200).json({ usuario: resultado.usuario });
  } catch {
    return errorInterno(res);
  }
};

const quitarAvatar = async (req, res) => {
  try {
    const resultado = await perfilService.quitarAvatar(req.supabase, req.usuario.id);

    if (resultado.error) return responderError(res, 502, 'error_storage', 'No se ha podido quitar la foto');
    if (resultado.estado !== 'ok') return perfilNoEncontrado(res);
    return res.status(200).json({ usuario: resultado.usuario });
  } catch {
    return errorInterno(res);
  }
};

module.exports = { actualizarNombre, cambiarAvatar, quitarAvatar };
