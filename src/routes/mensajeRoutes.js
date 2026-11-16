const express = require('express');
const router = express.Router({ mergeParams: true });
const mensajeController = require('../controllers/mensajeController');
const { requiereSesion } = require('../middleware/authMiddleware');

// Rutas del chat del viaje
router.get('/', requiereSesion, mensajeController.listar);
router.post('/', requiereSesion, mensajeController.crear);

module.exports = router;
