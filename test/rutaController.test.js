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

  it('devuelve ruta null cuando hay menos de dos actividades con ubicación', async () => {
    simular(async () => ({ estado: 'ok', puntos: [], orden_sugerido: [], ahorro_m: 0, ruta: null }));

    const res = await llamar();

    assert.equal(res.codigo, 200);
    assert.equal(res.cuerpo.ruta, null);
  });

  it('rechaza con 400 un identificador de viaje que no es un UUID', async () => {
    const calcular = simular(async () => ({}));

    const res = await llamar({ viajeId: 'roma' });

    assert.equal(res.codigo, 400);
    assert.equal(res.cuerpo.error.codigo, 'datos_invalidos');
    assert.equal(calcular.mock.callCount(), 0);
  });

  it('rechaza con 400 una fecha ausente, mal escrita o inexistente', async () => {
    const calcular = simular(async () => ({}));

    for (const query of [{}, { fecha: 'hoy' }, { fecha: '2027-02-30' }, { fecha: ['2027-05-12', '2027-05-13'] }]) {
      const res = await llamar({ query });
      assert.equal(res.codigo, 400);
      assert.equal(res.cuerpo.error.mensaje, 'La fecha es obligatoria y debe tener el formato AAAA-MM-DD');
    }
    assert.equal(calcular.mock.callCount(), 0);
  });

  it('responde 404 si el viaje no existe o el usuario no es miembro', async () => {
    simular(async () => ({ estado: 'no_existe' }));

    const res = await llamar();

    assert.equal(res.codigo, 404);
    assert.equal(res.cuerpo.error.codigo, 'viaje_no_encontrado');
  });

  it('responde 400 si hay demasiadas actividades con ubicación', async () => {
    simular(async () => ({ estado: 'demasiados_puntos' }));

    const res = await llamar();

    assert.equal(res.codigo, 400);
    assert.match(res.cuerpo.error.mensaje, /máximo 25/);
  });

  it('responde 422 si no hay camino entre las actividades', async () => {
    simular(async () => ({ estado: 'sin_ruta' }));

    const res = await llamar();

    assert.equal(res.codigo, 422);
    assert.equal(res.cuerpo.error.codigo, 'sin_ruta');
  });

  it('responde 429 si el usuario calcula rutas demasiado rápido o el servicio está ocupado', async () => {
    simular(async () => ({ estado: 'demasiado_rapido' }));
    const rapido = await llamar();
    mock.restoreAll();
    simular(async () => ({ estado: 'ocupado' }));
    const ocupado = await llamar();

    assert.equal(rapido.codigo, 429);
    assert.equal(rapido.cuerpo.error.codigo, 'demasiadas_rutas');
    assert.equal(ocupado.codigo, 429);
    assert.equal(ocupado.cuerpo.error.codigo, 'servicio_ocupado');
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
