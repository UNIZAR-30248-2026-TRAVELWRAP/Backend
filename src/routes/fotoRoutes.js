const express = require('express');
const multer = require('multer');
const router = express.Router({ mergeParams: true });
const fotoController = require('../controllers/fotoController');
const { requiereSesion } = require('../middleware/authMiddleware');
const { responderError } = require('../utils/validacion');

const MAX_BYTES = 50_000_000;
// Margen para las cabeceras y el sobre del formulario multipart, por encima del tamaño del archivo
const MARGEN_CABECERAS = 1_000_000;

const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  defParamCharset: 'utf8',
});

const recibirFoto = (req, res, next) => {
  // Se rechaza antes de leer el cuerpo: así el archivo nunca se carga en memoria si ya anuncia un tamaño mayor
  const tamanoAnunciado = Number(req.headers['content-length'] ?? 0);
  if (tamanoAnunciado > MAX_BYTES + MARGEN_CABECERAS) {
    return responderError(res, 400, 'archivo_demasiado_grande', 'El vídeo no puede ocupar más de 50 MB');
  }
  subida.single('archivo')(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      return responderError(res, 400, 'archivo_demasiado_grande', 'El vídeo no puede ocupar más de 50 MB');
    }
    if (error instanceof multer.MulterError) {
      return responderError(res, 400, 'datos_invalidos', 'Adjunta un único archivo en el campo «archivo»');
    }
    return responderError(res, 400, 'datos_invalidos', 'No se ha podido leer el archivo enviado');
  });
};

router.get('/', requiereSesion, fotoController.listar);
router.post('/', requiereSesion, recibirFoto, fotoController.subir);
router.delete('/:fotoId', requiereSesion, fotoController.eliminar);

module.exports = router;
module.exports.recibirFoto = recibirFoto;
