const express = require('express');
const router = express.Router({ mergeParams: true });
const selloController = require('../controllers/selloController');
const { requiereSesion } = require('../middleware/authMiddleware');

// Sello que el usuario con sesión ha elegido para este viaje: no lleva id de usuario, así que solo toca el suyo
router.get('/', requiereSesion, selloController.obtener);
router.put('/', requiereSesion, selloController.elegir);
router.delete('/', requiereSesion, selloController.quitar);

module.exports = router;
