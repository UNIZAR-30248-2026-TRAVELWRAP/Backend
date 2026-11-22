const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const viajeService = require('../src/services/viajeService');
const notificacionService = require('../src/services/notificacionService');
const notificacionesSocket = require('../src/sockets/notificacionesSocket');
const { avisarEvento } = require('../src/utils/avisosViaje');

const VIAJE = '123e4567-e89b-12d3-a456-426614174000';
const VIAJE_CON_MIEMBROS = {
  nombre: 'Roma 2027',
  miembros: [
    { usuario_id: 'ana', nombre: 'Ana' },
    { usuario_id: 'bea', nombre: 'Bea' },
    { usuario_id: 'carla', nombre: null },
  ],
};

const simular = (viaje = VIAJE_CON_MIEMBROS) => ({
  obtener: mock.method(viajeService, 'obtener', async () => ({ viaje })),
  socket: mock.method(notificacionesSocket, 'avisarA', () => undefined),
  push: mock.method(notificacionService, 'enviarPush', async () => undefined),
});

afterEach(() => mock.restoreAll());

describe('avisarEvento', () => {
  it('avisa a los demás miembros, nunca a quien genera el evento, con el viaje y el motivo', async () => {
    const { socket, push } = simular();

    await avisarEvento({}, 'ana', VIAJE, 'gasto', 'Cena');

    const [destinatarios, aviso] = socket.mock.calls[0].arguments;
    assert.deepEqual(destinatarios, ['bea', 'carla']);
    assert.deepEqual(aviso, {
      viaje_id: VIAJE,
      viaje_nombre: 'Roma 2027',
      tipo: 'gasto',
      pantalla: 'gastos',
      texto: 'Ana ha registrado un gasto: Cena',
    });
    assert.deepEqual(push.mock.calls[0].arguments.slice(1), [VIAJE, aviso]);
  });

  it('lleva cada tipo a su pantalla', async () => {
    const { socket } = simular();
    const esperado = { votacion: 'votaciones', gasto: 'gastos', tarea: 'tareas', mensaje: 'chat' };

    for (const [tipo, pantalla] of Object.entries(esperado)) {
      await avisarEvento({}, 'ana', VIAJE, tipo, 'x');
      assert.equal(socket.mock.calls.at(-1).arguments[1].pantalla, pantalla);
    }
  });

  it('acorta los textos largos y llama «Alguien» a quien no tiene nombre', async () => {
    const { socket } = simular({ ...VIAJE_CON_MIEMBROS, miembros: [{ usuario_id: 'ana', nombre: null }, { usuario_id: 'bea', nombre: 'Bea' }] });

    await avisarEvento({}, 'ana', VIAJE, 'mensaje', 'a'.repeat(200));

    const { texto } = socket.mock.calls[0].arguments[1];
    assert.ok(texto.startsWith('Alguien ha enviado un mensaje: aaa'));
    assert.ok(texto.endsWith('…'));
    assert.ok(texto.length < 130);
  });

  it('no avisa si el usuario no es miembro del viaje o el tipo no existe', async () => {
    const sinViaje = simular(null);
    await avisarEvento({}, 'ana', VIAJE, 'gasto', 'Cena');
    assert.equal(sinViaje.socket.mock.callCount(), 0);

    mock.restoreAll();
    const { socket } = simular();
    await avisarEvento({}, 'ana', VIAJE, 'otro', 'x');
    assert.equal(socket.mock.callCount(), 0);
  });

  it('nunca falla: un error al avisar no se propaga', async () => {
    mock.method(viajeService, 'obtener', async () => {
      throw new Error('Supabase caído');
    });
    await assert.doesNotReject(avisarEvento({}, 'ana', VIAJE, 'gasto', 'Cena'));
  });
});
