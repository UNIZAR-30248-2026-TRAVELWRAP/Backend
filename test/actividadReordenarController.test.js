const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const actividadService = require('../src/services/actividadService');
const actividadController = require('../src/controllers/actividadController');

const USUARIO = { id: 'df77cba6-4be5-4cbc-814b-1e228dd73dcc' };
const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const A = '8a1b2c3d-0000-4000-8000-000000000001';
const B = '8a1b2c3d-0000-4000-8000-000000000002';

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

const llamar = async ({ viajeId = VIAJE_ID, body = { fecha: '2027-05-12', actividades: [A, B] } } = {}) => {
  const req = { params: { viajeId }, body, usuario: USUARIO, supabase: { cliente: true } };
  const res = crearRes();
  await actividadController.reordenar(req, res);
  return res;
};

const simular = (implementacion) => mock.method(actividadService, 'reordenar', implementacion);

afterEach(() => mock.restoreAll());

describe('PUT /viajes/:viajeId/actividades/orden (reordenar)', () => {

  it('acepta los identificadores en mayúsculas y los pasa en minúsculas', async () => {
    const reordenar = simular(async () => ({ estado: 'ok', actividades: [] }));

    await llamar({ body: { fecha: '2027-05-12', actividades: [A.toUpperCase(), B] } });

    assert.deepEqual(reordenar.mock.calls[0].arguments[4], [A, B]);
  });

  it('rechaza con 400 un identificador de viaje que no es un UUID', async () => {
    const reordenar = simular(async () => ({}));

    const res = await llamar({ viajeId: 'roma' });

    assert.equal(res.codigo, 400);
    assert.equal(res.cuerpo.error.mensaje, 'El identificador del viaje no es válido');
    assert.equal(reordenar.mock.callCount(), 0);
  });

  it('rechaza con 400 una fecha ausente, mal escrita o inexistente', async () => {
    const reordenar = simular(async () => ({}));

    for (const fecha of [undefined, 'hoy', '2027-02-30', 20270512]) {
      const res = await llamar({ body: { fecha, actividades: [A] } });
      assert.equal(res.codigo, 400);
      assert.equal(res.cuerpo.error.mensaje, 'La fecha es obligatoria y debe tener el formato AAAA-MM-DD');
    }
    assert.equal(reordenar.mock.callCount(), 0);
  });

  it('rechaza con 400 un cuerpo vacío', async () => {
    simular(async () => ({}));

    const res = await llamar({ body: null });

    assert.equal(res.codigo, 400);
    assert.equal(res.cuerpo.error.codigo, 'datos_invalidos');
  });



  it('responde 404 si el viaje no existe o el usuario no es miembro', async () => {
    simular(async () => ({ estado: 'no_existe' }));

    const res = await llamar();

    assert.equal(res.codigo, 404);
    assert.equal(res.cuerpo.error.codigo, 'viaje_no_encontrado');
  });




  it('responde 502 si falla el servicio y 500 si lanza una excepción', async () => {
    simular(async () => ({ error: { code: 'XX' } }));
    const fallo = await llamar();
    mock.restoreAll();
    simular(async () => {
      throw new Error('boom');
    });
    const excepcion = await llamar();

    assert.equal(fallo.codigo, 502);
    assert.equal(fallo.cuerpo.error.codigo, 'error_actividad');
    assert.equal(excepcion.codigo, 500);
    assert.equal(excepcion.cuerpo.error.codigo, 'error_interno');
  });
});
