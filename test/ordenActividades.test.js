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

  it('no modifica la lista original', () => {
    const lista = [actividad('b', { orden: 2 }), actividad('a', { orden: 1 })];

    ordenarDia(lista);

    assert.deepEqual(ids(lista), ['b', 'a']);
  });
});

describe('ordenarDia · actividades sin hora colocadas por el usuario', () => {
  const desayuno = actividad('desayuno', { hora_inicio: '08:30:00', orden: 0 });
  const comida = actividad('comida', { hora_inicio: '14:00:00', orden: 2 });
  const cena = actividad('cena', { hora_inicio: '21:00:00', orden: 4 });

  it('una sin hora colocada entre dos con hora se queda entre ellas', () => {
    const paseo = actividad('paseo', { orden: -3 });

    assert.deepEqual(ids(ordenarDia([cena, paseo, desayuno, comida])), ['desayuno', 'comida', 'paseo', 'cena']);
  });

  it('se puede colocar la primera del día', () => {
    assert.deepEqual(ids(ordenarDia([desayuno, comida, actividad('paseo', { orden: -1 })])), ['paseo', 'desayuno', 'comida']);
  });

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

  it('una posición mayor que el día la deja detrás de las que tienen hora pero delante de las no colocadas', () => {
    const colocada = actividad('colocada', { orden: -50 });
    const alFinal = actividad('alFinal', { orden: 7 });

    assert.deepEqual(ids(ordenarDia([alFinal, colocada, desayuno, comida])), ['desayuno', 'comida', 'colocada', 'alFinal']);
  });

  it('las no colocadas siempre quedan al final aunque se añada después otra actividad con hora', () => {
    const paseo = actividad('paseo', { orden: 3 });
    const tardia = actividad('tardia', { hora_inicio: '23:00:00', orden: 4 });

    assert.deepEqual(ids(ordenarDia([desayuno, paseo, tardia])), ['desayuno', 'tardia', 'paseo']);
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

  it('con una lista vacía devuelve una lista vacía', () => {
    assert.deepEqual(ordenarAgenda([]), []);
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

  it('rechaza una hora anterior a la que ya había', () => {
    assert.equal(
      horasEnOrden([actividad('a', { hora_inicio: '09:00:00' }), actividad('b', { hora_inicio: '08:00:00' })]),
      false,
    );
  });

  it('acepta una lista vacía', () => {
    assert.equal(horasEnOrden([]), true);
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

  it('un día sin actividades con hora deja todas las posiciones normales', () => {
    assert.deepEqual(Object.fromEntries(valoresDeOrden([actividad('a'), actividad('b')])), { a: 0, b: 1 });
  });

  it('al aplicar esos valores el día se ordena igual que la lista de partida', () => {
    const listas = [
      [actividad('a'), actividad('b', { hora_inicio: '10:00:00' }), actividad('c'), actividad('d', { hora_inicio: '12:00:00' }), actividad('e')],
      [actividad('a'), actividad('b'), actividad('c', { hora_inicio: '10:00:00' })],
      [actividad('a', { hora_inicio: '10:00:00' }), actividad('b', { hora_inicio: '10:00:00' }), actividad('c')],
      [actividad('a'), actividad('b'), actividad('c')],
    ];

    for (const lista of listas) {
      const valores = valoresDeOrden(lista);
      const guardadas = lista.map((a) => ({ ...a, orden: valores.get(a.id) }));
      assert.deepEqual(ids(ordenarDia(guardadas)), ids(lista));
    }
  });
});

describe('siguienteOrden', () => {
  it('suma uno a la última posición', () => {
    assert.equal(siguienteOrden(4), 5);
    assert.equal(siguienteOrden(0), 1);
  });

  it('nunca devuelve una posición negativa, que se reserva a las colocadas por el usuario', () => {
    assert.equal(siguienteOrden(-1), 0);
    assert.equal(siguienteOrden(-7), 0);
  });
});
