// Pruebas de la detección automática del tipo de documento (clasificarDocumento):
// gasto, actividad u otro, y los datos que necesita cada pantalla de confirmación
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { clasificarDocumento } = require('../src/utils/ticketOcr');

describe('clasificarDocumento', () => {
  it('reconoce un ticket de compra como gasto', () => {
    const texto = ['RESTAURANTE EL FARO', 'Pizza margarita 9,50', 'IVA 10% 1,05', 'TOTAL 11,50 €'].join('\n');

    assert.deepEqual(clasificarDocumento(texto), {
      tipo: 'gasto',
      datos: { concepto: 'RESTAURANTE EL FARO', importe: 11.5 },
    });
  });

  it('reconoce un billete de vuelo como actividad, con fecha y hora', () => {
    const texto = ['Vuelo Madrid a Roma IB3456', 'Embarque 12 May 2027 08:20'].join('\n');

    assert.deepEqual(clasificarDocumento(texto), {
      tipo: 'actividad',
      datos: { titulo: 'Vuelo Madrid a Roma IB3456', fecha: '2027-05-12', hora_inicio: '08:20', ubicacion_nombre: null, categoria: 'transporte' },
    });
  });

  it('reconoce una entrada con fecha y hora como actividad aunque lleve precio', () => {
    const texto = ['Entradas Coliseo', '2 adultos', '13/05/2027 10:00', 'Total 24,00 €'].join('\n');

    const resultado = clasificarDocumento(texto);

    assert.equal(resultado.tipo, 'actividad');
    assert.equal(resultado.datos.fecha, '2027-05-13');
    assert.equal(resultado.datos.hora_inicio, '10:00');
  });

  it('deja la fecha en null si el documento no trae el año', () => {
    const texto = ['Visita guiada', '13 de mayo a las 10:00'].join('\n');

    assert.equal(clasificarDocumento(texto).datos.fecha, null);
  });


  it('no inventa una fecha que no existe', () => {
    const texto = ['Reserva hotel', '31/02/2027 14:00'].join('\n');

    assert.equal(clasificarDocumento(texto).datos.fecha, null);
  });




  it('devuelve otro con resumen vacío si el OCR no ha leído nada', () => {
    assert.deepEqual(clasificarDocumento(''), { tipo: 'otro', datos: { resumen: '' } });
    assert.deepEqual(clasificarDocumento(undefined), { tipo: 'otro', datos: { resumen: '' } });
  });
});
