const express = require('express');
const router = express.Router({ mergeParams: true });
const puntoInteresController = require('../controllers/puntoInteresController');
const { requiereSesion } = require('../middleware/authMiddleware');

router.get('/', requiereSesion, puntoInteresController.listar);
router.post('/', requiereSesion, puntoInteresController.crear);
router.delete('/:puntoId', requiereSesion, puntoInteresController.eliminar);

module.exports = router;
