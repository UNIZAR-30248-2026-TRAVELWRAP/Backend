const express = require('express');
// mergeParams: el viajeId viene de la ruta en la que se monta (/api/viajes/:viajeId/votaciones)
const router = express.Router({ mergeParams: true });
const votacionController = require('../controllers/votacionController');
const { requiereSesion } = require('../middleware/authMiddleware');

router.get('/', requiereSesion, votacionController.listar);
router.post('/', requiereSesion, votacionController.crear);
router.get('/:votacionId', requiereSesion, votacionController.obtener);
router.post('/:votacionId/opciones', requiereSesion, votacionController.anadirOpcion);
router.put('/:votacionId/voto', requiereSesion, votacionController.votar);
router.delete('/:votacionId/voto', requiereSesion, votacionController.retirarVoto);
router.post('/:votacionId/cerrar', requiereSesion, votacionController.cerrar);

module.exports = router;
