// Pruebas del servicio de gastos: llamada a la función SQL crear_gasto y lectura del gasto creado.
// Supabase se sustituye por un cliente falso
const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const gastoService = require('../src/services/gastoService');
const viajeService = require('../src/services/viajeService');

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

  // Rechazos de la función: viaje inexistente, viaje finalizado o alguien que no es miembro
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

// Historial: primero se comprueba el viaje y después se leen sus gastos
describe('gastoService.listar', () => {
  afterEach(() => mock.restoreAll());

  const conViaje = (viaje = { id: VIAJE_ID }) => mock.method(viajeService, 'obtener', async () => ({ viaje }));

  it('lista los gastos del viaje del más reciente al más antiguo, con los importes como número', async () => {
    const obtenerViaje = conViaje();
    const cliente = clienteFalso({
      respuestas: [{ data: [{ ...FILA, id: 'g2', fecha: '2027-05-13' }, FILA], error: null }],
    });

    const resultado = await gastoService.listar(cliente, ADRIANA, VIAJE_ID);

    assert.equal(resultado.estado, 'ok');
    assert.deepEqual(resultado.gastos.map((g) => g.id), ['g2', GASTO_ID]);
    assert.equal(resultado.gastos[1].importe, 10);
    assert.deepEqual(resultado.gastos[1].repartos[0], { usuario_id: ADRIANA, importe: 3.34 });
    assert.deepEqual(obtenerViaje.mock.calls[0].arguments.slice(1), [ADRIANA, VIAJE_ID]);
    const [consulta] = cliente.consultas;
    assert.equal(consulta.tabla, 'gastos');
    assert.deepEqual(operacion(consulta, 'eq'), [['eq', 'viaje_id', VIAJE_ID]]);
    assert.deepEqual(operacion(consulta, 'order'), [
      ['order', 'fecha', { ascending: false }],
      ['order', 'creado_en', { ascending: false }],
    ]);
  });

  it('suma el total en céntimos, sin errores de coma flotante', async () => {
    conViaje();
    const cliente = clienteFalso({
      respuestas: [{ data: [{ ...FILA, importe: '0.10' }, { ...FILA, importe: '0.20' }], error: null }],
    });

    const resultado = await gastoService.listar(cliente, ADRIANA, VIAJE_ID);

    assert.equal(resultado.total, 0.3);
  });

  it('devuelve una lista vacía y total 0 si el viaje no tiene gastos', async () => {
    conViaje();
    const cliente = clienteFalso({ respuestas: [{ data: [], error: null }] });

    assert.deepEqual(await gastoService.listar(cliente, ADRIANA, VIAJE_ID), { estado: 'ok', gastos: [], total: 0 });
  });

  it('trata una respuesta sin filas como una lista vacía', async () => {
    conViaje();
    const cliente = clienteFalso({ respuestas: [{ data: null, error: null }] });

    assert.deepEqual(await gastoService.listar(cliente, ADRIANA, VIAJE_ID), { estado: 'ok', gastos: [], total: 0 });
  });

  it('devuelve no_existe sin leer los gastos si el viaje no existe o no se es miembro', async () => {
    conViaje(null);
    const cliente = clienteFalso();

    assert.deepEqual(await gastoService.listar(cliente, ADRIANA, VIAJE_ID), { estado: 'no_existe' });
    assert.equal(cliente.consultas.length, 0);
  });

  it('devuelve el error si falla la comprobación del viaje', async () => {
    const error = { code: 'PGRST301' };
    mock.method(viajeService, 'obtener', async () => ({ error }));
    const cliente = clienteFalso();

    assert.deepEqual(await gastoService.listar(cliente, ADRIANA, VIAJE_ID), { error });
    assert.equal(cliente.consultas.length, 0);
  });

  it('devuelve el error si falla la lectura de los gastos', async () => {
    conViaje();
    const error = { code: 'PGRST301' };
    const cliente = clienteFalso({ respuestas: [{ data: null, error }] });

    assert.deepEqual(await gastoService.listar(cliente, ADRIANA, VIAJE_ID), { error });
  });
});

// Balance: saldo de cada miembro a partir de los gastos y sus repartos. El viaje (con sus miembros) es simulado
describe('gastoService.balance', () => {
  afterEach(() => mock.restoreAll());

  const DANIEL = '8c4d2e1f-3a5b-4c6d-9e7f-1a2b3c4d5e6f';
  const MIEMBROS = [
    { usuario_id: ADRIANA, nombre: 'Adriana' },
    { usuario_id: BERTA, nombre: 'Berta' },
    { usuario_id: DANIEL, nombre: 'Daniel' },
  ];
  const conMiembros = (miembros = MIEMBROS) =>
    mock.method(viajeService, 'obtener', async () => ({ viaje: { id: VIAJE_ID, miembros } }));

  // Así llegan las filas de Supabase: los numeric como texto
  const gastoDe = (pagadoPor, importe, repartos) => ({
    importe,
    pagado_por: pagadoPor,
    repartos: repartos.map(([usuarioId, parte]) => ({ usuario_id: usuarioId, importe: parte })),
  });

  const sumaDeSaldos = (saldos) => saldos.reduce((total, s) => total + Math.round(s.saldo * 100), 0);

  it('calcula lo pagado, la parte y el saldo de cada miembro, y los saldos suman 0', async () => {
    conMiembros();
    const cliente = clienteFalso({
      respuestas: [{
        data: [
          gastoDe(ADRIANA, '10.00', [[ADRIANA, '3.34'], [BERTA, '3.33'], [DANIEL, '3.33']]),
          gastoDe(BERTA, '6.00', [[ADRIANA, '3.00'], [BERTA, '3.00']]),
        ],
        error: null,
      }],
    });

    const resultado = await gastoService.balance(cliente, ADRIANA, VIAJE_ID);

    assert.deepEqual(resultado, {
      estado: 'ok',
      saldos: [
        { usuario_id: ADRIANA, nombre: 'Adriana', pagado: 10, parte: 6.34, saldo: 3.66 },
        { usuario_id: BERTA, nombre: 'Berta', pagado: 6, parte: 6.33, saldo: -0.33 },
        { usuario_id: DANIEL, nombre: 'Daniel', pagado: 0, parte: 3.33, saldo: -3.33 },
      ],
    });
    assert.equal(sumaDeSaldos(resultado.saldos), 0);
  });

  it('lee solo los gastos del viaje, con su importe, quién pagó y los repartos', async () => {
    conMiembros();
    const cliente = clienteFalso({ respuestas: [{ data: [], error: null }] });

    await gastoService.balance(cliente, ADRIANA, VIAJE_ID);

    const [consulta] = cliente.consultas;
    assert.equal(consulta.tabla, 'gastos');
    assert.deepEqual(operacion(consulta, 'select'), [
      ['select', 'importe, pagado_por, repartos:repartos_gasto (usuario_id, importe)'],
    ]);
    assert.deepEqual(operacion(consulta, 'eq'), [['eq', 'viaje_id', VIAJE_ID]]);
  });

  it('sin gastos todos los miembros tienen saldo 0', async () => {
    conMiembros();
    const cliente = clienteFalso({ respuestas: [{ data: null, error: null }] });

    const { saldos } = await gastoService.balance(cliente, ADRIANA, VIAJE_ID);

    assert.deepEqual(saldos.map((s) => [s.nombre, s.pagado, s.parte, s.saldo]), [
      ['Adriana', 0, 0, 0],
      ['Berta', 0, 0, 0],
      ['Daniel', 0, 0, 0],
    ]);
  });

  it('suma en céntimos, sin errores de coma flotante', async () => {
    conMiembros();
    const gastos = Array.from({ length: 10 }, () => gastoDe(ADRIANA, '0.10', [[BERTA, '0.10']]));
    const cliente = clienteFalso({ respuestas: [{ data: gastos, error: null }] });

    const { saldos } = await gastoService.balance(cliente, ADRIANA, VIAJE_ID);

    assert.equal(saldos[0].pagado, 1);
    assert.equal(saldos[0].saldo, 1);
    assert.equal(saldos[1].saldo, -1);
  });

  it('incluye, al final y sin nombre, a quien abandonó el viaje con gastos', async () => {
    conMiembros(MIEMBROS.slice(0, 2));
    const cliente = clienteFalso({
      respuestas: [{
        data: [
          gastoDe(DANIEL, '20.00', [[ADRIANA, '10.00'], [DANIEL, '10.00']]),
          gastoDe(ADRIANA, '4.00', [[BERTA, '4.00']]),
        ],
        error: null,
      }],
    });

    const { saldos } = await gastoService.balance(cliente, ADRIANA, VIAJE_ID);

    assert.deepEqual(saldos.map((s) => [s.usuario_id, s.nombre, s.saldo]), [
      [ADRIANA, 'Adriana', -6],
      [BERTA, 'Berta', -4],
      [DANIEL, null, 10],
    ]);
    assert.equal(sumaDeSaldos(saldos), 0);
  });

  it('trata un gasto sin repartos como pagado y sin partes', async () => {
    conMiembros();
    const cliente = clienteFalso({
      respuestas: [{ data: [{ importe: '5.00', pagado_por: BERTA, repartos: null }], error: null }],
    });

    const { saldos } = await gastoService.balance(cliente, ADRIANA, VIAJE_ID);

    assert.equal(saldos[1].pagado, 5);
    assert.equal(saldos[1].parte, 0);
  });

  it('devuelve no_existe sin leer los gastos si el viaje no existe o no se es miembro', async () => {
    mock.method(viajeService, 'obtener', async () => ({ viaje: null }));
    const cliente = clienteFalso();

    assert.deepEqual(await gastoService.balance(cliente, ADRIANA, VIAJE_ID), { estado: 'no_existe' });
    assert.equal(cliente.consultas.length, 0);
  });

  it('devuelve el error si falla la comprobación del viaje', async () => {
    const error = { code: 'PGRST301' };
    mock.method(viajeService, 'obtener', async () => ({ error }));
    const cliente = clienteFalso();

    assert.deepEqual(await gastoService.balance(cliente, ADRIANA, VIAJE_ID), { error });
  });

  it('devuelve el error si falla la lectura de los gastos', async () => {
    conMiembros();
    const error = { code: 'PGRST301' };
    const cliente = clienteFalso({ respuestas: [{ data: null, error }] });

    assert.deepEqual(await gastoService.balance(cliente, ADRIANA, VIAJE_ID), { error });
  });
});

// Liquidación: plan de transferencias para saldar el viaje. Primero se prueba el cálculo con saldos sueltos y
// después la función completa, que parte del balance del viaje (con el cliente falso)
describe('gastoService.planDeTransferencias', () => {
  const ELENA = 'e1a2b3c4-d5e6-4f70-8192-a3b4c5d6e7f8';
  const DANIEL = '8c4d2e1f-3a5b-4c6d-9e7f-1a2b3c4d5e6f';
  // Miembro que ya ha abandonado el viaje: aparece sin nombre
  const ANTIGUO_ID = 'a7b8c9d0-e1f2-4a3b-8c4d-5e6f7a8b9c0d';
  const saldo = (usuarioId, nombre, importe) => ({ usuario_id: usuarioId, nombre, saldo: importe });

  // Aplica las transferencias sobre los saldos (en céntimos) y devuelve lo que queda en cada cuenta
  const aplicar = (saldos, transferencias) => {
    const cuentas = new Map(saldos.map((s) => [s.usuario_id, Math.round(s.saldo * 100)]));
    for (const { de, a, importe } of transferencias) {
      const centimos = Math.round(importe * 100);
      cuentas.set(de, cuentas.get(de) + centimos);
      cuentas.set(a, cuentas.get(a) - centimos);
    }
    return [...cuentas.values()];
  };

  it('sin saldos pendientes no hay transferencias', () => {
    const saldos = [saldo(ADRIANA, 'Adriana', 0), saldo(BERTA, 'Berta', 0)];

    assert.deepEqual(gastoService.planDeTransferencias(saldos), []);
  });

  it('con dos miembros, el que debe paga al que le deben', () => {
    const saldos = [saldo(ADRIANA, 'Adriana', 10), saldo(BERTA, 'Berta', -10)];

    assert.deepEqual(gastoService.planDeTransferencias(saldos), [
      { de: BERTA, de_nombre: 'Berta', a: ADRIANA, a_nombre: 'Adriana', importe: 10 },
    ]);
  });

  it('con tres miembros y un solo acreedor, cada deudor paga al acreedor', () => {
    const saldos = [saldo(ADRIANA, 'Adriana', 40), saldo(BERTA, 'Berta', -25), saldo(ELENA, 'Elena', -15)];

    const transferencias = gastoService.planDeTransferencias(saldos);

    assert.deepEqual(transferencias, [
      { de: BERTA, de_nombre: 'Berta', a: ADRIANA, a_nombre: 'Adriana', importe: 25 },
      { de: ELENA, de_nombre: 'Elena', a: ADRIANA, a_nombre: 'Adriana', importe: 15 },
    ]);
  });

  it('empareja los saldos iguales de signo contrario en una sola transferencia', () => {
    const saldos = [
      saldo(ADRIANA, 'Adriana', 10),
      saldo(BERTA, 'Berta', -10),
      saldo(ELENA, 'Elena', 20),
      saldo(DANIEL, 'Daniel', -20),
    ];

    assert.deepEqual(gastoService.planDeTransferencias(saldos), [
      { de: BERTA, de_nombre: 'Berta', a: ADRIANA, a_nombre: 'Adriana', importe: 10 },
      { de: DANIEL, de_nombre: 'Daniel', a: ELENA, a_nombre: 'Elena', importe: 20 },
    ]);
  });

  it('no pierde céntimos aunque los saldos no cuadren al céntimo con la división', () => {
    const saldos = [saldo(ADRIANA, 'Adriana', 3.34), saldo(BERTA, 'Berta', -3.33), saldo(ELENA, 'Elena', -0.01)];

    const transferencias = gastoService.planDeTransferencias(saldos);

    assert.deepEqual(transferencias.map((t) => t.importe), [3.33, 0.01]);
    assert.deepEqual(aplicar(saldos, transferencias), [0, 0, 0]);
  });

  it('nunca propone más de n − 1 transferencias', () => {
    const saldos = [
      saldo(ADRIANA, 'Adriana', 12.34),
      saldo(BERTA, 'Berta', 0.66),
      saldo(ELENA, 'Elena', -5.5),
      saldo(DANIEL, 'Daniel', -3.5),
      saldo(ANTIGUO_ID, null, -4),
    ];

    const transferencias = gastoService.planDeTransferencias(saldos);

    assert.ok(transferencias.length <= saldos.length - 1);
    assert.deepEqual(aplicar(saldos, transferencias), [0, 0, 0, 0, 0]);
  });

  it('al aplicar las transferencias todos los saldos quedan a 0', () => {
    const casos = [
      [saldo(ADRIANA, 'Adriana', 7.77), saldo(BERTA, 'Berta', -2.22), saldo(ELENA, 'Elena', -5.55)],
      [saldo(ADRIANA, 'Adriana', -1), saldo(BERTA, 'Berta', -2), saldo(ELENA, 'Elena', 1.5), saldo(DANIEL, 'Daniel', 1.5)],
      [saldo(ADRIANA, 'Adriana', 0.01), saldo(BERTA, 'Berta', -0.01), saldo(ELENA, 'Elena', 0.02), saldo(DANIEL, 'Daniel', -0.02)],
    ];

    for (const saldos of casos) {
      const transferencias = gastoService.planDeTransferencias(saldos);
      assert.deepEqual(aplicar(saldos, transferencias), saldos.map(() => 0));
    }
  });

  it('un antiguo miembro con saldo aparece en la transferencia sin nombre', () => {
    const saldos = [saldo(ADRIANA, 'Adriana', 10), saldo(ANTIGUO_ID, null, -10)];

    assert.deepEqual(gastoService.planDeTransferencias(saldos), [
      { de: ANTIGUO_ID, de_nombre: null, a: ADRIANA, a_nombre: 'Adriana', importe: 10 },
    ]);
  });
});

// Función completa, a partir del balance del viaje (con el cliente falso y el viaje simulado)
describe('gastoService.liquidacion', () => {
  afterEach(() => mock.restoreAll());

  const MIEMBROS = [
    { usuario_id: ADRIANA, nombre: 'Adriana' },
    { usuario_id: BERTA, nombre: 'Berta' },
  ];
  const conMiembros = (miembros = MIEMBROS) =>
    mock.method(viajeService, 'obtener', async () => ({ viaje: { id: VIAJE_ID, miembros } }));
  const gastoDe = (pagadoPor, importe, repartos) => ({
    importe,
    pagado_por: pagadoPor,
    repartos: repartos.map(([usuarioId, parte]) => ({ usuario_id: usuarioId, importe: parte })),
  });

  it('a partir de los gastos del viaje devuelve las transferencias para saldar las cuentas', async () => {
    conMiembros();
    const cliente = clienteFalso({
      respuestas: [{ data: [gastoDe(ADRIANA, '10.00', [[ADRIANA, '5.00'], [BERTA, '5.00']])], error: null }],
    });

    const resultado = await gastoService.liquidacion(cliente, ADRIANA, VIAJE_ID);

    assert.deepEqual(resultado, {
      estado: 'ok',
      transferencias: [{ de: BERTA, de_nombre: 'Berta', a: ADRIANA, a_nombre: 'Adriana', importe: 5 }],
    });
  });

  it('sin gastos devuelve una lista vacía', async () => {
    conMiembros();
    const cliente = clienteFalso({ respuestas: [{ data: [], error: null }] });

    assert.deepEqual(await gastoService.liquidacion(cliente, ADRIANA, VIAJE_ID), { estado: 'ok', transferencias: [] });
  });

  it('incluye al antiguo miembro sin nombre', async () => {
    conMiembros([MIEMBROS[0]]);
    const cliente = clienteFalso({
      respuestas: [{ data: [gastoDe(ADRIANA, '4.00', [[BERTA, '4.00']])], error: null }],
    });

    const { transferencias } = await gastoService.liquidacion(cliente, ADRIANA, VIAJE_ID);

    assert.deepEqual(transferencias, [
      { de: BERTA, de_nombre: null, a: ADRIANA, a_nombre: 'Adriana', importe: 4 },
    ]);
  });

  it('devuelve no_existe si el viaje no existe o no se es miembro', async () => {
    mock.method(viajeService, 'obtener', async () => ({ viaje: null }));
    const cliente = clienteFalso();

    assert.deepEqual(await gastoService.liquidacion(cliente, ADRIANA, VIAJE_ID), { estado: 'no_existe' });
    assert.equal(cliente.consultas.length, 0);
  });

  it('devuelve el error si falla la lectura de los gastos', async () => {
    conMiembros();
    const error = { code: 'PGRST301' };
    const cliente = clienteFalso({ respuestas: [{ data: null, error }] });

    assert.deepEqual(await gastoService.liquidacion(cliente, ADRIANA, VIAJE_ID), { error });
  });
});

// Detalle de un gasto: cada reparto con el nombre de su miembro, y quien ya abandonó el viaje sin nombre
describe('gastoService.detalle', () => {
  afterEach(() => mock.restoreAll());

  // Solo Adriana sigue en el viaje: Berta ya lo abandonó
  const conMiembros = (miembros = [{ usuario_id: ADRIANA, nombre: 'Adriana' }]) =>
    mock.method(viajeService, 'obtener', async () => ({ viaje: { id: VIAJE_ID, miembros } }));

  it('devuelve el gasto con el nombre y la parte de cada miembro', async () => {
    conMiembros();
    const cliente = clienteFalso({ respuestas: [{ data: FILA, error: null }] });

    const resultado = await gastoService.detalle(cliente, ADRIANA, VIAJE_ID, GASTO_ID);

    assert.equal(resultado.estado, 'ok');
    assert.equal(resultado.gasto.importe, 10);
    assert.equal(resultado.gasto.pagado_por, ADRIANA);
    assert.deepEqual(resultado.gasto.repartos, [
      { usuario_id: ADRIANA, nombre: 'Adriana', abandonado: false, importe: 3.34 },
      { usuario_id: BERTA, nombre: null, abandonado: true, importe: 3.33 },
    ]);
  });

  it('busca el gasto dentro del viaje indicado', async () => {
    conMiembros();
    const cliente = clienteFalso({ respuestas: [{ data: FILA, error: null }] });

    await gastoService.detalle(cliente, ADRIANA, VIAJE_ID, GASTO_ID);

    assert.deepEqual(operacion(cliente.consultas[0], 'eq'), [['eq', 'id', GASTO_ID], ['eq', 'viaje_id', VIAJE_ID]]);
  });

  it('devuelve no_existe sin buscar el gasto si el viaje no existe o no se es miembro', async () => {
    mock.method(viajeService, 'obtener', async () => ({ viaje: null }));
    const cliente = clienteFalso();

    assert.deepEqual(await gastoService.detalle(cliente, ADRIANA, VIAJE_ID, GASTO_ID), { estado: 'no_existe' });
    assert.equal(cliente.consultas.length, 0);
  });

  it('devuelve no_encontrado si el gasto no está en el viaje', async () => {
    conMiembros();
    const cliente = clienteFalso({ respuestas: [{ data: null, error: null }] });

    assert.deepEqual(await gastoService.detalle(cliente, ADRIANA, VIAJE_ID, GASTO_ID), { estado: 'no_encontrado' });
  });

  it('devuelve el error si falla la comprobación del viaje', async () => {
    const error = { code: 'PGRST301' };
    mock.method(viajeService, 'obtener', async () => ({ error }));
    const cliente = clienteFalso();

    assert.deepEqual(await gastoService.detalle(cliente, ADRIANA, VIAJE_ID, GASTO_ID), { error });
  });

  it('devuelve el error si falla la lectura del gasto', async () => {
    conMiembros();
    const error = { code: 'PGRST301' };
    const cliente = clienteFalso({ respuestas: [{ data: null, error }] });

    assert.deepEqual(await gastoService.detalle(cliente, ADRIANA, VIAJE_ID, GASTO_ID), { error });
  });
});

// Edición: la función editar_gasto hace el trabajo; el servicio le pasa los datos y lee el gasto editado
describe('gastoService.editar', () => {
  afterEach(() => mock.restoreAll());

  const DATOS_EDICION = {
    concepto: 'Cena corregida',
    importe: 10,
    categoria: 'comida',
    pagado_por: ADRIANA,
    fecha: '2027-05-12',
    participantes: [ADRIANA, BERTA],
  };

  it('llama a editar_gasto con el gasto, el viaje y los datos, y devuelve el gasto editado', async () => {
    const cliente = clienteFalso({
      respuestaRpc: { data: { estado: 'ok', gasto_id: GASTO_ID }, error: null },
      respuestas: [{ data: FILA, error: null }],
    });

    const resultado = await gastoService.editar(cliente, VIAJE_ID, GASTO_ID, DATOS_EDICION);

    assert.equal(resultado.estado, 'ok');
    assert.equal(resultado.gasto.id, GASTO_ID);
    assert.deepEqual(cliente.llamadasRpc, [[
      'editar_gasto',
      {
        p_gasto_id: GASTO_ID,
        p_viaje_id: VIAJE_ID,
        p_concepto: 'Cena corregida',
        p_importe: 10,
        p_categoria: 'comida',
        p_pagado_por: ADRIANA,
        p_fecha: '2027-05-12',
        p_participantes: [ADRIANA, BERTA],
      },
    ]]);
  });

  // Rechazos de la función: no se lee nada más
  for (const estado of ['no_existe', 'no_activo', 'no_encontrado', 'sin_permiso', 'no_miembro']) {
    it(`devuelve ${estado} sin leer el gasto cuando la función lo rechaza`, async () => {
      const cliente = clienteFalso({ respuestaRpc: { data: { estado }, error: null } });

      assert.deepEqual(await gastoService.editar(cliente, VIAJE_ID, GASTO_ID, DATOS_EDICION), { estado });
      assert.equal(cliente.consultas.length, 0);
    });
  }

  it('devuelve el error de la función', async () => {
    const error = { code: '23514' };
    const cliente = clienteFalso({ respuestaRpc: { data: null, error } });

    assert.deepEqual(await gastoService.editar(cliente, VIAJE_ID, GASTO_ID, DATOS_EDICION), { error });
  });

  it('trata una respuesta vacía de la función como un error', async () => {
    const cliente = clienteFalso({ respuestaRpc: { data: null, error: null } });

    assert.deepEqual(await gastoService.editar(cliente, VIAJE_ID, GASTO_ID, DATOS_EDICION), {
      error: { code: 'respuesta_vacia' },
    });
  });

  it('trata como error que el gasto editado no se encuentre al leerlo', async () => {
    const cliente = clienteFalso({
      respuestaRpc: { data: { estado: 'ok', gasto_id: GASTO_ID }, error: null },
      respuestas: [{ data: null, error: null }],
    });

    assert.deepEqual(await gastoService.editar(cliente, VIAJE_ID, GASTO_ID, DATOS_EDICION), {
      error: { code: 'sin_filas' },
    });
  });
});

// Borrado: la política RLS filtra los gastos que quien pide no puede borrar, así que no aparecen en el resultado
describe('gastoService.eliminar', () => {
  afterEach(() => mock.restoreAll());

  const conViaje = (estado = 'activo') =>
    mock.method(viajeService, 'obtener', async () => ({ viaje: { id: VIAJE_ID, estado, miembros: [] } }));

  it('borra el gasto del viaje y devuelve ok', async () => {
    conViaje();
    const cliente = clienteFalso({ respuestas: [{ data: [{ id: GASTO_ID }], error: null }] });

    assert.deepEqual(await gastoService.eliminar(cliente, ADRIANA, VIAJE_ID, GASTO_ID), { estado: 'ok' });
    const [consulta] = cliente.consultas;
    assert.equal(consulta.tabla, 'gastos');
    assert.deepEqual(consulta.operaciones.map(([metodo]) => metodo), ['delete', 'eq', 'eq', 'select']);
    assert.deepEqual(operacion(consulta, 'eq'), [['eq', 'id', GASTO_ID], ['eq', 'viaje_id', VIAJE_ID]]);
  });

  it('devuelve no_encontrado si no se borra ninguna fila (no existe o no tiene permiso)', async () => {
    conViaje();
    const cliente = clienteFalso({ respuestas: [{ data: [], error: null }] });

    assert.deepEqual(await gastoService.eliminar(cliente, ADRIANA, VIAJE_ID, GASTO_ID), { estado: 'no_encontrado' });
  });

  it('trata una respuesta sin filas como no_encontrado', async () => {
    conViaje();
    const cliente = clienteFalso({ respuestas: [{ data: null, error: null }] });

    assert.deepEqual(await gastoService.eliminar(cliente, ADRIANA, VIAJE_ID, GASTO_ID), { estado: 'no_encontrado' });
  });

  it('en un viaje archivado devuelve no_activo sin borrar nada', async () => {
    conViaje('archivado');
    const cliente = clienteFalso();

    assert.deepEqual(await gastoService.eliminar(cliente, ADRIANA, VIAJE_ID, GASTO_ID), { estado: 'no_activo' });
    assert.equal(cliente.consultas.length, 0);
  });

  it('devuelve no_existe sin borrar nada si el viaje no existe o no se es miembro', async () => {
    mock.method(viajeService, 'obtener', async () => ({ viaje: null }));
    const cliente = clienteFalso();

    assert.deepEqual(await gastoService.eliminar(cliente, ADRIANA, VIAJE_ID, GASTO_ID), { estado: 'no_existe' });
    assert.equal(cliente.consultas.length, 0);
  });

  it('devuelve el error si falla el borrado', async () => {
    conViaje();
    const error = { code: 'PGRST301' };
    const cliente = clienteFalso({ respuestas: [{ data: null, error }] });

    assert.deepEqual(await gastoService.eliminar(cliente, ADRIANA, VIAJE_ID, GASTO_ID), { error });
  });
});
