const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  claveDeHora,
  ordenarDia,
  ordenarAgenda,
  valoresDeOrden,
  horasEnOrden,
  siguienteOrden,
} = require('../src/utils/ordenActividades');

const actividad = (id, datos = {}) => ({
  id,
  fecha: '2027-05-12',
  hora_inicio: null,
  orden: 0,
  creado_en: '2026-10-24T10:00:00Z',
  ...datos,
});

const ids = (lista) => lista.map((a) => a.id);

describe('claveDeHora', () => {
  it('recorta los segundos y usa cadena vacía si no hay hora', () => {
    assert.equal(claveDeHora({ hora_inicio: '10:30:00' }), '10:30');
    assert.equal(claveDeHora({ hora_inicio: '10:30' }), '10:30');
    assert.equal(claveDeHora({ hora_inicio: null }), '');
  });
});

describe('ordenarDia · actividades que nadie ha movido', () => {
  it('las que tienen hora van por hora y las que no tienen van al final por su posición', () => {
    const lista = [
      actividad('sinHoraB', { orden: 4 }),
      actividad('tarde', { hora_inicio: '16:00:00', orden: 1 }),
      actividad('sinHoraA', { orden: 3 }),
      actividad('mañana', { hora_inicio: '09:00:00', orden: 2 }),
    ];

    assert.deepEqual(ids(ordenarDia(lista)), ['mañana', 'tarde', 'sinHoraA', 'sinHoraB']);
  });

  it('una sin hora creada antes que otras con hora sigue yendo al final aunque tenga la posición más baja', () => {
    const lista = [actividad('paseo', { orden: 0 }), actividad('cena', { hora_inicio: '21:00:00', orden: 1 })];

    assert.deepEqual(ids(ordenarDia(lista)), ['cena', 'paseo']);
  });

  it('las de la misma hora se desempatan por posición, por fecha de creación y por identificador', () => {
    const lista = [
      actividad('c', { hora_inicio: '10:00:00', orden: 1 }),
      actividad('b', { hora_inicio: '10:00:00', orden: 0, creado_en: '2026-10-24T12:00:00Z' }),
      actividad('a', { hora_inicio: '10:00:00', orden: 0, creado_en: '2026-10-24T11:00:00Z' }),
    ];

    assert.deepEqual(ids(ordenarDia(lista)), ['a', 'b', 'c']);
  });

  it('tolera posiciones no numéricas', () => {
    assert.deepEqual(ids(ordenarDia([actividad('a', { orden: Number.NaN }), actividad('b', { orden: 1 })])), ['a', 'b']);
  });

});

describe('ordenarDia · actividades sin hora colocadas por el usuario', () => {
  const desayuno = actividad('desayuno', { hora_inicio: '08:30:00', orden: 0 });
  const comida = actividad('comida', { hora_inicio: '14:00:00', orden: 2 });
  const cena = actividad('cena', { hora_inicio: '21:00:00', orden: 4 });



  it('varias colocadas respetan sus posiciones', () => {
    const a = actividad('a', { orden: -2 });
    const b = actividad('b', { orden: -4 });

    assert.deepEqual(ids(ordenarDia([desayuno, comida, cena, b, a])), ['desayuno', 'a', 'comida', 'b', 'cena']);
  });

  it('dos colocadas en la misma posición no se pisan y mantienen el orden de creación', () => {
    const a = actividad('a', { orden: -2, creado_en: '2026-10-24T10:00:00Z' });
    const b = actividad('b', { orden: -2, creado_en: '2026-10-24T11:00:00Z' });

    assert.deepEqual(ids(ordenarDia([desayuno, comida, b, a])), ['desayuno', 'a', 'b', 'comida']);
  });


});

describe('ordenarAgenda', () => {
  it('ordena los días por fecha y cada día con su regla', () => {
    const lista = [
      actividad('martesSin', { fecha: '2027-05-13', orden: 0 }),
      actividad('lunesCena', { hora_inicio: '21:00:00', orden: 1 }),
      actividad('martesDesayuno', { fecha: '2027-05-13', hora_inicio: '08:00:00', orden: 1 }),
      actividad('lunesSin', { orden: 0 }),
    ];

    assert.deepEqual(ids(ordenarAgenda(lista)), ['lunesCena', 'lunesSin', 'martesDesayuno', 'martesSin']);
  });

});

describe('horasEnOrden', () => {
  it('acepta horas crecientes o repetidas y no tiene en cuenta las que no tienen hora', () => {
    assert.equal(
      horasEnOrden([
        actividad('a', { hora_inicio: '08:00:00' }),
        actividad('b'),
        actividad('c', { hora_inicio: '08:00:00' }),
        actividad('d', { hora_inicio: '09:00:00' }),
      ]),
      true,
    );
  });


});

describe('valoresDeOrden', () => {
  it('las de hora y las sin hora del final guardan su posición y las sin hora intercaladas, una posición negativa', () => {
    const lista = [
      actividad('desayuno', { hora_inicio: '08:30:00' }),
      actividad('paseo'),
      actividad('cena', { hora_inicio: '21:00:00' }),
      actividad('fotos'),
      actividad('compras'),
    ];

    assert.deepEqual(Object.fromEntries(valoresDeOrden(lista)), {
      desayuno: 0,
      paseo: -2,
      cena: 2,
      fotos: 3,
      compras: 4,
    });
  });


});

describe('siguienteOrden', () => {
  it('suma uno a la última posición', () => {
    assert.equal(siguienteOrden(4), 5);
    assert.equal(siguienteOrden(0), 1);
  });

});
