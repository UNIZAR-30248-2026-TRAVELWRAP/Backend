const express = require('express');
const router = express.Router({ mergeParams: true });
const actividadController = require('../controllers/actividadController');
const { requiereSesion } = require('../middleware/authMiddleware');

router.post('/', requiereSesion, actividadController.crear);

module.exports = router;
