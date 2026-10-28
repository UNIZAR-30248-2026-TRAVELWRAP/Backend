// Pruebas del servicio de gastos: llamada a la función SQL crear_gasto y lectura del gasto creado.
// Supabase se sustituye por un cliente falso
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const gastoService = require('../src/services/gastoService');

// Identificadores de ejemplo
const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const GASTO_ID = '9f3c2a1b-7d6e-4f5a-8b9c-0d1e2f3a4b5c';
const ADRIANA = 'df77cba6-4be5-4cbc-814b-1e228dd73dcc';
const BERTA = '5b1f0c2e-8a7d-4c3b-9e6f-2d4a1b3c5e7f';

// Cliente de Supabase falso: rpc devuelve respuestaRpc y cada consulta encadenada (from().select().eq()...)
// devuelve la siguiente respuesta de la lista. Guarda las llamadas para poder comprobarlas
const clienteFalso = ({ respuestaRpc, respuestas = [] } = {}) => {
  const llamadasRpc = [];
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
  const rpc = async (funcion, parametros) => {
    llamadasRpc.push([funcion, parametros]);
    return respuestaRpc;
  };
  return { from, rpc, consultas, llamadasRpc };
};

// Supabase devuelve los importes como cadenas, así que el servicio los convierte a número
const FILA = {
  id: GASTO_ID,
  viaje_id: VIAJE_ID,
  concepto: 'Cena',
  importe: '10.00',
  categoria: 'comida',
  pagado_por: ADRIANA,
  fecha: '2027-05-12',
  creado_por: ADRIANA,
  creado_en: '2026-10-28T10:00:00Z',
  actualizado_en: '2026-10-28T10:00:00Z',
  repartos: [
    { usuario_id: ADRIANA, importe: '3.34' },
    { usuario_id: BERTA, importe: '3.33' },
  ],
};

// Datos ya validados por el controlador, tal como llegan al servicio
const DATOS = {
  concepto: 'Cena',
  importe: 10,
  categoria: 'comida',
  pagado_por: ADRIANA,
  fecha: '2027-05-12',
  participantes: [ADRIANA, BERTA],
};

// Operaciones de un tipo (eq, select...) que se han encadenado en una consulta
const operacion = (consulta, metodo) => consulta.operaciones.filter(([m]) => m === metodo);

// Lectura de un gasto con la parte de cada miembro
describe('gastoService.obtener', () => {
  it('busca el gasto dentro del viaje y convierte los importes a número', async () => {
    const cliente = clienteFalso({ respuestas: [{ data: FILA, error: null }] });

    const resultado = await gastoService.obtener(cliente, VIAJE_ID, GASTO_ID);

    assert.equal(resultado.estado, 'ok');
    assert.equal(resultado.gasto.importe, 10);
    assert.deepEqual(resultado.gasto.repartos, [
      { usuario_id: ADRIANA, importe: 3.34 },
      { usuario_id: BERTA, importe: 3.33 },
    ]);
    const [consulta] = cliente.consultas;
    assert.equal(consulta.tabla, 'gastos');
    assert.deepEqual(operacion(consulta, 'eq'), [['eq', 'id', GASTO_ID], ['eq', 'viaje_id', VIAJE_ID]]);
  });

  it('devuelve una lista de repartos vacía si el gasto no trae repartos', async () => {
    const cliente = clienteFalso({ respuestas: [{ data: { ...FILA, repartos: null }, error: null }] });

    const resultado = await gastoService.obtener(cliente, VIAJE_ID, GASTO_ID);

    assert.deepEqual(resultado.gasto.repartos, []);
  });

  it('devuelve no_encontrado si el gasto no está en el viaje', async () => {
    const cliente = clienteFalso({ respuestas: [{ data: null, error: null }] });

    assert.deepEqual(await gastoService.obtener(cliente, VIAJE_ID, GASTO_ID), { estado: 'no_encontrado' });
  });

  it('devuelve el error de la base de datos', async () => {
    const error = { code: 'PGRST301' };
    const cliente = clienteFalso({ respuestas: [{ data: null, error }] });

    assert.deepEqual(await gastoService.obtener(cliente, VIAJE_ID, GASTO_ID), { error });
  });
});

// Alta del gasto: primero la función crear_gasto y después la lectura del gasto creado
describe('gastoService.crear', () => {
  it('llama a crear_gasto con los datos y devuelve el gasto creado con su reparto', async () => {
    const cliente = clienteFalso({
      respuestaRpc: { data: { estado: 'ok', gasto_id: GASTO_ID }, error: null },
      respuestas: [{ data: FILA, error: null }],
    });

    const resultado = await gastoService.crear(cliente, VIAJE_ID, DATOS);

    assert.equal(resultado.estado, 'ok');
    assert.equal(resultado.gasto.id, GASTO_ID);
    assert.deepEqual(cliente.llamadasRpc, [[
      'crear_gasto',
      {
        p_viaje_id: VIAJE_ID,
        p_concepto: 'Cena',
        p_importe: 10,
        p_categoria: 'comida',
        p_pagado_por: ADRIANA,
        p_fecha: '2027-05-12',
        p_participantes: [ADRIANA, BERTA],
      },
    ]]);
    assert.deepEqual(operacion(cliente.consultas[0], 'eq')[0], ['eq', 'id', GASTO_ID]);
  });

  // Rechazos de la función: viaje inexistente, viaje cerrado o alguien que no es miembro
  for (const estado of ['no_existe', 'no_activo', 'no_miembro']) {
    it(`devuelve ${estado} sin buscar el gasto cuando la función lo rechaza`, async () => {
      const cliente = clienteFalso({ respuestaRpc: { data: { estado }, error: null } });

      assert.deepEqual(await gastoService.crear(cliente, VIAJE_ID, DATOS), { estado });
      assert.equal(cliente.consultas.length, 0);
    });
  }

  // Fallos de la base de datos
  it('devuelve el error de la función', async () => {
    const error = { code: '23514' };
    const cliente = clienteFalso({ respuestaRpc: { data: null, error } });

    assert.deepEqual(await gastoService.crear(cliente, VIAJE_ID, DATOS), { error });
  });

  it('trata una respuesta vacía de la función como un error', async () => {
    const cliente = clienteFalso({ respuestaRpc: { data: null, error: null } });

    assert.deepEqual(await gastoService.crear(cliente, VIAJE_ID, DATOS), { error: { code: 'respuesta_vacia' } });
  });

  it('trata como error que el gasto recién creado no se encuentre', async () => {
    const cliente = clienteFalso({
      respuestaRpc: { data: { estado: 'ok', gasto_id: GASTO_ID }, error: null },
      respuestas: [{ data: null, error: null }],
    });

    assert.deepEqual(await gastoService.crear(cliente, VIAJE_ID, DATOS), { error: { code: 'sin_filas' } });
  });

  it('devuelve el error si falla la lectura del gasto creado', async () => {
    const error = { code: 'PGRST301' };
    const cliente = clienteFalso({
      respuestaRpc: { data: { estado: 'ok', gasto_id: GASTO_ID }, error: null },
      respuestas: [{ data: null, error }],
    });

    assert.deepEqual(await gastoService.crear(cliente, VIAJE_ID, DATOS), { error });
  });
});
