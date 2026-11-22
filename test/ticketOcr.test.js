// Pruebas del analizador del texto de un ticket (extraerDatosTicket): concepto e importe
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { extraerDatosTicket } = require('../src/utils/ticketOcr');

describe('extraerDatosTicket', () => {
  it('toma el concepto de la primera línea de texto y el importe de la línea de total', () => {
    const texto = ['RESTAURANTE EL FARO', 'Mesa 4', 'Pizza margarita 9,50', 'Agua 2,00', 'TOTAL 11,50 €'].join('\n');

    assert.deepEqual(extraerDatosTicket(texto), { concepto: 'RESTAURANTE EL FARO', importe: 11.5 });
  });

  it('se salta cabeceras, impuestos y datos fiscales al buscar el concepto', () => {
    const texto = ['Factura simplificada', 'CIF B12345678', 'Tapas y raciones', 'TOTAL 24,00'].join('\n');

    assert.equal(extraerDatosTicket(texto).concepto, 'Tapas y raciones');
  });

  it('lee importes con separador de miles y coma decimal', () => {
    assert.equal(extraerDatosTicket('Hotel Centro\nTOTAL 1.234,56').importe, 1234.56);
  });

  it('acepta el punto como separador decimal', () => {
    assert.equal(extraerDatosTicket('Gasolina\nTOTAL 45.80').importe, 45.8);
  });

  it('no toma el subtotal como importe final', () => {
    const texto = ['Cafés', 'SUBTOTAL 8,00', 'IVA 0,72', 'TOTAL 8,72'].join('\n');

    assert.equal(extraerDatosTicket(texto).importe, 8.72);
  });

  it('usa el mayor importe cuando no hay ninguna línea de total', () => {
    assert.equal(extraerDatosTicket('Taxi\n4,20 €\n12,30 €\n1,00 €').importe, 12.3);
  });

  it('devuelve null en ambos campos si el texto no tiene ni concepto ni importe', () => {
    assert.deepEqual(extraerDatosTicket('12 34\n--- ---'), { concepto: null, importe: null });
  });

  it('trata el texto vacío o ausente como un ticket sin datos', () => {
    assert.deepEqual(extraerDatosTicket(''), { concepto: null, importe: null });
    assert.deepEqual(extraerDatosTicket(undefined), { concepto: null, importe: null });
  });

  it('recorta el concepto a 100 caracteres', () => {
    const largo = 'a'.repeat(150);

    assert.equal(extraerDatosTicket(largo).concepto.length, 100);
  });
});
