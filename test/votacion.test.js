// Pruebas de las votaciones: el servicio con un cliente de Supabase simulado y el controlador con el
// servicio simulado. No tocan la red ni la base de datos real. Se ejecutan con `npm test`.
const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const votacionService = require('../src/services/votacionService');
const votacionController = require('../src/controllers/votacionController');

const USUARIO = 'df77cba6-4be5-4cbc-814b-1e228dd73dcc';
const OTRO = 'a1b2c3d4-0000-4000-8000-000000000001';
const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const VOTACION_ID = '6f1c2d3e-0000-4000-8000-000000000010';
const LISBOA = '6f1c2d3e-0000-4000-8000-0000000000a1';
const PRAGA = '6f1c2d3e-0000-4000-8000-0000000000a2';

// Cliente de Supabase falso: cada consulta encadenable (from().select().eq()...) se resuelve con la
// siguiente respuesta preparada, y cada rpc con la siguiente de las suyas. Se apuntan las operaciones
const clienteFalso = (respuestas, respuestasRpc = []) => {
  const consultas = [];
  const rpc = [];
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
  return {
    from,
    consultas,
    rpc: async (nombre, parametros) => {
      rpc.push({ nombre, parametros });
      return respuestasRpc.shift();
    },
    llamadasRpc: rpc,
  };
};

const ok = (data) => ({ data, error: null });

// Viaje tal como lo devuelve viajeService.obtener (select con los miembros embebidos)
const viaje = ({ rol = 'creador', estado = 'activo' } = {}) =>
  ok({
    id: VIAJE_ID,
    nombre: 'Escapada',
    destino: null,
    estado,
    miembros_viaje: [
      { usuario_id: USUARIO, rol, abandonado_en: null, perfiles: { nombre: 'Adriana', avatar_url: null } },
      { usuario_id: OTRO, rol: rol === 'creador' ? 'miembro' : 'creador', abandonado_en: null, perfiles: { nombre: 'Berta', avatar_url: null } },
    ],
  });

const votacion = (datos = {}) => ({
  id: VOTACION_ID,
  viaje_id: VIAJE_ID,
  titulo: '¿A dónde queremos ir?',
  descripcion: null,
  tipo: 'destino',
  estado: 'abierta',
  opcion_ganadora_id: null,
  creado_por: USUARIO,
  creado_en: '2026-10-20T10:00:00Z',
  cerrada_en: null,
  ...datos,
});

const opciones = ok([
  { id: LISBOA, votacion_id: VOTACION_ID, texto: 'Lisboa', valor_fecha: null, orden: 0 },
  { id: PRAGA, votacion_id: VOTACION_ID, texto: 'Praga', valor_fecha: null, orden: 1 },
]);
const votos = ok([
  { votacion_id: VOTACION_ID, opcion_id: PRAGA, usuario_id: USUARIO },
  { votacion_id: VOTACION_ID, opcion_id: PRAGA, usuario_id: OTRO },
]);

// Respuestas de una votación con su recuento: viaje, votación, opciones y votos
const recuento = (datos) => [viaje(), ok(votacion(datos)), opciones, votos];

const operacion = (consulta, metodo) => consulta.operaciones.find(([m]) => m === metodo);

describe('votacionService.listar', () => {

  it('todos_han_votado es false mientras falte algún miembro por votar', async () => {
    const soloOtro = ok([{ votacion_id: VOTACION_ID, opcion_id: PRAGA, usuario_id: OTRO }]);
    const cliente = clienteFalso([viaje(), ok([votacion()]), opciones, soloOtro]);

    const [v] = (await votacionService.listar(cliente, USUARIO, VIAJE_ID)).votaciones;

    assert.equal(v.todos_han_votado, false);
    assert.equal(v.mi_voto, null);
  });


  it('sin votaciones no consulta opciones ni votos', async () => {
    const cliente = clienteFalso([viaje(), ok([])]);
    assert.deepEqual(await votacionService.listar(cliente, USUARIO, VIAJE_ID), { estado: 'ok', votaciones: [] });
    assert.equal(cliente.consultas.length, 2);
  });

  it('responde no_existe si el usuario no ve el viaje', async () => {
    const cliente = clienteFalso([ok(null)]);
    assert.deepEqual(await votacionService.listar(cliente, USUARIO, VIAJE_ID), { estado: 'no_existe' });
  });
});

describe('votacionService.crear', () => {
  it('crea la votación con sus opciones en una sola llamada y la devuelve con el recuento', async () => {
    const datos = { titulo: '¿Qué día?', descripcion: null, tipo: 'fecha', opciones: [{ texto: 'Viernes', valor_fecha: '2027-05-14' }] };
    const cliente = clienteFalso(recuento({ tipo: 'fecha' }), [ok({ estado: 'ok', votacion_id: VOTACION_ID })]);

    const resultado = await votacionService.crear(cliente, USUARIO, VIAJE_ID, datos);

    assert.equal(resultado.estado, 'ok');
    assert.equal(resultado.votacion.id, VOTACION_ID);
    assert.deepEqual(cliente.llamadasRpc, [
      {
        nombre: 'crear_votacion',
        parametros: { p_viaje_id: VIAJE_ID, p_titulo: '¿Qué día?', p_descripcion: null, p_tipo: 'fecha', p_opciones: datos.opciones },
      },
    ]);
  });

});

describe('votacionService.anadirOpcion', () => {
  it('añade la opción al final de la lista', async () => {
    const cliente = clienteFalso([viaje(), ok(votacion()), ok({ orden: 4 }), ok(null), ...recuento()]);

    const resultado = await votacionService.anadirOpcion(cliente, USUARIO, VIAJE_ID, VOTACION_ID, { texto: 'Oporto', valor_fecha: null });

    assert.equal(resultado.estado, 'ok');
    assert.deepEqual(operacion(cliente.consultas[3], 'insert')[1], { votacion_id: VOTACION_ID, texto: 'Oporto', valor_fecha: null, orden: 5 });
  });

  it('no añade opciones a una votación cerrada', async () => {
    const cliente = clienteFalso([viaje(), ok(votacion({ estado: 'cerrada' }))]);
    const resultado = await votacionService.anadirOpcion(cliente, USUARIO, VIAJE_ID, VOTACION_ID, { texto: 'Oporto' });
    assert.deepEqual(resultado, { estado: 'votacion_cerrada' });
    assert.equal(cliente.consultas.length, 2);
  });
});

describe('votacionService.votar', () => {
  it('guarda o cambia el voto del usuario con un upsert sobre (votacion_id, usuario_id)', async () => {
    const cliente = clienteFalso([viaje({ rol: 'miembro' }), ok(votacion()), ok({ id: LISBOA }), ok(null), ...recuento()]);

    const resultado = await votacionService.votar(cliente, USUARIO, VIAJE_ID, VOTACION_ID, LISBOA);

    assert.equal(resultado.estado, 'ok');
    const [, fila, opcionesUpsert] = operacion(cliente.consultas[3], 'upsert');
    assert.equal(fila.opcion_id, LISBOA);
    assert.equal(fila.usuario_id, USUARIO);
    assert.deepEqual(opcionesUpsert, { onConflict: 'votacion_id,usuario_id' });
  });

  it('rechaza una opción que no es de la votación sin intentar votar', async () => {
    const cliente = clienteFalso([viaje(), ok(votacion()), ok(null)]);
    const resultado = await votacionService.votar(cliente, USUARIO, VIAJE_ID, VOTACION_ID, LISBOA);
    assert.deepEqual(resultado, { estado: 'opcion_no_valida' });
    assert.equal(cliente.consultas.length, 3);
  });

  it('no deja votar en un viaje finalizado', async () => {
    const cliente = clienteFalso([viaje({ estado: 'finalizado' }), ok(votacion())]);
    assert.deepEqual(await votacionService.votar(cliente, USUARIO, VIAJE_ID, VOTACION_ID, LISBOA), { estado: 'no_activo' });
  });

  it('responde no_encontrada si la votación no es de ese viaje', async () => {
    const cliente = clienteFalso([viaje(), ok(null)]);
    assert.deepEqual(await votacionService.votar(cliente, USUARIO, VIAJE_ID, VOTACION_ID, LISBOA), { estado: 'no_encontrada' });
  });
});

describe('votacionService.retirarVoto', () => {
  it('borra solo el voto del usuario en esa votación', async () => {
    const cliente = clienteFalso([viaje(), ok(votacion()), ok(null), ...recuento()]);

    await votacionService.retirarVoto(cliente, USUARIO, VIAJE_ID, VOTACION_ID);

    const borrado = cliente.consultas[2];
    assert.equal(borrado.tabla, 'votos');
    assert.ok(operacion(borrado, 'delete'));
    const filtros = borrado.operaciones.filter(([m]) => m === 'eq').map(([, c, v]) => [c, v]);
    assert.deepEqual(filtros, [['votacion_id', VOTACION_ID], ['usuario_id', USUARIO]]);
  });
});

describe('votacionService.cambiarTipo', () => {
  it('lo cambia también un miembro que no es el creador', async () => {
    const cambiada = { tipo: 'otro' };
    const cliente = clienteFalso([
      viaje({ rol: 'miembro' }),
      ok(votacion({ tipo: 'fecha' })),
      ok([{ id: VOTACION_ID }]),
      viaje({ rol: 'miembro' }),
      ok(votacion({ tipo: 'fecha', ...cambiada })),
      opciones,
      votos,
    ]);

    const resultado = await votacionService.cambiarTipo(cliente, USUARIO, VIAJE_ID, VOTACION_ID, 'otro');

    assert.equal(resultado.estado, 'ok');
  });
});

describe('votacionService.cerrar', () => {
  it('cierra con la función cerrar_votacion y devuelve la votación, si hubo empate y el destino', async () => {
    const cerrada = { estado: 'cerrada', opcion_ganadora_id: PRAGA, cerrada_en: '2026-10-22T10:00:00Z' };
    const cliente = clienteFalso(
      [viaje(), ok(votacion()), ...recuento(cerrada)],
      [ok({ estado: 'ok', opcion_ganadora_id: PRAGA, hubo_empate: true, destino: 'Praga' })],
    );

    const resultado = await votacionService.cerrar(cliente, USUARIO, VIAJE_ID, VOTACION_ID);

    assert.equal(resultado.estado, 'ok');
    assert.equal(resultado.hubo_empate, true);
    assert.equal(resultado.destino, 'Praga');
    assert.equal(resultado.votacion.opcion_ganadora_id, PRAGA);
    assert.deepEqual(cliente.llamadasRpc, [{ nombre: 'cerrar_votacion', parametros: { p_viaje_id: VIAJE_ID, p_votacion_id: VOTACION_ID } }]);
  });


});

// ── Controlador, con el servicio simulado ──

const crearRes = () => ({
  codigo: null,
  cuerpo: undefined,
  status(codigo) {
    this.codigo = codigo;
    return this;
  },
  json(cuerpo) {
    this.cuerpo = cuerpo;
    return this;
  },
});

const llamar = async (accion, { params = {}, body, query = {} } = {}) => {
  const req = { params: { viajeId: VIAJE_ID, votacionId: VOTACION_ID, ...params }, body, query, usuario: { id: USUARIO }, supabase: {} };
  const res = crearRes();
  await votacionController[accion](req, res);
  return res;
};

const simular = (metodo, implementacion) => mock.method(votacionService, metodo, implementacion);

afterEach(() => mock.restoreAll());

describe('POST /viajes/:viajeId/votaciones (crear)', () => {
  const valida = { titulo: '  ¿Qué día salimos? ', tipo: 'fecha', opciones: [{ texto: ' Viernes ', valor_fecha: '2027-05-14' }, { texto: 'Sábado' }] };

  it('envía al servicio los datos limpios y responde 201 con la votación', async () => {
    const crear = simular('crear', async () => ({ estado: 'ok', votacion: { id: VOTACION_ID } }));

    const res = await llamar('crear', { params: { votacionId: undefined }, body: valida });

    assert.equal(res.codigo, 201);
    assert.deepEqual(res.cuerpo, { id: VOTACION_ID });
    assert.deepEqual(crear.mock.calls[0].arguments[3], {
      titulo: '¿Qué día salimos?',
      descripcion: null,
      tipo: 'fecha',
      opciones: [{ texto: 'Viernes', valor_fecha: '2027-05-14' }, { texto: 'Sábado', valor_fecha: null }],
    });
  });

  it('las opciones son opcionales: se puede crear sin ninguna o con una sola', async () => {
    const crear = simular('crear', async () => ({ estado: 'ok', votacion: { id: VOTACION_ID } }));

    const sinOpciones = await llamar('crear', { body: { titulo: '¿Dónde cenamos?' } });
    const conUna = await llamar('crear', { body: { titulo: '¿Dónde cenamos?', opciones: [{ texto: 'Tasca' }] } });

    assert.equal(sinOpciones.codigo, 201);
    assert.equal(conUna.codigo, 201);
    assert.deepEqual(crear.mock.calls[0].arguments[3].opciones, []);
    assert.deepEqual(crear.mock.calls[1].arguments[3].opciones, [{ texto: 'Tasca', valor_fecha: null }]);
  });

  for (const [caso, body] of [
    ['sin título', { ...valida, titulo: '  ' }],
    ['de tipo destino', { ...valida, tipo: 'destino' }],
    ['con más de 20 opciones', { ...valida, opciones: Array.from({ length: 21 }, (_, i) => ({ texto: `Opción ${i}` })) }],
    ['con opciones repetidas', { ...valida, opciones: [{ texto: 'Sábado' }, { texto: ' sábado' }] }],
    ['con una fecha mal escrita', { ...valida, opciones: [{ texto: 'Viernes', valor_fecha: '2027-02-30' }, { texto: 'Sábado' }] }],
  ]) {
    it(`rechaza una votación ${caso} sin llamar al servicio`, async () => {
      const crear = simular('crear', async () => ({ estado: 'ok' }));
      const res = await llamar('crear', { body });
      assert.equal(res.codigo, 400);
      assert.equal(res.cuerpo.error.codigo, 'datos_invalidos');
      assert.equal(crear.mock.callCount(), 0);
    });
  }
});

describe('respuestas de error de las votaciones', () => {
  it('una opción repetida responde 409 opcion_duplicada', async () => {
    simular('anadirOpcion', async () => ({ error: { code: '23505' } }));
    const res = await llamar('anadirOpcion', { body: { texto: 'Lisboa' } });
    assert.equal(res.codigo, 409);
    assert.equal(res.cuerpo.error.codigo, 'opcion_duplicada');
  });

  for (const [estado, codigoHttp, codigo] of [
    ['no_existe', 404, 'viaje_no_encontrado'],
    ['no_encontrada', 404, 'votacion_no_encontrada'],
    ['no_activo', 409, 'viaje_no_activo'],
    ['votacion_cerrada', 409, 'votacion_cerrada'],
    ['opcion_no_valida', 400, 'opcion_no_valida'],
  ]) {
    it(`${estado} responde ${codigoHttp} ${codigo}`, async () => {
      simular('votar', async () => ({ estado }));
      const res = await llamar('votar', { body: { opcion_id: LISBOA } });
      assert.equal(res.codigo, codigoHttp);
      assert.equal(res.cuerpo.error.codigo, codigo);
    });
  }


  it('un identificador de votación mal formado responde 400', async () => {
    const res = await llamar('obtener', { params: { votacionId: 'abc' } });
    assert.equal(res.codigo, 400);
  });

});


