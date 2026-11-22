const express = require('express');
const router = express.Router();
const notificacionController = require('../controllers/notificacionController');
const { requiereSesion } = require('../middleware/authMiddleware');

// Notificaciones push del usuario con sesión: la clave pública y sus suscripciones (una por dispositivo)
router.get('/clave-publica', requiereSesion, notificacionController.obtenerClave);
router.post('/suscripciones', requiereSesion, notificacionController.suscribir);
router.delete('/suscripciones', requiereSesion, notificacionController.darDeBaja);

module.exports = router;
