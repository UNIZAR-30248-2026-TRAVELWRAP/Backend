const express = require('express');
const router = express.Router({ mergeParams: true });
const gastoController = require('../controllers/gastoController');
const { requiereSesion } = require('../middleware/authMiddleware');
// Mismo middleware de subida que los documentos: el archivo llega en el campo «archivo» y se limita a 8 MB
const { recibirArchivo } = require('./documentoRoutes');

// Rutas para la gestión de gastos
router.get('/', requiereSesion, gastoController.listar);
router.get('/balance', requiereSesion, gastoController.balance);
router.get('/liquidacion', requiereSesion, gastoController.liquidacion);
// Detalle de un gasto: va después de /balance y /liquidacion, o Express las tomaría por un gastoId
router.get('/:gastoId', requiereSesion, gastoController.detalle);
router.post('/', requiereSesion, gastoController.crear);
// Enlace temporal para ver la foto del ticket del gasto (va antes de /:gastoId para no confundirse con él)
router.get('/:gastoId/foto/url', requiereSesion, gastoController.fotoUrl);
// Foto de un ticket: devuelve el concepto y el importe reconocidos, sin guardar nada
router.post('/escaneo', requiereSesion, recibirArchivo, gastoController.escanear);
router.patch('/:gastoId', requiereSesion, gastoController.editar);
router.delete('/:gastoId', requiereSesion, gastoController.eliminar);
// Deudas saldadas: marcar la transferencia de un miembro y deshacerla (solo quien recibe el dinero)
router.post('/saldadas', requiereSesion, gastoController.marcarSaldada);
router.delete('/saldadas/:deudorId', requiereSesion, gastoController.desmarcarSaldada);

module.exports = router;
