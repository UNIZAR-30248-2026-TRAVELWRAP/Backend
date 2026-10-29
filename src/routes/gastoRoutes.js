const express = require('express');
const router = express.Router({ mergeParams: true });
const gastoController = require('../controllers/gastoController');
const { requiereSesion } = require('../middleware/authMiddleware');

router.get('/', requiereSesion, gastoController.listar);
router.post('/', requiereSesion, gastoController.crear);

module.exports = router;
