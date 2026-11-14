const express = require('express');
const router = express.Router({ mergeParams: true });
const tareaController = require('../controllers/tareaController');
const { requiereSesion } = require('../middleware/authMiddleware');

// Rutas de la lista de tareas del viaje
router.get('/', requiereSesion, tareaController.listar);
router.post('/', requiereSesion, tareaController.crear);
router.patch('/:tareaId', requiereSesion, tareaController.editar);
router.delete('/:tareaId', requiereSesion, tareaController.borrar);

module.exports = router;
