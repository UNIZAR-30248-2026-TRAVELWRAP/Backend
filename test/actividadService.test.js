const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const actividadService = require('../src/services/actividadService');

const USUARIO = 'df77cba6-4be5-4cbc-814b-1e228dd73dcc';
const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';

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

const DATOS = {
  titulo: 'Coliseo',
  fecha: '2027-05-12',
  hora_inicio: '10:00',
  hora_fin: '12:00',
  ubicacion_nombre: 'Piazza del Colosseo',
  categoria: 'cultura',
  latitud: 41.8902,
  longitud: 12.4922,
  lugar_externo_id: 'way/1',
};
const operacion = (consulta, metodo) => consulta.operaciones.find(([m]) => m === metodo);

describe('actividadService.crear', () => {
  it('inserta la actividad al final del día y devuelve la fila creada', async () => {
    const creada = { id: 'a1', ...DATOS, orden: 3 };
    const cliente = clienteFalso([
      { data: viaje(), error: null },
      { data: { orden: 2 }, error: null },
      { data: creada, error: null },
    ]);

    const resultado = await actividadService.crear(cliente, USUARIO, VIAJE_ID, DATOS);

    assert.deepEqual(resultado, { estado: 'ok', actividad: creada });
    const insercion = operacion(cliente.consultas[2], 'insert')[1];
    assert.deepEqual(insercion, {
      viaje_id: VIAJE_ID,
      titulo: 'Coliseo',
      fecha: '2027-05-12',
      hora_inicio: '10:00',
      hora_fin: '12:00',
      ubicacion_nombre: 'Piazza del Colosseo',
      categoria: 'cultura',
      latitud: 41.8902,
      longitud: 12.4922,
      lugar_externo_id: 'way/1',
      orden: 3,
      creado_por: USUARIO,
    });
  });

  it('empieza en orden 0 si el día no tiene actividades', async () => {
    const cliente = clienteFalso([
      { data: viaje(), error: null },
      { data: null, error: null },
      { data: { id: 'a1' }, error: null },
    ]);

    await actividadService.crear(cliente, USUARIO, VIAJE_ID, DATOS);

    assert.equal(operacion(cliente.consultas[2], 'insert')[1].orden, 0);
  });

  it('devuelve no_existe si el viaje no existe o el usuario no es miembro', async () => {
    const sinViaje = clienteFalso([{ data: null, error: null }]);
    const ajeno = clienteFalso([{ data: viaje('activo', false), error: null }]);

    assert.deepEqual(await actividadService.crear(sinViaje, USUARIO, VIAJE_ID, DATOS), { estado: 'no_existe' });
    assert.deepEqual(await actividadService.crear(ajeno, USUARIO, VIAJE_ID, DATOS), { estado: 'no_existe' });
  });

  it('devuelve no_activo sin insertar si el viaje está archivado', async () => {
    const cliente = clienteFalso([{ data: viaje('archivado'), error: null }]);

    const resultado = await actividadService.crear(cliente, USUARIO, VIAJE_ID, DATOS);

    assert.deepEqual(resultado, { estado: 'no_activo' });
    assert.equal(cliente.consultas.length, 1);
  });

  it('devuelve el error si falla la consulta del viaje, la del orden o la inserción', async () => {
    const error = { code: 'XX000' };
    const enViaje = clienteFalso([{ data: null, error }]);
    const enOrden = clienteFalso([{ data: viaje(), error: null }, { data: null, error }]);
    const enInsercion = clienteFalso([
      { data: viaje(), error: null },
      { data: null, error: null },
      { data: null, error },
    ]);

    assert.deepEqual(await actividadService.crear(enViaje, USUARIO, VIAJE_ID, DATOS), { error });
    assert.deepEqual(await actividadService.crear(enOrden, USUARIO, VIAJE_ID, DATOS), { error });
    assert.deepEqual(await actividadService.crear(enInsercion, USUARIO, VIAJE_ID, DATOS), { error });
  });
});

describe('actividadService.listar', () => {
  it('devuelve las actividades del viaje ordenadas por día, hora (las sin hora al final) y orden', async () => {
    const filas = [{ id: 'a1' }, { id: 'a2' }];
    const cliente = clienteFalso([
      { data: viaje(), error: null },
      { data: filas, error: null },
    ]);

    const resultado = await actividadService.listar(cliente, USUARIO, VIAJE_ID);

    assert.deepEqual(resultado, { estado: 'ok', actividades: filas });
    const consulta = cliente.consultas[1];
    assert.equal(consulta.tabla, 'actividades');
    assert.deepEqual(operacion(consulta, 'eq'), ['eq', 'viaje_id', VIAJE_ID]);
    assert.deepEqual(
      consulta.operaciones.filter(([m]) => m === 'order'),
      [
        ['order', 'fecha', { ascending: true }],
        ['order', 'hora_inicio', { ascending: true, nullsFirst: false }],
        ['order', 'orden', { ascending: true }],
        ['order', 'creado_en', { ascending: true }],
      ],
    );
  });

  it('filtra por la fecha cuando se pide un solo día', async () => {
    const cliente = clienteFalso([
      { data: viaje(), error: null },
      { data: [], error: null },
    ]);

    await actividadService.listar(cliente, USUARIO, VIAJE_ID, '2027-05-12');

    const filtros = cliente.consultas[1].operaciones.filter(([m]) => m === 'eq');
    assert.deepEqual(filtros, [
      ['eq', 'viaje_id', VIAJE_ID],
      ['eq', 'fecha', '2027-05-12'],
    ]);
  });

  it('devuelve una lista vacía si el viaje no tiene actividades', async () => {
    const cliente = clienteFalso([
      { data: viaje(), error: null },
      { data: null, error: null },
    ]);

    assert.deepEqual(await actividadService.listar(cliente, USUARIO, VIAJE_ID), { estado: 'ok', actividades: [] });
  });

  it('también lista las de un viaje archivado (solo lectura)', async () => {
    const cliente = clienteFalso([
      { data: viaje('archivado'), error: null },
      { data: [{ id: 'a1' }], error: null },
    ]);

    const resultado = await actividadService.listar(cliente, USUARIO, VIAJE_ID);

    assert.equal(resultado.estado, 'ok');
    assert.equal(resultado.actividades.length, 1);
  });

  it('devuelve no_existe si el viaje no existe o el usuario no es miembro', async () => {
    const sinViaje = clienteFalso([{ data: null, error: null }]);
    const ajeno = clienteFalso([{ data: viaje('activo', false), error: null }]);

    assert.deepEqual(await actividadService.listar(sinViaje, USUARIO, VIAJE_ID), { estado: 'no_existe' });
    assert.deepEqual(await actividadService.listar(ajeno, USUARIO, VIAJE_ID), { estado: 'no_existe' });
  });

  it('devuelve el error si falla la consulta del viaje o la de las actividades', async () => {
    const error = { code: 'XX000' };
    const enViaje = clienteFalso([{ data: null, error }]);
    const enActividades = clienteFalso([{ data: viaje(), error: null }, { data: null, error }]);

    assert.deepEqual(await actividadService.listar(enViaje, USUARIO, VIAJE_ID), { error });
    assert.deepEqual(await actividadService.listar(enActividades, USUARIO, VIAJE_ID), { error });
  });
});
