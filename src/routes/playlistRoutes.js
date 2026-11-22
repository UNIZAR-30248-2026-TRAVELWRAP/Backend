const express = require('express');
const router = express.Router({ mergeParams: true });
const playlistController = require('../controllers/playlistController');
const { requiereSesion } = require('../middleware/authMiddleware');

// Playlist compartida del viaje (PB-56): ver el enlace, enlazarlo o cambiarlo, y quitarlo
router.get('/', requiereSesion, playlistController.obtener);
router.put('/', requiereSesion, playlistController.guardar);
router.delete('/', requiereSesion, playlistController.quitar);

module.exports = router;
