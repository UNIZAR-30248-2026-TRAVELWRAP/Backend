const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const notificacionService = require('../src/services/notificacionService');
const notificacionController = require('../src/controllers/notificacionController');

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
  send() {
    return this;
  },
});

const llamar = async (accion, body) => {
  const req = { body, usuario: { id: 'ana' }, supabase: {} };
  const res = crearRes();
  await notificacionController[accion](req, res);
  return res;
};

const SUSCRIPCION = { endpoint: 'https://push.test/ana', keys: { p256dh: 'p', auth: 'a' } };

afterEach(() => mock.restoreAll());

describe('GET /notificaciones/clave-publica', () => {
  it('devuelve la clave pública', async () => {
    mock.method(notificacionService, 'clavePublica', () => 'clave');
    const res = await llamar('obtenerClave');
    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { clave: 'clave' });
  });

});

describe('POST /notificaciones/suscripciones', () => {

  it('rechaza sin cuerpo, sin claves o con un endpoint que no es https', async () => {
    const guardar = mock.method(notificacionService, 'suscribir', async () => ({ estado: 'ok' }));
    const casos = [undefined, { endpoint: SUSCRIPCION.endpoint }, { ...SUSCRIPCION, endpoint: 'http://push.test' }, { ...SUSCRIPCION, keys: { p256dh: 'p' } }];

    for (const caso of casos) {
      const res = await llamar('suscribir', caso);
      assert.equal(res.codigo, 400);
      assert.equal(res.cuerpo.error.codigo, 'datos_invalidos');
    }
    assert.equal(guardar.mock.callCount(), 0);
  });

  it('responde 502 si falla Supabase y 500 si falla algo inesperado', async () => {
    mock.method(notificacionService, 'suscribir', async () => ({ error: { code: 'X' } }));
    const fallo = await llamar('suscribir', SUSCRIPCION);
    assert.equal(fallo.codigo, 502);
    assert.equal(fallo.cuerpo.error.codigo, 'error_notificacion');

    mock.restoreAll();
    mock.method(notificacionService, 'suscribir', async () => {
      throw new Error('inesperado');
    });
    const interno = await llamar('suscribir', SUSCRIPCION);
    assert.equal(interno.codigo, 500);
  });
});

describe('DELETE /notificaciones/suscripciones', () => {
  it('da de baja la suscripción y responde 204', async () => {
    const cancelar = mock.method(notificacionService, 'cancelar', async () => ({ estado: 'ok' }));
    const res = await llamar('darDeBaja', { endpoint: SUSCRIPCION.endpoint });

    assert.equal(res.codigo, 204);
    assert.deepEqual(cancelar.mock.calls[0].arguments.slice(1), ['ana', SUSCRIPCION.endpoint]);
  });


});
