const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const puntoInteresService = require('../src/services/puntoInteresService');

const USUARIO = 'df77cba6-4be5-4cbc-814b-1e228dd73dcc';
const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const PUNTO_ID = '223e4567-e89b-12d3-a456-426614174000';

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
  nombre: 'Fontana di Trevi',
  nota: 'Ir temprano',
  categoria: 'cultura',
  latitud: 41.9009,
  longitud: 12.4833,
  lugar_externo_id: null,
  direccion: 'Fontana di Trevi, Piazza di Trevi, Roma',
};

const operacion = (consulta, metodo) => consulta.operaciones.find(([m]) => m === metodo);

describe('puntoInteresService.listar', () => {
  it('devuelve los puntos del viaje del más antiguo al más reciente', async () => {
    const puntos = [{ id: 'p1' }, { id: 'p2' }];
    const cliente = clienteFalso([
      { data: viaje(), error: null },
      { data: puntos, error: null },
    ]);

    const resultado = await puntoInteresService.listar(cliente, USUARIO, VIAJE_ID);

    assert.deepEqual(resultado, { estado: 'ok', puntos_interes: puntos });
    assert.equal(cliente.consultas[1].tabla, 'puntos_interes');
    assert.deepEqual(operacion(cliente.consultas[1], 'eq'), ['eq', 'viaje_id', VIAJE_ID]);
    assert.deepEqual(operacion(cliente.consultas[1], 'order'), ['order', 'creado_en', { ascending: true }]);
  });

  it('también funciona con el viaje finalizado', async () => {
    const cliente = clienteFalso([
      { data: viaje('finalizado'), error: null },
      { data: [], error: null },
    ]);

    const resultado = await puntoInteresService.listar(cliente, USUARIO, VIAJE_ID);

    assert.deepEqual(resultado, { estado: 'ok', puntos_interes: [] });
  });

  it('indica que el viaje no existe si el usuario no es miembro', async () => {
    const cliente = clienteFalso([{ data: viaje('activo', false), error: null }]);

    const resultado = await puntoInteresService.listar(cliente, USUARIO, VIAJE_ID);

    assert.equal(resultado.estado, 'no_existe');
  });

  it('devuelve el error si falla la consulta', async () => {
    const fallo = { code: 'X' };
    const cliente = clienteFalso([
      { data: viaje(), error: null },
      { data: null, error: fallo },
    ]);

    const resultado = await puntoInteresService.listar(cliente, USUARIO, VIAJE_ID);

    assert.equal(resultado.error, fallo);
  });
});

describe('puntoInteresService.crear', () => {
  it('inserta el punto a nombre del usuario y devuelve la fila creada', async () => {
    const creado = { id: PUNTO_ID, ...DATOS };
    const cliente = clienteFalso([
      { data: viaje(), error: null },
      { data: creado, error: null },
    ]);

    const resultado = await puntoInteresService.crear(cliente, USUARIO, VIAJE_ID, DATOS);

    assert.deepEqual(resultado, { estado: 'ok', punto: creado });
    assert.deepEqual(operacion(cliente.consultas[1], 'insert')[1], { viaje_id: VIAJE_ID, ...DATOS, creado_por: USUARIO });
  });

  it('no deja crear con el viaje finalizado', async () => {
    const cliente = clienteFalso([{ data: viaje('finalizado'), error: null }]);

    const resultado = await puntoInteresService.crear(cliente, USUARIO, VIAJE_ID, DATOS);

    assert.equal(resultado.estado, 'no_activo');
    assert.equal(cliente.consultas.length, 1);
  });


});

describe('puntoInteresService.eliminar', () => {
  it('borra el punto del viaje', async () => {
    const cliente = clienteFalso([
      { data: viaje(), error: null },
      { data: { id: PUNTO_ID }, error: null },
      { data: [{ id: PUNTO_ID }], error: null },
    ]);

    const resultado = await puntoInteresService.eliminar(cliente, USUARIO, VIAJE_ID, PUNTO_ID);

    assert.deepEqual(resultado, { estado: 'ok' });
    assert.ok(operacion(cliente.consultas[2], 'delete'));
    assert.deepEqual(operacion(cliente.consultas[2], 'eq'), ['eq', 'id', PUNTO_ID]);
  });





});
