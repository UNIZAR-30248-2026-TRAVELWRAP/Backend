// Pruebas del controlador de sellos (PB-44): validación y traducción de cada resultado del servicio a HTTP.
// El servicio se sustituye por un mock
const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const selloService = require('../src/services/selloService');
const selloController = require('../src/controllers/selloController');

const USUARIO = { id: 'df77cba6-4be5-4cbc-814b-1e228dd73dcc' };
const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const SELLO_ID = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
const SELLO = { id: SELLO_ID, viaje_id: VIAJE_ID, diseno: 'mapa', destino: 'Roma', anio: 2027, elegido_en: '2027-05-20T10:00:00Z' };

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

const llamar = async (accion, req) => {
  const res = crearRes();
  await selloController[accion]({ usuario: USUARIO, supabase: {}, params: {}, body: {}, ...req }, res);
  return res;
};

const esperarError = (res, codigo, codigoError) => {
  assert.equal(res.codigo, codigo);
  assert.equal(res.cuerpo.error.codigo, codigoError);
  assert.ok(res.cuerpo.error.mensaje);
};

afterEach(() => mock.restoreAll());

describe('GET /viajes/:viajeId/sello', () => {
  it('devuelve el sello, o null si no hay', async () => {
    mock.method(selloService, 'obtener', async () => ({ estado: 'ok', sello: SELLO }));
    const res = await llamar('obtener', { params: { viajeId: VIAJE_ID } });
    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { sello: SELLO });

    mock.restoreAll();
    mock.method(selloService, 'obtener', async () => ({ estado: 'ok', sello: null }));
    assert.deepEqual((await llamar('obtener', { params: { viajeId: VIAJE_ID } })).cuerpo, { sello: null });
  });

  it('id mal formado 400, viaje inexistente o no miembro 404, fallo 502, excepción 500', async () => {
    esperarError(await llamar('obtener', { params: { viajeId: 'no-uuid' } }), 400, 'datos_invalidos');

    mock.method(selloService, 'obtener', async () => ({ estado: 'no_existe' }));
    esperarError(await llamar('obtener', { params: { viajeId: VIAJE_ID } }), 404, 'viaje_no_encontrado');
    mock.restoreAll();

    mock.method(selloService, 'obtener', async () => ({ error: { code: 'x' } }));
    esperarError(await llamar('obtener', { params: { viajeId: VIAJE_ID } }), 502, 'error_sello');
    mock.restoreAll();

    mock.method(selloService, 'obtener', async () => {
      throw new Error('fallo');
    });
    esperarError(await llamar('obtener', { params: { viajeId: VIAJE_ID } }), 500, 'error_interno');
  });
});

describe('PUT /viajes/:viajeId/sello', () => {
  it('elige o cambia el sello con un diseño válido', async () => {
    const elegir = mock.method(selloService, 'elegir', async () => ({ estado: 'ok', sello: SELLO }));
    const res = await llamar('elegir', { params: { viajeId: VIAJE_ID }, body: { diseno: 'mapa' } });
    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { sello: SELLO });
    assert.deepEqual(elegir.mock.calls[0].arguments.slice(1), [USUARIO.id, VIAJE_ID, 'mapa']);
  });

  it('un diseño que no es uno de los cuatro da 400 diseno_invalido y no llama al servicio', async () => {
    const elegir = mock.method(selloService, 'elegir', async () => ({ estado: 'ok', sello: SELLO }));
    for (const body of [{ diseno: 'corona' }, {}, undefined]) {
      esperarError(await llamar('elegir', { params: { viajeId: VIAJE_ID }, body }), 400, 'diseno_invalido');
    }
    assert.equal(elegir.mock.calls.length, 0);
  });

  it('id mal formado 400, viaje activo 409, inexistente 404, fallo 502', async () => {
    esperarError(await llamar('elegir', { params: { viajeId: 'x' }, body: { diseno: 'mapa' } }), 400, 'datos_invalidos');

    mock.method(selloService, 'elegir', async () => ({ estado: 'no_terminado' }));
    esperarError(await llamar('elegir', { params: { viajeId: VIAJE_ID }, body: { diseno: 'mapa' } }), 409, 'viaje_no_terminado');
    mock.restoreAll();

    mock.method(selloService, 'elegir', async () => ({ estado: 'no_existe' }));
    esperarError(await llamar('elegir', { params: { viajeId: VIAJE_ID }, body: { diseno: 'mapa' } }), 404, 'viaje_no_encontrado');
    mock.restoreAll();

    mock.method(selloService, 'elegir', async () => ({ error: { code: 'x' } }));
    esperarError(await llamar('elegir', { params: { viajeId: VIAJE_ID }, body: { diseno: 'mapa' } }), 502, 'error_sello');
  });
});

describe('DELETE /viajes/:viajeId/sello', () => {
  it('quita el sello y responde 204', async () => {
    mock.method(selloService, 'quitar', async () => ({ estado: 'ok' }));
    assert.equal((await llamar('quitar', { params: { viajeId: VIAJE_ID } })).codigo, 204);
  });

  it('id mal formado 400, viaje activo 409, inexistente 404, fallo 502', async () => {
    esperarError(await llamar('quitar', { params: { viajeId: 'x' } }), 400, 'datos_invalidos');

    mock.method(selloService, 'quitar', async () => ({ estado: 'no_terminado' }));
    esperarError(await llamar('quitar', { params: { viajeId: VIAJE_ID } }), 409, 'viaje_no_terminado');
    mock.restoreAll();

    mock.method(selloService, 'quitar', async () => ({ estado: 'no_existe' }));
    esperarError(await llamar('quitar', { params: { viajeId: VIAJE_ID } }), 404, 'viaje_no_encontrado');
    mock.restoreAll();

    mock.method(selloService, 'quitar', async () => ({ error: { code: 'x' } }));
    esperarError(await llamar('quitar', { params: { viajeId: VIAJE_ID } }), 502, 'error_sello');
  });
});

describe('GET /perfil/sellos', () => {
  it('devuelve los sellos del usuario', async () => {
    mock.method(selloService, 'listarMios', async () => ({ estado: 'ok', sellos: [SELLO] }));
    const res = await llamar('listarMios', {});
    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { sellos: [SELLO] });
  });

});

describe('PATCH /perfil/sellos/:selloId', () => {
  it('cambia el diseño de un sello propio', async () => {
    const cambiar = mock.method(selloService, 'cambiarDiseno', async () => ({ estado: 'ok', sello: { ...SELLO, diseno: 'ruta' } }));
    const res = await llamar('cambiarDiseno', { params: { selloId: SELLO_ID }, body: { diseno: 'ruta' } });
    assert.equal(res.codigo, 200);
    assert.equal(res.cuerpo.sello.diseno, 'ruta');
    assert.deepEqual(cambiar.mock.calls[0].arguments.slice(1), [USUARIO.id, SELLO_ID, 'ruta']);
  });

  it('id mal formado 400 datos_invalidos, diseño no válido 400 diseno_invalido', async () => {
    esperarError(await llamar('cambiarDiseno', { params: { selloId: 'x' }, body: { diseno: 'ruta' } }), 400, 'datos_invalidos');
    esperarError(await llamar('cambiarDiseno', { params: { selloId: SELLO_ID }, body: { diseno: 'corona' } }), 400, 'diseno_invalido');
  });

});

