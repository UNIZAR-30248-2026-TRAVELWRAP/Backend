const express = require('express');
const multer = require('multer');
const router = express.Router();
const perfilController = require('../controllers/perfilController');
const { requiereSesion } = require('../middleware/authMiddleware');
const { responderError } = require('../utils/validacion');

// Tamaño máximo de un avatar: 2 MB (2.000.000 bytes), el mismo límite que tiene el bucket
const MAX_BYTES = 2_000_000;

// La foto se queda en memoria (req.file.buffer) solo mientras se sube a Supabase Storage
const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
});

// Recibe la foto del campo «avatar» y traduce los errores de multer al formato de la API
const recibirAvatar = (req, res, next) => {
  subida.single('avatar')(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      return responderError(res, 400, 'archivo_demasiado_grande', 'La foto no puede ocupar más de 2 MB');
    }
    if (error instanceof multer.MulterError) {
      return responderError(res, 400, 'datos_invalidos', 'Adjunta una única foto en el campo «avatar»');
    }
    return responderError(res, 400, 'datos_invalidos', 'No se ha podido leer la foto enviada');
  });
};

// Perfil del usuario con sesión: las rutas no llevan id, así que solo se puede editar el propio
router.patch('/', requiereSesion, perfilController.actualizarNombre);
router.put('/avatar', requiereSesion, recibirAvatar, perfilController.cambiarAvatar);
router.delete('/avatar', requiereSesion, perfilController.quitarAvatar);

module.exports = router;
module.exports.recibirAvatar = recibirAvatar;
