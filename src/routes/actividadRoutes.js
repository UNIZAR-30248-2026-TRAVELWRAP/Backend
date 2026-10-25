const express = require('express');
const router = express.Router({ mergeParams: true });
const actividadController = require('../controllers/actividadController');
const { requiereSesion } = require('../middleware/authMiddleware');

router.get('/', requiereSesion, actividadController.listar);
router.post('/', requiereSesion, actividadController.crear);
router.patch('/:actividadId', requiereSesion, actividadController.editar);
router.delete('/:actividadId', requiereSesion, actividadController.eliminar);

module.exports = router;
