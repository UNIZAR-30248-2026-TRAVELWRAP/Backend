const express = require('express');
const multer = require('multer');
const router = express.Router();
const viajeController = require('../controllers/viajeController');
const { requiereSesion } = require('../middleware/authMiddleware');
const { responderError } = require('../utils/validacion');

// Tamaño máximo de una portada: 5 MB (5.000.000 bytes), el mismo límite que tiene el bucket «portadas».
// El archivo se queda en memoria (req.file.buffer) solo mientras se sube a Supabase Storage
const MAX_BYTES_PORTADA = 5_000_000;

const subidaPortada = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES_PORTADA, files: 1 },
  defParamCharset: 'utf8',
});

// Recibe el archivo del campo «archivo» y traduce los errores de multer al formato de la API
const recibirPortada = (req, res, next) => {
  subidaPortada.single('archivo')(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      return responderError(res, 400, 'archivo_demasiado_grande', 'La portada no puede ocupar más de 5 MB');
    }
    if (error instanceof multer.MulterError) {
      return responderError(res, 400, 'datos_invalidos', 'Adjunta un único archivo en el campo «archivo»');
    }
    return responderError(res, 400, 'datos_invalidos', 'No se ha podido leer el archivo enviado');
  });
};

router.get('/', requiereSesion, viajeController.listar);
router.post('/', requiereSesion, viajeController.crear);
router.get('/:viajeId', requiereSesion, viajeController.obtener);
router.patch('/:viajeId', requiereSesion, viajeController.editar);
router.delete('/:viajeId', requiereSesion, viajeController.eliminar);
router.post('/:viajeId/finalizar', requiereSesion, viajeController.finalizar);
router.post('/:viajeId/archivar', requiereSesion, viajeController.archivar);
router.post('/:viajeId/desarchivar', requiereSesion, viajeController.desarchivar);
router.post('/:viajeId/abandonar', requiereSesion, viajeController.abandonar);
router.put('/:viajeId/portada', requiereSesion, recibirPortada, viajeController.subirPortada);
router.delete('/:viajeId/portada', requiereSesion, viajeController.quitarPortada);

module.exports = router;
module.exports.recibirPortada = recibirPortada;
