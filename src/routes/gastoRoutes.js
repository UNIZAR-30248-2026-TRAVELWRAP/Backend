const express = require('express');
const router = express.Router({ mergeParams: true });
const gastoController = require('../controllers/gastoController');
const { requiereSesion } = require('../middleware/authMiddleware');

// Rutas para la gestión de gastos
router.get('/', requiereSesion, gastoController.listar);
router.get('/balance', requiereSesion, gastoController.balance);
router.post('/', requiereSesion, gastoController.crear);

module.exports = router;
