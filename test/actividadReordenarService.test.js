const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const actividadService = require('../src/services/actividadService');

const USUARIO = 'df77cba6-4be5-4cbc-814b-1e228dd73dcc';
const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const FECHA = '2027-05-12';

const clienteFalso = (respuestas) => {
  const consultas = [];
  const from = (tabla) => {
    const consulta = { tabla, operaciones: [] };
    consultas.push(consulta);
    const encadenable = new Proxy(
      {},
      {
        get: (_, metodo) => {
          if (metodo === 'then') {
            const respuesta = respuestas.shift();
            return (resolver, rechazar) => Promise.resolve(respuesta).then(resolver, rechazar);
          }
          return (...args) => {
            consulta.operaciones.push([metodo, ...args]);
            return encadenable;
          };
        },
      },
    );
    return encadenable;
  };
  return { from, consultas };
};

const viaje = (estado = 'activo', miembro = true) => ({
  id: VIAJE_ID,
  nombre: 'Roma 2027',
  destino: 'Roma',
  descripcion: null,
  fecha_inicio: '2027-05-12',
  fecha_fin: '2027-05-15',
  moneda: 'EUR',
  presupuesto: 850,
  estado,
  creado_en: '2026-10-12T10:00:00Z',
  miembros_viaje: miembro
    ? [{ usuario_id: USUARIO, rol: 'miembro', abandonado_en: null, perfiles: { nombre: 'Adriana', avatar_url: null } }]
    : [],
});

const fila = (id, datos = {}) => ({
  id,
  viaje_id: VIAJE_ID,
  titulo: id,
  fecha: FECHA,
  hora_inicio: null,
  hora_fin: null,
  orden: 0,
  creado_en: '2026-10-24T10:00:00Z',
  ...datos,
});

const operacion = (consulta, metodo) => consulta.operaciones.find(([m]) => m === metodo);
const actualizada = (id) => ({ data: [{ id }], error: null });

describe('actividadService.reordenar', () => {
  it('guarda la nueva posición de las actividades que cambian y devuelve el día en su nuevo orden', async () => {
    const filas = [
      fila('desayuno', { hora_inicio: '08:30:00', orden: 0 }),
      fila('paseo', { orden: 1 }),
      fila('compras', { orden: 2 }),
    ];
    const cliente = clienteFalso([
      { data: viaje(), error: null },
      { data: filas, error: null },
      actualizada('compras'),
      actualizada('paseo'),
    ]);

    const resultado = await actividadService.reordenar(cliente, USUARIO, VIAJE_ID, FECHA, ['desayuno', 'compras', 'paseo']);

    assert.equal(resultado.estado, 'ok');
    assert.deepEqual(resultado.actividades.map((a) => [a.id, a.orden]), [['desayuno', 0], ['compras', 1], ['paseo', 2]]);
    const actualizaciones = cliente.consultas.slice(2);
    assert.equal(actualizaciones.length, 2);
    assert.deepEqual(actualizaciones.map((c) => operacion(c, 'update')[1].orden).sort(), [1, 2]);
    assert.deepEqual(actualizaciones.map((c) => c.tabla), ['actividades', 'actividades']);
    assert.deepEqual(operacion(actualizaciones[0], 'eq'), ['eq', 'id', 'compras']);
  });

  it('pide solo las actividades de ese viaje y de ese día', async () => {
    const cliente = clienteFalso([{ data: viaje(), error: null }, { data: [fila('a')], error: null }]);

    await actividadService.reordenar(cliente, USUARIO, VIAJE_ID, FECHA, ['a']);

    const consulta = cliente.consultas[1];
    assert.equal(consulta.tabla, 'actividades');
    assert.deepEqual(consulta.operaciones.filter(([m]) => m === 'eq'), [
      ['eq', 'viaje_id', VIAJE_ID],
      ['eq', 'fecha', FECHA],
    ]);
  });

  it('no actualiza nada si el orden ya es el guardado', async () => {
    const filas = [fila('a', { orden: 0 }), fila('b', { orden: 1 })];
    const cliente = clienteFalso([{ data: viaje(), error: null }, { data: filas, error: null }]);

    const resultado = await actividadService.reordenar(cliente, USUARIO, VIAJE_ID, FECHA, ['a', 'b']);

    assert.equal(resultado.estado, 'ok');
    assert.equal(cliente.consultas.length, 2);
  });

  it('una sin hora colocada entre las que tienen hora se guarda con una posición negativa', async () => {
    const filas = [
      fila('desayuno', { hora_inicio: '08:30:00', orden: 0 }),
      fila('comida', { hora_inicio: '14:00:00', orden: 1 }),
      fila('paseo', { orden: 2 }),
    ];
    const cliente = clienteFalso([
      { data: viaje(), error: null },
      { data: filas, error: null },
      actualizada('paseo'),
      actualizada('comida'),
    ]);

    const resultado = await actividadService.reordenar(cliente, USUARIO, VIAJE_ID, FECHA, ['desayuno', 'paseo', 'comida']);

    const porId = Object.fromEntries(resultado.actividades.map((a) => [a.id, a.orden]));
    assert.deepEqual(porId, { desayuno: 0, paseo: -2, comida: 2 });
  });

  it('devuelve agenda_cambiada si falta, sobra o es distinta alguna actividad del día', async () => {
    const filas = [fila('a'), fila('b')];
    for (const ids of [['a'], ['a', 'b', 'c'], ['a', 'x']]) {
      const cliente = clienteFalso([{ data: viaje(), error: null }, { data: filas, error: null }]);

      const resultado = await actividadService.reordenar(cliente, USUARIO, VIAJE_ID, FECHA, ids);

      assert.deepEqual(resultado, { estado: 'agenda_cambiada' });
      assert.equal(cliente.consultas.length, 2);
    }
  });

  it('devuelve orden_no_valido, sin guardar nada, si las actividades con hora no quedan por hora', async () => {
    const filas = [fila('manana', { hora_inicio: '09:00:00', orden: 0 }), fila('tarde', { hora_inicio: '16:00:00', orden: 1 })];
    const cliente = clienteFalso([{ data: viaje(), error: null }, { data: filas, error: null }]);

    const resultado = await actividadService.reordenar(cliente, USUARIO, VIAJE_ID, FECHA, ['tarde', 'manana']);

    assert.deepEqual(resultado, { estado: 'orden_no_valido' });
    assert.equal(cliente.consultas.length, 2);
  });

  it('permite reordenar las que empiezan a la misma hora', async () => {
    const filas = [
      fila('a', { hora_inicio: '10:00:00', orden: 0 }),
      fila('b', { hora_inicio: '10:00:00', orden: 1 }),
    ];
    const cliente = clienteFalso([
      { data: viaje(), error: null },
      { data: filas, error: null },
      actualizada('b'),
      actualizada('a'),
    ]);

    const resultado = await actividadService.reordenar(cliente, USUARIO, VIAJE_ID, FECHA, ['b', 'a']);

    assert.equal(resultado.estado, 'ok');
    assert.deepEqual(resultado.actividades.map((a) => a.id), ['b', 'a']);
  });

  it('devuelve no_existe si el viaje no existe o el usuario no es miembro, y no_activo si está finalizado', async () => {
    const sinViaje = clienteFalso([{ data: null, error: null }]);
    const noMiembro = clienteFalso([{ data: viaje('activo', false), error: null }]);
    const finalizado = clienteFalso([{ data: viaje('archivado'), error: null }]);

    assert.deepEqual(await actividadService.reordenar(sinViaje, USUARIO, VIAJE_ID, FECHA, ['a']), { estado: 'no_existe' });
    assert.deepEqual(await actividadService.reordenar(noMiembro, USUARIO, VIAJE_ID, FECHA, ['a']), { estado: 'no_existe' });
    assert.deepEqual(await actividadService.reordenar(finalizado, USUARIO, VIAJE_ID, FECHA, ['a']), { estado: 'no_activo' });
    assert.equal(finalizado.consultas.length, 1);
  });

  it('devuelve el error si falla la consulta del viaje, la de las actividades o alguna actualización', async () => {
    const falloViaje = clienteFalso([{ data: null, error: { code: 'XX' } }]);
    const falloLectura = clienteFalso([{ data: viaje(), error: null }, { data: null, error: { code: 'YY' } }]);
    const falloEscritura = clienteFalso([
      { data: viaje(), error: null },
      { data: [fila('a', { orden: 0 }), fila('b', { orden: 1 })], error: null },
      { data: null, error: { code: 'ZZ' } },
      actualizada('a'),
    ]);

    assert.deepEqual(await actividadService.reordenar(falloViaje, USUARIO, VIAJE_ID, FECHA, ['a']), { error: { code: 'XX' } });
    assert.deepEqual(await actividadService.reordenar(falloLectura, USUARIO, VIAJE_ID, FECHA, ['a']), { error: { code: 'YY' } });
    assert.deepEqual(await actividadService.reordenar(falloEscritura, USUARIO, VIAJE_ID, FECHA, ['b', 'a']), {
      error: { code: 'ZZ' },
    });
  });

  it('devuelve error si alguna actualización no encuentra la fila', async () => {
    const cliente = clienteFalso([
      { data: viaje(), error: null },
      { data: [fila('a', { orden: 0 }), fila('b', { orden: 1 })], error: null },
      { data: [], error: null },
      actualizada('a'),
    ]);

    const resultado = await actividadService.reordenar(cliente, USUARIO, VIAJE_ID, FECHA, ['b', 'a']);

    assert.deepEqual(resultado, { error: { code: 'sin_filas' } });
  });
});

describe('actividadService.listar con actividades colocadas', () => {
  it('mezcla las colocadas por el usuario entre las que tienen hora', async () => {
    const filas = [
      fila('paseo', { orden: -2 }),
      fila('comida', { hora_inicio: '14:00:00', orden: 2 }),
      fila('desayuno', { hora_inicio: '08:30:00', orden: 0 }),
      fila('fotos', { orden: 3 }),
    ];
    const cliente = clienteFalso([{ data: viaje(), error: null }, { data: filas, error: null }]);

    const resultado = await actividadService.listar(cliente, USUARIO, VIAJE_ID);

    assert.deepEqual(resultado.actividades.map((a) => a.id), ['desayuno', 'paseo', 'comida', 'fotos']);
  });
});

describe('actividadService.crear con actividades colocadas', () => {
  it('la actividad nueva va al final del día aunque la última posición sea negativa', async () => {
    const cliente = clienteFalso([
      { data: viaje(), error: null },
      { data: { orden: -3 }, error: null },
      { data: fila('nueva', { orden: 0 }), error: null },
    ]);

    await actividadService.crear(cliente, USUARIO, VIAJE_ID, {
      titulo: 'Nueva',
      fecha: FECHA,
      hora_inicio: null,
      hora_fin: null,
      ubicacion_nombre: null,
      categoria: null,
      latitud: null,
      longitud: null,
      lugar_externo_id: null,
    });

    assert.equal(operacion(cliente.consultas[2], 'insert')[1].orden, 0);
  });
});
