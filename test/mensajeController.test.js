// Pruebas del controlador de mensajes: validación, traducción de resultados y aviso por el socket.
// El servicio y el socket se sustituyen por mocks
const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const mensajeService = require('../src/services/mensajeService');
const chatSocket = require('../src/sockets/chatSocket');
const mensajeController = require('../src/controllers/mensajeController');

const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const ADRIANA = 'df77cba6-4be5-4cbc-814b-1e228dd73dcc';
const USUARIO = { id: ADRIANA };
const MENSAJE = { id: 'm1', texto: 'Hola', creado_en: '2026-05-12T10:00:00Z', autor: { usuario_id: ADRIANA, nombre: 'Adriana', avatar_url: null } };

// Respuesta de Express falsa que guarda el código y el cuerpo enviados
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
  end() {
    return this;
  },
});

const llamar = async (accion, { viajeId = VIAJE_ID, query = {}, body } = {}) => {
  const req = { params: { viajeId }, query, body, usuario: USUARIO, supabase: {} };
  const res = crearRes();
  await mensajeController[accion](req, res);
  return res;
};

afterEach(() => mock.restoreAll());

describe('GET /viajes/:viajeId/mensajes (listar)', () => {
  it('devuelve los mensajes con 200 y pasa la fecha de antes normalizada al servicio', async () => {
    const listar = mock.method(mensajeService, 'listar', async () => ({ estado: 'ok', mensajes: [MENSAJE] }));

    const res = await llamar('listar', { query: { antes: '2026-05-12T10:05:00+02:00' } });

    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { mensajes: [MENSAJE] });
    assert.deepEqual(listar.mock.calls[0].arguments.slice(1), [ADRIANA, VIAJE_ID, '2026-05-12T08:05:00.000Z']);
  });

  it('sin antes no pasa fecha al servicio', async () => {
    const listar = mock.method(mensajeService, 'listar', async () => ({ estado: 'ok', mensajes: [] }));

    await llamar('listar');

    assert.equal(listar.mock.calls[0].arguments[3], undefined);
  });

  it('rechaza un identificador de viaje que no es un UUID o una fecha no válida, sin llamar al servicio', async () => {
    const listar = mock.method(mensajeService, 'listar', async () => ({ estado: 'ok', mensajes: [] }));

    assert.equal((await llamar('listar', { viajeId: 'x' })).codigo, 400);
    const fechaMala = await llamar('listar', { query: { antes: 'ayer' } });
    assert.equal(fechaMala.codigo, 400);
    assert.equal(fechaMala.cuerpo.error.codigo, 'datos_invalidos');
    assert.equal(listar.mock.calls.length, 0);
  });

  it('responde 404 si el viaje no existe, y 502 si falla Supabase', async () => {
    mock.method(mensajeService, 'listar', async () => ({ estado: 'no_existe' }));
    assert.equal((await llamar('listar')).codigo, 404);

    mock.restoreAll();
    mock.method(mensajeService, 'listar', async () => ({ error: { code: 'PGRST000' } }));
    const fallo = await llamar('listar');
    assert.equal(fallo.codigo, 502);
    assert.equal(fallo.cuerpo.error.mensaje, 'No se han podido obtener los mensajes');
  });
});

describe('POST /viajes/:viajeId/mensajes (crear)', () => {
  it('responde 201 con el mensaje guardado y lo avisa a la sala del viaje', async () => {
    mock.method(mensajeService, 'crear', async () => ({ estado: 'ok', mensaje: MENSAJE }));
    const avisar = mock.method(chatSocket, 'avisarMensaje', () => {});

    const res = await llamar('crear', { body: { texto: 'Hola' } });

    assert.equal(res.codigo, 201);
    assert.deepEqual(res.cuerpo, MENSAJE);
    assert.deepEqual(avisar.mock.calls[0].arguments, [VIAJE_ID, MENSAJE]);
  });

  it('quita los espacios sobrantes del texto antes de guardarlo', async () => {
    const crear = mock.method(mensajeService, 'crear', async () => ({ estado: 'ok', mensaje: MENSAJE }));
    mock.method(chatSocket, 'avisarMensaje', () => {});

    await llamar('crear', { body: { texto: '   Hola  ' } });

    assert.equal(crear.mock.calls[0].arguments[3], 'Hola');
  });

  it('rechaza un texto vacío, uno de más de 1000 caracteres o sin texto, sin llamar al servicio', async () => {
    const crear = mock.method(mensajeService, 'crear', async () => ({ estado: 'ok', mensaje: MENSAJE }));

    for (const body of [{ texto: '' }, { texto: '   ' }, { texto: 'a'.repeat(1001) }, {}, undefined]) {
      const res = await llamar('crear', { body });
      assert.equal(res.codigo, 400);
      assert.equal(res.cuerpo.error.codigo, 'datos_invalidos');
    }
    assert.equal(crear.mock.calls.length, 0);
  });

  it('acepta un texto de exactamente 1000 caracteres', async () => {
    mock.method(mensajeService, 'crear', async () => ({ estado: 'ok', mensaje: MENSAJE }));
    mock.method(chatSocket, 'avisarMensaje', () => {});

    assert.equal((await llamar('crear', { body: { texto: 'a'.repeat(1000) } })).codigo, 201);
  });

  it('con el viaje finalizado responde 409 y no avisa a nadie', async () => {
    mock.method(mensajeService, 'crear', async () => ({ estado: 'no_activo' }));
    const avisar = mock.method(chatSocket, 'avisarMensaje', () => {});

    const res = await llamar('crear', { body: { texto: 'Hola' } });

    assert.equal(res.codigo, 409);
    assert.equal(res.cuerpo.error.codigo, 'viaje_no_activo');
    assert.equal(avisar.mock.calls.length, 0);
  });

  it('responde 404 si el viaje no existe y 502 si falla Supabase, sin avisar a nadie', async () => {
    const avisar = mock.method(chatSocket, 'avisarMensaje', () => {});
    mock.method(mensajeService, 'crear', async () => ({ estado: 'no_existe' }));
    assert.equal((await llamar('crear', { body: { texto: 'Hola' } })).codigo, 404);

    mock.restoreAll();
    mock.method(chatSocket, 'avisarMensaje', () => {});
    mock.method(mensajeService, 'crear', async () => ({ error: { code: 'PGRST000' } }));
    const fallo = await llamar('crear', { body: { texto: 'Hola' } });
    assert.equal(fallo.codigo, 502);
    assert.equal(avisar.mock.calls.length, 0);
  });
});
