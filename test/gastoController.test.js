// Pruebas del controlador de gastos (POST /api/viajes/:viajeId/gastos).
// El servicio se sustituye por un mock: aquí solo comprobamos la validación de los datos
// de entrada y la traducción de cada resultado del servicio a su código HTTP.
const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const gastoService = require('../src/services/gastoService');
const gastoController = require('../src/controllers/gastoController');

// Identificadores de ejemplo y mensajes de error que devuelve la validación
const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const ADRIANA = 'df77cba6-4be5-4cbc-814b-1e228dd73dcc';
const BERTA = '5b1f0c2e-8a7d-4c3b-9e6f-2d4a1b3c5e7f';
const USUARIO = { id: ADRIANA };
const MENSAJE_CONCEPTO = 'El concepto es obligatorio y tiene un máximo de 100 caracteres';
const MENSAJE_IMPORTE = 'El importe debe ser un número mayor que 0 con dos decimales como máximo';
const MENSAJE_CATEGORIA = 'La categoría debe ser comida, transporte, entradas, alojamiento, ocio u otros';
const MENSAJE_PAGADOR = 'Indica qué miembro del viaje ha pagado el gasto';
const MENSAJE_FECHA = 'La fecha debe tener el formato AAAA-MM-DD';
const MENSAJE_PARTICIPANTES = 'Indica al menos un miembro del viaje entre los que se divide el gasto';

// Gasto válido mínimo: cada caso inválido parte de él y cambia un solo campo
const GASTO = { concepto: 'Cena', importe: 60, pagado_por: ADRIANA, participantes: [ADRIANA, BERTA] };

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
});

// Llama al controlador como lo haría Express tras pasar por requiereSesion
const llamar = async ({ viajeId = VIAJE_ID, body } = {}) => {
  const req = { params: { viajeId }, body, usuario: USUARIO, supabase: {} };
  const res = crearRes();
  await gastoController.crear(req, res);
  return res;
};

// Sustituye gastoService.crear y permite comprobar con qué datos se ha llamado
const simular = (implementacion) => mock.method(gastoService, 'crear', implementacion);

// Comprueba el código HTTP y el formato { error: { codigo, mensaje } } de la respuesta
const esperarError = (res, codigo, codigoError, mensaje) => {
  assert.equal(res.codigo, codigo);
  assert.equal(res.cuerpo.error.codigo, codigoError);
  if (mensaje) assert.equal(res.cuerpo.error.mensaje, mensaje);
};

// Cada prueba empieza con el servicio original
afterEach(() => mock.restoreAll());

describe('POST /viajes/:viajeId/gastos (crear)', () => {
  // Caso correcto: espacios recortados, UUID en minúsculas y campos no permitidos (creado_por) descartados
  it('envía al servicio los datos ya limpios y devuelve el gasto con 201', async () => {
    const gasto = { id: 'g1', concepto: 'Cena', importe: 60, repartos: [] };
    const crear = simular(async () => ({ estado: 'ok', gasto }));

    const res = await llamar({
      body: {
        concepto: '  Cena en el Trastevere ',
        importe: 60.5,
        categoria: 'comida',
        pagado_por: ADRIANA.toUpperCase(),
        fecha: '2027-05-12',
        participantes: [ADRIANA, BERTA.toUpperCase()],
        creado_por: BERTA,
      },
    });

    assert.equal(res.codigo, 201);
    assert.deepEqual(res.cuerpo, gasto);
    const [, viajeId, datos] = crear.mock.calls[0].arguments;
    assert.equal(viajeId, VIAJE_ID);
    assert.deepEqual(datos, {
      concepto: 'Cena en el Trastevere',
      importe: 60.5,
      categoria: 'comida',
      pagado_por: ADRIANA,
      fecha: '2027-05-12',
      participantes: [ADRIANA, BERTA],
    });
  });

  it('deja la categoría y la fecha en null si no se envían o están vacías', async () => {
    const crear = simular(async () => ({ estado: 'ok', gasto: {} }));

    const res = await llamar({ body: { ...GASTO, categoria: '', fecha: null } });

    assert.equal(res.codigo, 201);
    const datos = crear.mock.calls[0].arguments[2];
    assert.equal(datos.categoria, null);
    assert.equal(datos.fecha, null);
  });

  it('redondea el importe a céntimos sin errores de coma flotante', async () => {
    const crear = simular(async () => ({ estado: 'ok', gasto: {} }));

    await llamar({ body: { ...GASTO, importe: 0.1 + 0.2 } });

    assert.equal(crear.mock.calls[0].arguments[2].importe, 0.3);
  });

  // Validación de la ruta
  it('rechaza un identificador de viaje que no es un UUID sin llamar al servicio', async () => {
    const crear = simular(async () => ({ estado: 'ok', gasto: {} }));

    const res = await llamar({ viajeId: 'abc', body: GASTO });

    esperarError(res, 400, 'datos_invalidos', 'El identificador del viaje no es válido');
    assert.equal(crear.mock.callCount(), 0);
  });

  // Validación del cuerpo: [caso, cuerpo enviado, mensaje esperado]. Ninguno debe llegar al servicio
  const casosInvalidos = [
    ['sin cuerpo', undefined, MENSAJE_CONCEPTO],
    ['concepto vacío', { ...GASTO, concepto: '   ' }, MENSAJE_CONCEPTO],
    ['concepto de más de 100 caracteres', { ...GASTO, concepto: 'x'.repeat(101) }, MENSAJE_CONCEPTO],
    ['importe que no es un número', { ...GASTO, importe: '60' }, MENSAJE_IMPORTE],
    ['importe 0', { ...GASTO, importe: 0 }, MENSAJE_IMPORTE],
    ['importe negativo', { ...GASTO, importe: -5 }, MENSAJE_IMPORTE],
    ['importe con tres decimales', { ...GASTO, importe: 10.123 }, MENSAJE_IMPORTE],
    ['importe demasiado grande', { ...GASTO, importe: 1e10 }, MENSAJE_IMPORTE],
    ['importe infinito', { ...GASTO, importe: Infinity }, MENSAJE_IMPORTE],
    ['categoría desconocida', { ...GASTO, categoria: 'cultura' }, MENSAJE_CATEGORIA],
    ['categoría que no es un texto', { ...GASTO, categoria: 3 }, MENSAJE_CATEGORIA],
    ['sin quién pagó', { ...GASTO, pagado_por: undefined }, MENSAJE_PAGADOR],
    ['pagador que no es un UUID', { ...GASTO, pagado_por: 'adriana' }, MENSAJE_PAGADOR],
    ['fecha con otro formato', { ...GASTO, fecha: '12/05/2027' }, MENSAJE_FECHA],
    ['fecha que no existe', { ...GASTO, fecha: '2027-02-30' }, MENSAJE_FECHA],
    ['sin participantes', { ...GASTO, participantes: [] }, MENSAJE_PARTICIPANTES],
    ['participantes que no son una lista', { ...GASTO, participantes: ADRIANA }, MENSAJE_PARTICIPANTES],
    ['un participante que no es un UUID', { ...GASTO, participantes: [ADRIANA, 'berta'] }, MENSAJE_PARTICIPANTES],
    ['un participante repetido', { ...GASTO, participantes: [ADRIANA, ADRIANA.toUpperCase()] },
      'Cada miembro solo puede aparecer una vez en el reparto'],
  ];

  for (const [caso, body, mensaje] of casosInvalidos) {
    it(`rechaza ${caso} con 400 sin llamar al servicio`, async () => {
      const crear = simular(async () => ({ estado: 'ok', gasto: {} }));

      const res = await llamar({ body });

      esperarError(res, 400, 'datos_invalidos', mensaje);
      assert.equal(crear.mock.callCount(), 0);
    });
  }

  // Estados que devuelve el servicio (función crear_gasto) y respuesta HTTP de cada uno
  const motivos = [
    ['no_existe', 404, 'viaje_no_encontrado'],
    ['no_activo', 409, 'viaje_no_activo'],
    ['no_miembro', 400, 'datos_invalidos'],
    ['desconocido', 502, 'error_gasto'],
  ];

  for (const [estado, codigo, codigoError] of motivos) {
    it(`responde ${codigo} cuando el servicio devuelve ${estado}`, async () => {
      simular(async () => ({ estado }));

      const res = await llamar({ body: GASTO });

      esperarError(res, codigo, codigoError);
    });
  }

  // Errores de la base de datos y excepciones
  it('responde 400 si la base de datos rechaza los datos por un check', async () => {
    simular(async () => ({ error: { code: '23514' } }));

    const res = await llamar({ body: GASTO });

    esperarError(res, 400, 'datos_invalidos', 'Los datos del gasto no son válidos');
  });

  it('responde 502 si falla la base de datos', async () => {
    simular(async () => ({ error: { code: 'PGRST301' } }));

    const res = await llamar({ body: GASTO });

    esperarError(res, 502, 'error_gasto', 'No se ha podido registrar el gasto');
  });

  it('responde 500 si el servicio lanza una excepción', async () => {
    simular(async () => {
      throw new Error('sin red');
    });

    const res = await llamar({ body: GASTO });

    esperarError(res, 500, 'error_interno');
  });
});

// Historial

// Llama a GET /viajes/:viajeId/gastos como lo haría Express tras pasar por requiereSesion
const llamarListar = async ({ viajeId = VIAJE_ID } = {}) => {
  const req = { params: { viajeId }, usuario: USUARIO, supabase: {} };
  const res = crearRes();
  await gastoController.listar(req, res);
  return res;
};

const simularListar = (implementacion) => mock.method(gastoService, 'listar', implementacion);

describe('GET /viajes/:viajeId/gastos (listar)', () => {
  it('devuelve los gastos y el total con 200', async () => {
    const gastos = [{ id: 'g2', concepto: 'Taxi', importe: 35 }, { id: 'g1', concepto: 'Cena', importe: 60.5 }];
    const listar = simularListar(async () => ({ estado: 'ok', gastos, total: 95.5 }));

    const res = await llamarListar();

    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { gastos, total: 95.5 });
    const [, usuarioId, viajeId] = listar.mock.calls[0].arguments;
    assert.equal(usuarioId, ADRIANA);
    assert.equal(viajeId, VIAJE_ID);
  });

  it('devuelve una lista vacía y total 0 si el viaje no tiene gastos', async () => {
    simularListar(async () => ({ estado: 'ok', gastos: [], total: 0 }));

    const res = await llamarListar();

    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { gastos: [], total: 0 });
  });

  it('rechaza un identificador de viaje que no es un UUID sin llamar al servicio', async () => {
    const listar = simularListar(async () => ({ estado: 'ok', gastos: [], total: 0 }));

    const res = await llamarListar({ viajeId: 'roma-2027' });

    esperarError(res, 400, 'datos_invalidos', 'El identificador del viaje no es válido');
    assert.equal(listar.mock.callCount(), 0);
  });

  it('responde 404 si el viaje no existe o no se es miembro', async () => {
    simularListar(async () => ({ estado: 'no_existe' }));

    const res = await llamarListar();

    esperarError(res, 404, 'viaje_no_encontrado', 'El viaje no existe o no perteneces a él');
  });

  it('responde 502 si falla la base de datos', async () => {
    simularListar(async () => ({ error: { code: 'PGRST301' } }));

    const res = await llamarListar();

    esperarError(res, 502, 'error_gasto', 'No se han podido obtener los gastos');
  });

  it('responde 502 ante un estado desconocido del servicio', async () => {
    simularListar(async () => ({ estado: 'desconocido' }));

    const res = await llamarListar();

    esperarError(res, 502, 'error_gasto', 'No se han podido obtener los gastos');
  });

  it('responde 500 si el servicio lanza una excepción', async () => {
    simularListar(async () => {
      throw new Error('sin red');
    });

    const res = await llamarListar();

    esperarError(res, 500, 'error_interno');
  });
});
