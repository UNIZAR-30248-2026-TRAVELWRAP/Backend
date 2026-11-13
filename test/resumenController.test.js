const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const resumenService = require('../src/services/resumenService');
const resumenController = require('../src/controllers/resumenController');

const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const USUARIO = { id: 'df77cba6-4be5-4cbc-814b-1e228dd73dcc' };

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

const llamar = async (viajeId = VIAJE_ID) => {
  const res = crearRes();
  await resumenController.obtener({ params: { viajeId }, usuario: USUARIO, supabase: {} }, res);
  return res;
};

const esperarError = (res, codigo, codigoError) => {
  assert.equal(res.codigo, codigo);
  assert.equal(res.cuerpo.error.codigo, codigoError);
  assert.ok(res.cuerpo.error.mensaje);
};

afterEach(() => mock.restoreAll());

describe('GET /viajes/:viajeId/resumen', () => {
  it('devuelve 200 con el resumen', async () => {
    const resumen = { dias: 4, gasto_total: 850, gasto_mayor: null, actividad_mas_votada: null };
    const obtener = mock.method(resumenService, 'obtener', async () => ({ estado: 'ok', resumen }));

    const res = await llamar();

    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, resumen);
    const [, usuarioId, viajeId] = obtener.mock.calls[0].arguments;
    assert.equal(usuarioId, USUARIO.id);
    assert.equal(viajeId, VIAJE_ID);
  });

  it('devuelve 400 si el identificador del viaje no es un UUID', async () => {
    const obtener = mock.method(resumenService, 'obtener', async () => ({ estado: 'ok', resumen: {} }));
    esperarError(await llamar('roma'), 400, 'datos_invalidos');
    assert.equal(obtener.mock.callCount(), 0);
  });

  it('devuelve 404 si el viaje no existe o no pertenece al usuario', async () => {
    mock.method(resumenService, 'obtener', async () => ({ estado: 'no_existe' }));
    esperarError(await llamar(), 404, 'viaje_no_encontrado');
  });

  it('devuelve 502 si Supabase falla', async () => {
    mock.method(resumenService, 'obtener', async () => ({ error: { code: 'XX000' } }));
    esperarError(await llamar(), 502, 'error_resumen');
  });

  it('devuelve 500 si el servicio lanza una excepción', async () => {
    mock.method(resumenService, 'obtener', async () => {
      throw new Error('fallo');
    });
    esperarError(await llamar(), 500, 'error_interno');
  });
});
