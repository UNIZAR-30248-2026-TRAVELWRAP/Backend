const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const rutaService = require('../src/services/rutaService');
const rutaController = require('../src/controllers/rutaController');

const USUARIO = { id: 'df77cba6-4be5-4cbc-814b-1e228dd73dcc' };
const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';

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

const llamar = async ({ viajeId = VIAJE_ID, query = { fecha: '2027-05-12' } } = {}) => {
  const req = { params: { viajeId }, query, usuario: USUARIO, supabase: { cliente: true } };
  const res = crearRes();
  await rutaController.calcular(req, res);
  return res;
};

const simular = (implementacion) => mock.method(rutaService, 'calcular', implementacion);

afterEach(() => mock.restoreAll());

describe('GET /viajes/:viajeId/ruta (calcular)', () => {
  it('devuelve los puntos, el orden sugerido, el ahorro y la ruta', async () => {
    const respuesta = {
      estado: 'ok',
      puntos: [{ id: 'a1', titulo: 'Coliseo', latitud: 41.89, longitud: 12.49 }],
      orden_sugerido: ['a1'],
      ahorro_m: 0,
      ruta: { distancia_m: 800, duracion_s: 600, geometria: [[41.89, 12.49], [41.9, 12.5]] },
    };
    const calcular = simular(async () => respuesta);

    const res = await llamar();

    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, {
      puntos: respuesta.puntos,
      orden_sugerido: respuesta.orden_sugerido,
      ahorro_m: 0,
      ruta: respuesta.ruta,
    });
    assert.deepEqual(calcular.mock.calls[0].arguments, [{ cliente: true }, USUARIO.id, VIAJE_ID, '2027-05-12']);
  });


  it('rechaza con 400 un identificador de viaje que no es un UUID', async () => {
    const calcular = simular(async () => ({}));

    const res = await llamar({ viajeId: 'roma' });

    assert.equal(res.codigo, 400);
    assert.equal(res.cuerpo.error.codigo, 'datos_invalidos');
    assert.equal(calcular.mock.callCount(), 0);
  });


  it('responde 404 si el viaje no existe o el usuario no es miembro', async () => {
    simular(async () => ({ estado: 'no_existe' }));

    const res = await llamar();

    assert.equal(res.codigo, 404);
    assert.equal(res.cuerpo.error.codigo, 'viaje_no_encontrado');
  });




  it('responde 502 si falla el listado o el servicio de rutas', async () => {
    simular(async () => ({ error: { code: 'http_500' } }));

    const res = await llamar();

    assert.equal(res.codigo, 502);
    assert.equal(res.cuerpo.error.codigo, 'error_ruta');
  });

  it('responde 502 con un estado desconocido y 500 si el servicio lanza una excepción', async () => {
    simular(async () => ({ estado: 'raro' }));
    const desconocido = await llamar();
    mock.restoreAll();
    simular(async () => {
      throw new Error('boom');
    });
    const excepcion = await llamar();

    assert.equal(desconocido.codigo, 502);
    assert.equal(excepcion.codigo, 500);
    assert.equal(excepcion.cuerpo.error.codigo, 'error_interno');
  });
});
