const express = require('express');
const router = express.Router();
const viajeController = require('../controllers/viajeController');
const { requiereSesion } = require('../middleware/authMiddleware');

router.get('/', requiereSesion, viajeController.listar);
router.post('/', requiereSesion, viajeController.crear);
router.get('/:viajeId', requiereSesion, viajeController.obtener);
router.patch('/:viajeId', requiereSesion, viajeController.editar);
router.delete('/:viajeId', requiereSesion, viajeController.eliminar);
router.post('/:viajeId/archivar', requiereSesion, viajeController.archivar);

module.exports = router;
