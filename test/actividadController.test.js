const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const actividadService = require('../src/services/actividadService');
const actividadController = require('../src/controllers/actividadController');

const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const USUARIO = { id: 'df77cba6-4be5-4cbc-814b-1e228dd73dcc' };
const MENSAJE_TITULO = 'El título es obligatorio y tiene un máximo de 200 caracteres';
const MENSAJE_FECHA = 'La fecha es obligatoria y debe tener el formato AAAA-MM-DD';
const MENSAJE_HORA = 'La hora debe tener el formato HH:MM';
const MENSAJE_UBICACION = 'La ubicación debe ser un texto de 200 caracteres como máximo';

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

const llamar = async ({ viajeId = VIAJE_ID, body } = {}) => {
  const req = { params: { viajeId }, body, usuario: USUARIO, supabase: {} };
  const res = crearRes();
  await actividadController.crear(req, res);
  return res;
};

const simular = (implementacion) => mock.method(actividadService, 'crear', implementacion);

afterEach(() => mock.restoreAll());

describe('POST /viajes/:viajeId/actividades (crear)', () => {
  it('envía al servicio los datos ya limpios y devuelve la actividad con 201', async () => {
    const crear = simular(async () => ({ estado: 'ok', actividad: { id: 'a1', titulo: 'Coliseo' } }));

    const res = await llamar({
      body: { titulo: '  Coliseo ', fecha: '2027-05-12', hora_inicio: '10:00', ubicacion_nombre: ' Piazza ', orden: 9 },
    });

    assert.equal(res.codigo, 201);
    assert.deepEqual(res.cuerpo, { id: 'a1', titulo: 'Coliseo' });
    const [, usuarioId, viajeId, datos] = crear.mock.calls[0].arguments;
    assert.equal(usuarioId, USUARIO.id);
    assert.equal(viajeId, VIAJE_ID);
    assert.deepEqual(datos, {
      titulo: 'Coliseo',
      fecha: '2027-05-12',
      hora_inicio: '10:00',
      ubicacion_nombre: 'Piazza',
    });
  });

  it('acepta solo título y fecha y deja la hora y la ubicación en null', async () => {
    const crear = simular(async () => ({ estado: 'ok', actividad: {} }));

    const res = await llamar({ body: { titulo: 'Paseo', fecha: '2027-05-12', hora_inicio: '', ubicacion_nombre: null } });

    assert.equal(res.codigo, 201);
    assert.deepEqual(crear.mock.calls[0].arguments[3], {
      titulo: 'Paseo',
      fecha: '2027-05-12',
      hora_inicio: null,
      ubicacion_nombre: null,
    });
  });

  const invalidos = [
    ['sin cuerpo', undefined, MENSAJE_TITULO],
    ['título vacío', { titulo: '   ', fecha: '2027-05-12' }, MENSAJE_TITULO],
    ['título demasiado largo', { titulo: 'a'.repeat(201), fecha: '2027-05-12' }, MENSAJE_TITULO],
    ['sin fecha', { titulo: 'Paseo' }, MENSAJE_FECHA],
    ['fecha mal formada', { titulo: 'Paseo', fecha: '12/05/2027' }, MENSAJE_FECHA],
    ['fecha inexistente', { titulo: 'Paseo', fecha: '2027-02-30' }, MENSAJE_FECHA],
    ['hora mal formada', { titulo: 'Paseo', fecha: '2027-05-12', hora_inicio: '25:00' }, MENSAJE_HORA],
    ['hora como número', { titulo: 'Paseo', fecha: '2027-05-12', hora_inicio: 10 }, MENSAJE_HORA],
    ['ubicación como número', { titulo: 'Paseo', fecha: '2027-05-12', ubicacion_nombre: 5 }, MENSAJE_UBICACION],
    [
      'ubicación demasiado larga',
      { titulo: 'Paseo', fecha: '2027-05-12', ubicacion_nombre: 'a'.repeat(201) },
      MENSAJE_UBICACION,
    ],
  ];
  for (const [caso, body, mensaje] of invalidos) {
    it(`rechaza con 400 ${caso} sin llamar al servicio`, async () => {
      const crear = simular(async () => ({ estado: 'ok' }));

      const res = await llamar({ body });

      assert.equal(res.codigo, 400);
      assert.deepEqual(res.cuerpo, { error: { codigo: 'datos_invalidos', mensaje } });
      assert.equal(crear.mock.callCount(), 0);
    });
  }

  it('rechaza un identificador de viaje que no es un UUID', async () => {
    const res = await llamar({ viajeId: 'roma-2027', body: { titulo: 'Paseo', fecha: '2027-05-12' } });

    assert.equal(res.codigo, 400);
    assert.equal(res.cuerpo.error.mensaje, 'El identificador del viaje no es válido');
  });

  const motivos = [
    ['no_existe', 404, 'viaje_no_encontrado'],
    ['no_activo', 409, 'viaje_no_activo'],
  ];
  for (const [estado, codigoHttp, codigo] of motivos) {
    it(`responde ${codigoHttp} ${codigo} si el servicio dice ${estado}`, async () => {
      simular(async () => ({ estado }));

      const res = await llamar({ body: { titulo: 'Paseo', fecha: '2027-05-12' } });

      assert.equal(res.codigo, codigoHttp);
      assert.equal(res.cuerpo.error.codigo, codigo);
    });
  }

  it('responde 400 si la base de datos incumple un check', async () => {
    simular(async () => ({ error: { code: '23514' } }));

    const res = await llamar({ body: { titulo: 'Paseo', fecha: '2027-05-12' } });

    assert.equal(res.codigo, 400);
    assert.equal(res.cuerpo.error.codigo, 'datos_invalidos');
  });

  it('responde 502 si falla la base de datos', async () => {
    simular(async () => ({ error: { code: 'XX000' } }));

    const res = await llamar({ body: { titulo: 'Paseo', fecha: '2027-05-12' } });

    assert.equal(res.codigo, 502);
    assert.equal(res.cuerpo.error.codigo, 'error_actividad');
  });

  it('responde 500 si el servicio lanza una excepción', async () => {
    simular(async () => {
      throw new Error('caída');
    });

    const res = await llamar({ body: { titulo: 'Paseo', fecha: '2027-05-12' } });

    assert.equal(res.codigo, 500);
    assert.equal(res.cuerpo.error.codigo, 'error_interno');
  });
});

const llamarListar = async ({ viajeId = VIAJE_ID, query = {} } = {}) => {
  const req = { params: { viajeId }, query, usuario: USUARIO, supabase: {} };
  const res = crearRes();
  await actividadController.listar(req, res);
  return res;
};

const simularListar = (implementacion) => mock.method(actividadService, 'listar', implementacion);

describe('GET /viajes/:viajeId/actividades (listar)', () => {
  it('devuelve las actividades del viaje con 200', async () => {
    const listar = simularListar(async () => ({ estado: 'ok', actividades: [{ id: 'a1' }, { id: 'a2' }] }));

    const res = await llamarListar();

    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { actividades: [{ id: 'a1' }, { id: 'a2' }] });
    const [, usuarioId, viajeId, fecha] = listar.mock.calls[0].arguments;
    assert.equal(usuarioId, USUARIO.id);
    assert.equal(viajeId, VIAJE_ID);
    assert.equal(fecha, undefined);
  });

  it('pasa al servicio la fecha pedida para listar un solo día', async () => {
    const listar = simularListar(async () => ({ estado: 'ok', actividades: [] }));

    const res = await llamarListar({ query: { fecha: '2027-05-12' } });

    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { actividades: [] });
    assert.equal(listar.mock.calls[0].arguments[3], '2027-05-12');
  });

  const invalidos = [
    ['fecha mal formada', { fecha: '12/05/2027' }],
    ['fecha inexistente', { fecha: '2027-02-30' }],
    ['fecha repetida', { fecha: ['2027-05-12', '2027-05-13'] }],
  ];
  for (const [caso, query] of invalidos) {
    it(`rechaza con 400 ${caso} sin llamar al servicio`, async () => {
      const listar = simularListar(async () => ({ estado: 'ok', actividades: [] }));

      const res = await llamarListar({ query });

      assert.equal(res.codigo, 400);
      assert.deepEqual(res.cuerpo, {
        error: { codigo: 'datos_invalidos', mensaje: 'La fecha debe tener el formato AAAA-MM-DD' },
      });
      assert.equal(listar.mock.callCount(), 0);
    });
  }

  it('rechaza un identificador de viaje que no es un UUID', async () => {
    const res = await llamarListar({ viajeId: 'roma-2027' });

    assert.equal(res.codigo, 400);
    assert.equal(res.cuerpo.error.mensaje, 'El identificador del viaje no es válido');
  });

  it('responde 404 viaje_no_encontrado si el viaje no existe o no es miembro', async () => {
    simularListar(async () => ({ estado: 'no_existe' }));

    const res = await llamarListar();

    assert.equal(res.codigo, 404);
    assert.equal(res.cuerpo.error.codigo, 'viaje_no_encontrado');
  });

  it('responde 502 si falla la base de datos', async () => {
    simularListar(async () => ({ error: { code: 'XX000' } }));

    const res = await llamarListar();

    assert.equal(res.codigo, 502);
    assert.equal(res.cuerpo.error.codigo, 'error_actividad');
  });

  it('responde 500 si el servicio lanza una excepción', async () => {
    simularListar(async () => {
      throw new Error('caída');
    });

    const res = await llamarListar();

    assert.equal(res.codigo, 500);
    assert.equal(res.cuerpo.error.codigo, 'error_interno');
  });
});
