const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { contarDias, resumirGastos, actividadMasVotada } = require('../src/utils/resumenViaje');

describe('contarDias', () => {
  it('cuenta los días del viaje contando el primero y el último', () => {
    assert.equal(contarDias('2027-05-12', '2027-05-15'), 4);
    assert.equal(contarDias('2027-05-12', '2027-05-12'), 1);
    assert.equal(contarDias('2027-02-27', '2027-03-02'), 4);
    assert.equal(contarDias('2027-12-30', '2028-01-02'), 4);
  });

  it('sin las dos fechas cuenta los días distintos con actividades', () => {
    assert.equal(contarDias(null, null, ['2027-07-01', '2027-07-01', '2027-07-03']), 2);
    assert.equal(contarDias('2027-05-12', null, ['2027-05-12']), 1);
    assert.equal(contarDias(null, null, []), 0);
  });

  it('un rango invertido no da días negativos', () => {
    assert.equal(contarDias('2027-05-15', '2027-05-01'), 0);
  });
});

describe('resumirGastos', () => {
  it('suma en céntimos y devuelve el gasto más alto', () => {
    const resultado = resumirGastos([
      { concepto: 'Cena', importe: '120.50' },
      { concepto: 'Entradas', importe: 45.1 },
      { concepto: 'Taxi', importe: '12.40' },
    ]);
    assert.deepEqual(resultado, { gasto_total: 178, gasto_mayor: { concepto: 'Cena', importe: 120.5 } });
  });

  it('no arrastra errores de coma flotante', () => {
    assert.equal(resumirGastos([{ concepto: 'a', importe: 0.1 }, { concepto: 'b', importe: 0.2 }]).gasto_total, 0.3);
  });

  it('con un empate se queda con el primero', () => {
    const { gasto_mayor: mayor } = resumirGastos([
      { concepto: 'Primero', importe: 10 },
      { concepto: 'Segundo', importe: 10 },
    ]);
    assert.equal(mayor.concepto, 'Primero');
  });

  it('sin gastos el total es 0 y no hay gasto mayor', () => {
    assert.deepEqual(resumirGastos([]), { gasto_total: 0, gasto_mayor: null });
  });
});

describe('actividadMasVotada', () => {
  const opciones = [
    { id: 'a', texto: 'Vaticano', orden: 0 },
    { id: 'b', texto: 'Coliseo', orden: 1 },
    { id: 'c', texto: 'Trevi', orden: 2 },
  ];

  it('devuelve la opción con más votos', () => {
    const votos = [{ opcion_id: 'b' }, { opcion_id: 'a' }, { opcion_id: 'b' }];
    assert.deepEqual(actividadMasVotada(opciones, votos), { titulo: 'Coliseo', votos: 2 });
  });

  it('con un empate gana la que va antes en la lista', () => {
    const votos = [{ opcion_id: 'b' }, { opcion_id: 'a' }];
    assert.deepEqual(actividadMasVotada(opciones, votos), { titulo: 'Vaticano', votos: 1 });
  });

  it('sin votos o sin opciones devuelve null', () => {
    assert.equal(actividadMasVotada(opciones, []), null);
    assert.equal(actividadMasVotada([], [{ opcion_id: 'x' }]), null);
  });
});
