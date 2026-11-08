const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const actividadService = require('../src/services/actividadService');
const actividadController = require('../src/controllers/actividadController');

const USUARIO = { id: 'df77cba6-4be5-4cbc-814b-1e228dd73dcc' };
const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const A = '8a1b2c3d-0000-4000-8000-000000000001';
const B = '8a1b2c3d-0000-4000-8000-000000000002';
const C = '8a1b2c3d-0000-4000-8000-000000000003';

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
  it('guarda el orden y devuelve las actividades del día en su nuevo orden', async () => {
    const actividades = [{ id: B, orden: 0 }, { id: A, orden: 1 }];
    const reordenar = simular(async () => ({ estado: 'ok', actividades }));

    const res = await llamar({ body: { fecha: '2027-05-12', actividades: [B, A] } });

    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { actividades });
    assert.deepEqual(reordenar.mock.calls[0].arguments, [{ cliente: true }, USUARIO.id, VIAJE_ID, '2027-05-12', [B, A]]);
  });

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

  it('rechaza con 400 una lista de actividades ausente, vacía, con valores que no son UUID o demasiado larga', async () => {
    const reordenar = simular(async () => ({}));
    const demasiadas = Array.from({ length: 201 }, (_, i) => `8a1b2c3d-0000-4000-8000-${String(i).padStart(12, '0')}`);

    for (const actividades of [undefined, [], 'a', [A, 'roma'], [A, 7], demasiadas]) {
      const res = await llamar({ body: { fecha: '2027-05-12', actividades } });
      assert.equal(res.codigo, 400);
      assert.match(res.cuerpo.error.mensaje, /lista de identificadores/);
    }
    assert.equal(reordenar.mock.callCount(), 0);
  });

  it('rechaza con 400 una lista con identificadores repetidos', async () => {
    const reordenar = simular(async () => ({}));

    const res = await llamar({ body: { fecha: '2027-05-12', actividades: [A, B, A.toUpperCase()] } });

    assert.equal(res.codigo, 400);
    assert.match(res.cuerpo.error.mensaje, /repetir/);
    assert.equal(reordenar.mock.callCount(), 0);
  });

  it('responde 404 si el viaje no existe o el usuario no es miembro', async () => {
    simular(async () => ({ estado: 'no_existe' }));

    const res = await llamar();

    assert.equal(res.codigo, 404);
    assert.equal(res.cuerpo.error.codigo, 'viaje_no_encontrado');
  });

  it('responde 409 si el viaje está finalizado', async () => {
    simular(async () => ({ estado: 'no_activo' }));

    const res = await llamar();

    assert.equal(res.codigo, 409);
    assert.equal(res.cuerpo.error.codigo, 'viaje_no_activo');
  });

  it('responde 409 si la agenda del día ha cambiado desde que se pidió', async () => {
    simular(async () => ({ estado: 'agenda_cambiada' }));

    const res = await llamar({ body: { fecha: '2027-05-12', actividades: [A, B, C] } });

    assert.equal(res.codigo, 409);
    assert.equal(res.cuerpo.error.codigo, 'agenda_cambiada');
  });

  it('responde 400 si las actividades con hora no quedan ordenadas por su hora', async () => {
    simular(async () => ({ estado: 'orden_no_valido' }));

    const res = await llamar();

    assert.equal(res.codigo, 400);
    assert.equal(res.cuerpo.error.codigo, 'orden_no_valido');
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
