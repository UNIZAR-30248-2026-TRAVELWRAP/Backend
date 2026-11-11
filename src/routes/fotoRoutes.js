const express = require('express');
const multer = require('multer');
const router = express.Router({ mergeParams: true });
const fotoController = require('../controllers/fotoController');
const { requiereSesion } = require('../middleware/authMiddleware');
const { responderError } = require('../utils/validacion');

const MAX_BYTES = 8_000_000;

const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  defParamCharset: 'utf8',
});

const recibirFoto = (req, res, next) => {
  subida.single('archivo')(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      return responderError(res, 400, 'archivo_demasiado_grande', 'La foto no puede ocupar más de 8 MB');
    }
    if (error instanceof multer.MulterError) {
      return responderError(res, 400, 'datos_invalidos', 'Adjunta una única foto en el campo «archivo»');
    }
    return responderError(res, 400, 'datos_invalidos', 'No se ha podido leer el archivo enviado');
  });
};

router.get('/', requiereSesion, fotoController.listar);
router.post('/', requiereSesion, recibirFoto, fotoController.subir);

module.exports = router;
module.exports.recibirFoto = recibirFoto;
