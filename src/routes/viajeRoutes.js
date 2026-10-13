const express = require('express');
const router = express.Router();
const viajeController = require('../controllers/viajeController');
const { requiereSesion } = require('../middleware/authMiddleware');

router.get('/', requiereSesion, viajeController.listar);
router.post('/', requiereSesion, viajeController.crear);
router.get('/:viajeId', requiereSesion, viajeController.obtener);

module.exports = router;
