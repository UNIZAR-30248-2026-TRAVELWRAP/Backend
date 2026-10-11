const express = require('express');
const router = express.Router();
const invitationController = require('../controllers/invitationController');
const { requiereSesion } = require('../middleware/authMiddleware');

router.get('/viajes/:viajeId/invitacion', requiereSesion, invitationController.obtenerEnlace);
router.post('/invitaciones/:token/unirse', requiereSesion, invitationController.unirse);

module.exports = router;
