const express = require('express');
const multer = require('multer');
const router = express.Router({ mergeParams: true });
const documentoController = require('../controllers/documentoController');
const { requiereSesion } = require('../middleware/authMiddleware');
const { responderError } = require('../utils/validacion');

// Tamaño máximo de un documento: 8 MB (8.000.000 bytes), el mismo límite que tienen la tabla y el bucket.
// Es el máximo que SonarCloud considera seguro para una subida (regla S5693): limita la memoria que ocupa cada petición
const MAX_BYTES = 8_000_000;

// El archivo se queda en memoria (req.file.buffer) solo mientras se sube a Supabase Storage.
// Los nombres de archivo llegan en UTF-8, para no estropear tildes y eñes
const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  defParamCharset: 'utf8',
});

// Recibe el archivo del campo «archivo» y traduce los errores de multer al formato de la API
const recibirArchivo = (req, res, next) => {
  subida.single('archivo')(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      return responderError(res, 400, 'archivo_demasiado_grande', 'El documento no puede ocupar más de 8 MB');
    }
    if (error instanceof multer.MulterError) {
      return responderError(res, 400, 'datos_invalidos', 'Adjunta un único archivo en el campo «archivo»');
    }
    return responderError(res, 400, 'datos_invalidos', 'No se ha podido leer el archivo enviado');
  });
};

// Rutas de la cartera de documentos del viaje
router.get('/', requiereSesion, documentoController.listar);
router.post('/', requiereSesion, recibirArchivo, documentoController.subir);

module.exports = router;
module.exports.recibirArchivo = recibirArchivo;
