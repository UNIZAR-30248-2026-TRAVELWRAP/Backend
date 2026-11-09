const express = require('express');
const router = express.Router({ mergeParams: true });
const rutaController = require('../controllers/rutaController');
const { requiereSesion } = require('../middleware/authMiddleware');

router.get('/', requiereSesion, rutaController.calcular);

module.exports = router;
