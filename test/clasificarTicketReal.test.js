// Regresión: un ticket de bar con fecha y hora (el OCR no lee bien la línea del total) debe ser un gasto, no una actividad
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { clasificarDocumento } = require('../src/utils/ticketOcr');

// Texto que devuelve tesseract.js en la foto real de un ticket de bar (22/11/2026, factura simplificada)
const TICKET_BAR = [
  'E UDEON',
  'E CAFE ODEON SI',
  '- PLAZA SAN BRUNO 1 LOCAL',
  '—— 50001 - Zaragoza l |',
  '> ZARAGOZA e',
  'NIF: B50523307 A',
  '22/11/2026 14:24 barra —',
  'Factura Simplificada: 2996 En',
  'C. CONCEPTO PRECIO IMPORTE —',
  '4 VERMUTH 3,50 € 14,00 € |',
  '1 AGUA 1,50 € 1,50 €',
  '3 MINI 2,00 € 6,00 €',
  '3 JAMON BATIDO 20€ 6,0€',
  'Ts. Base imponible 22,73',
  'I.V.A. 21,00% 4,77',
  'E tel: 27 0 €',
  'Forma de pago: Tarjeta',
].join('\n');

describe('clasificarDocumento con un ticket real', () => {
  it('un ticket de bar con fecha y hora es un gasto', () => {
    assert.equal(clasificarDocumento(TICKET_BAR).tipo, 'gasto');
  });

  it('el concepto del ticket no es la cabecera fiscal', () => {
    assert.equal(clasificarDocumento(TICKET_BAR).datos.concepto, 'E UDEON');
  });

});

describe('clasificarDocumento con la lectura unida de dos variantes', () => {
  it('toma el total de la lectura en blanco y negro (27,50 €)', () => {
    const texto = [TICKET_BAR, 'O Total - 27,50 €'].join('\n');

    assert.equal(clasificarDocumento(texto).datos.importe, 27.5);
  });
});
