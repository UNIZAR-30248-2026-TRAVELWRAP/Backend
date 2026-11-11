const express = require('express');
const router = express.Router({ mergeParams: true });
const resumenController = require('../controllers/resumenController');
const { requiereSesion } = require('../middleware/authMiddleware');

router.get('/', requiereSesion, resumenController.obtener);

module.exports = router;
