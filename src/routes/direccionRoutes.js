const express = require('express');
const router = express.Router();
const direccionController = require('../controllers/direccionController');
const { requiereSesion } = require('../middleware/authMiddleware');

router.get('/', requiereSesion, direccionController.buscar);

module.exports = router;
