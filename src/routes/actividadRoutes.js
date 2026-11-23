const express = require('express');
const router = express.Router({ mergeParams: true });
const actividadController = require('../controllers/actividadController');
const { requiereSesion } = require('../middleware/authMiddleware');

router.get('/', requiereSesion, actividadController.listar);
router.post('/', requiereSesion, actividadController.crear);
// Enlace temporal para ver la foto del documento escaneado de la actividad
router.get('/:actividadId/foto/url', requiereSesion, actividadController.fotoUrl);
router.put('/orden', requiereSesion, actividadController.reordenar);
router.patch('/:actividadId', requiereSesion, actividadController.editar);
router.delete('/:actividadId', requiereSesion, actividadController.eliminar);

module.exports = router;
