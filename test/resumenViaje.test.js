const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { contarDias, actividadMasVotada, almaDelGrupo, presupuestoRestante } = require('../src/utils/resumenViaje');

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

describe('presupuestoRestante', () => {
  it('resta lo gastado del presupuesto del viaje', () => {
    const gastos = [{ importe: '120.50' }, { importe: 12.4 }];
    assert.deepEqual(presupuestoRestante('500', gastos), { total: 500, gastado: 132.9, restante: 367.1 });
  });

  it('sin gastos el restante es el presupuesto entero', () => {
    assert.deepEqual(presupuestoRestante(300, []), { total: 300, gastado: 0, restante: 300 });
  });

  it('suma en céntimos: 0,1 + 0,2 da 0,3 exacto', () => {
    assert.deepEqual(presupuestoRestante(0.3, [{ importe: 0.1 }, { importe: 0.2 }]), { total: 0.3, gastado: 0.3, restante: 0 });
  });

  it('si el viaje supera el presupuesto el restante es negativo', () => {
    assert.deepEqual(presupuestoRestante(100, [{ importe: 130 }]), { total: 100, gastado: 130, restante: -30 });
  });
});
