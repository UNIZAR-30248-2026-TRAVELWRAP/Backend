// Regresión: el correo de confirmación de una visita guiada (captura real) debe salir como actividad con su
// título completo, su lugar, su fecha, su hora y su categoría. El OCR parte el título en dos líneas.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { clasificarDocumento } = require('../src/utils/ticketOcr');

const RESERVA_VISITA = [
  'civitatis',
  '¡Muchas gracias!',
  'Tu reserva está confirmada',
  'Descarga la App y viaja sin preocupaciones',
  'Tu PDF sin conexión, todos tus viajes organizados y soporte 24/7',
  'Gestiona tu reserva desde la App',
  'Reserva: A40333938',
  '== in Free tour de los fantasmas de',
  '” __ os - y - .',
  'MT 4 ET Edimburgo',
  'E Miércoles, 29 de julio de 2026',
  '(5 18:00 (6:00 pm)',
  '0 3 personas',
  'O 190 High Street. Cómo llegar',
  '¡Muchas gracias!',
  '| Reserva: A40333938',
  'o rt Free tour de los fantasmas de',
  'E Eibade) - Edimburgo',
  '3 Miércoles, 29 de julio de 2026',
  '(5) 18:00 (6:00 pm)',
  '0 3 personas',
  'O) 190 High Street. Cómo llegar',
].join('\n');

describe('clasificarDocumento con un correo de reserva real', () => {
  const resultado = clasificarDocumento(RESERVA_VISITA);

  it('es una actividad', () => {
    assert.equal(resultado.tipo, 'actividad');
  });

  it('toma el título completo, aunque el OCR lo parta en dos líneas', () => {
    assert.equal(resultado.datos.titulo, 'Free tour de los fantasmas de Edimburgo');
  });

  it('toma la dirección sin «Cómo llegar»', () => {
    assert.equal(resultado.datos.ubicacion_nombre, '190 High Street');
  });


});
