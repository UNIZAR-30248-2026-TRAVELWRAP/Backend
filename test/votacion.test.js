// Pruebas de las votaciones: el servicio con un cliente de Supabase simulado y el controlador con el
// servicio simulado. No tocan la red ni la base de datos real. Se ejecutan con `npm test`.
const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const votacionService = require('../src/services/votacionService');
const votacionController = require('../src/controllers/votacionController');
const votacionesSocket = require('../src/sockets/votacionesSocket');

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
  it('devuelve las votaciones del viaje con el recuento, el voto del usuario y cuántos pueden votar', async () => {
    const cliente = clienteFalso([viaje(), ok([votacion()]), opciones, votos]);

    const resultado = await votacionService.listar(cliente, USUARIO, VIAJE_ID, { estado: 'abierta' });

    assert.equal(resultado.estado, 'ok');
    const [v] = resultado.votaciones;
    assert.equal(v.viaje_id, undefined);
    assert.deepEqual(
      v.opciones.map((o) => [o.texto, o.votos]),
      [['Lisboa', 0], ['Praga', 2]],
    );
    assert.deepEqual(v.opciones[1].votantes, [USUARIO, OTRO]);
    assert.equal(v.total_votos, 2);
    assert.equal(v.total_miembros, 2);
    assert.equal(v.todos_han_votado, true);
    assert.equal(v.mi_voto, PRAGA);
    assert.deepEqual(operacion(cliente.consultas[1], 'eq').slice(1), ['viaje_id', VIAJE_ID]);
    assert.ok(cliente.consultas[1].operaciones.some(([m, c, val]) => m === 'eq' && c === 'estado' && val === 'abierta'));
  });

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

  it('pasa el motivo de la función si no se puede crear', async () => {
    const cliente = clienteFalso([], [ok({ estado: 'no_activo' })]);
    assert.deepEqual(await votacionService.crear(cliente, USUARIO, VIAJE_ID, { opciones: [] }), { estado: 'no_activo' });
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

  it('no deja votar en un viaje archivado', async () => {
    const cliente = clienteFalso([viaje({ estado: 'archivado' }), ok(votacion())]);
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

  it('solo la cierra el creador del viaje', async () => {
    const cliente = clienteFalso([viaje({ rol: 'miembro' }), ok(votacion())]);
    assert.deepEqual(await votacionService.cerrar(cliente, USUARIO, VIAJE_ID, VOTACION_ID), { estado: 'no_creador' });
    assert.equal(cliente.llamadasRpc.length, 0);
  });

  it('pasa los motivos de la función: faltan votos o cerrada justo antes por otro', async () => {
    const faltan = clienteFalso([viaje(), ok(votacion())], [ok({ estado: 'faltan_votos' })]);
    assert.deepEqual(await votacionService.cerrar(faltan, USUARIO, VIAJE_ID, VOTACION_ID), { estado: 'faltan_votos' });

    const yaCerrada = clienteFalso([viaje(), ok(votacion())], [ok({ estado: 'ya_cerrada' })]);
    assert.deepEqual(await votacionService.cerrar(yaCerrada, USUARIO, VIAJE_ID, VOTACION_ID), { estado: 'votacion_cerrada' });
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

  for (const [caso, body] of [
    ['sin título', { ...valida, titulo: '  ' }],
    ['de tipo destino', { ...valida, tipo: 'destino' }],
    ['con menos de dos opciones', { ...valida, opciones: [{ texto: 'Sábado' }] }],
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

  it('votar sin una opción válida responde 400', async () => {
    const votar = simular('votar', async () => ({ estado: 'ok' }));
    const res = await llamar('votar', { body: { opcion_id: 'lisboa' } });
    assert.equal(res.codigo, 400);
    assert.equal(votar.mock.callCount(), 0);
  });

  it('un identificador de votación mal formado responde 400', async () => {
    const res = await llamar('obtener', { params: { votacionId: 'abc' } });
    assert.equal(res.codigo, 400);
  });

  it('un filtro de estado desconocido responde 400', async () => {
    const res = await llamar('listar', { query: { estado: 'pendiente' } });
    assert.equal(res.codigo, 400);
  });
});

describe('POST /viajes/:viajeId/votaciones/:votacionId/cerrar', () => {
  it('responde con la votación cerrada, si hubo empate y el destino fijado', async () => {
    simular('cerrar', async () => ({ estado: 'ok', votacion: { id: VOTACION_ID, estado: 'cerrada' }, hubo_empate: false, destino: 'Praga' }));
    const res = await llamar('cerrar');
    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { votacion: { id: VOTACION_ID, estado: 'cerrada' }, hubo_empate: false, destino: 'Praga' });
  });

  it('si no han votado todos los miembros responde 409 faltan_votos (RF9)', async () => {
    simular('cerrar', async () => ({ estado: 'faltan_votos' }));
    const res = await llamar('cerrar');
    assert.equal(res.codigo, 409);
    assert.equal(res.cuerpo.error.codigo, 'faltan_votos');
  });

  it('quien no es el creador recibe 403', async () => {
    simular('cerrar', async () => ({ estado: 'no_creador' }));
    const res = await llamar('cerrar');
    assert.equal(res.codigo, 403);
  });
});

describe('avisos en tiempo real', () => {
  const avisos = () => mock.method(votacionesSocket, 'avisarCambio', () => {});

  for (const [accion, motivo, body] of [
    ['crear', 'creada', { titulo: '¿Qué día?', opciones: [{ texto: 'Viernes' }, { texto: 'Sábado' }] }],
    ['anadirOpcion', 'opcion', { texto: 'Lisboa' }],
    ['votar', 'voto', { opcion_id: LISBOA }],
    ['retirarVoto', 'voto', undefined],
  ]) {
    it(`${accion} avisa a los miembros del viaje con el motivo «${motivo}»`, async () => {
      simular(accion, async () => ({ estado: 'ok', votacion: { id: VOTACION_ID } }));
      const avisar = avisos();

      await llamar(accion, { body });

      assert.deepEqual(avisar.mock.calls[0].arguments, [VIAJE_ID, { votacion_id: VOTACION_ID, motivo }]);
    });
  }

  it('cerrar avisa con el destino fijado', async () => {
    simular('cerrar', async () => ({ estado: 'ok', votacion: { id: VOTACION_ID }, hubo_empate: false, destino: 'Praga' }));
    const avisar = avisos();

    await llamar('cerrar');

    assert.deepEqual(avisar.mock.calls[0].arguments, [VIAJE_ID, { votacion_id: VOTACION_ID, motivo: 'cerrada', destino: 'Praga' }]);
  });

  it('si la acción falla no se avisa', async () => {
    simular('votar', async () => ({ estado: 'votacion_cerrada' }));
    simular('cerrar', async () => ({ estado: 'faltan_votos' }));
    const avisar = avisos();

    await llamar('votar', { body: { opcion_id: LISBOA } });
    await llamar('cerrar');

    assert.equal(avisar.mock.callCount(), 0);
  });
});
