const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/registro', authController.registro);
router.post('/reenviar-confirmacion', authController.reenviarConfirmacion);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.get('/google', authController.googleInicio);
router.get('/google/callback', authController.googleCallback);

module.exports = router;
