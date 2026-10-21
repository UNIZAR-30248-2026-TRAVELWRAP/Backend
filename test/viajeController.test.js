const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const viajeService = require('../src/services/viajeService');
const viajeController = require('../src/controllers/viajeController');

const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const USUARIO = { id: 'df77cba6-4be5-4cbc-814b-1e228dd73dcc' };

// Respuesta de express falsa que guarda el código y el cuerpo
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

const llamar = async (accion, { viajeId = VIAJE_ID, body } = {}) => {
  const req = { params: { viajeId }, body, usuario: USUARIO, supabase: {} };
  const res = crearRes();
  await viajeController[accion](req, res);
  return res;
};

const simular = (metodo, implementacion) => mock.method(viajeService, metodo, implementacion);

afterEach(() => mock.restoreAll());

describe('PATCH /viajes/:viajeId (editar)', () => {
  it('envía al servicio solo los campos editables, ya limpios, y devuelve el viaje', async () => {
    const editar = simular('editar', async () => ({ estado: 'ok', viaje: { id: VIAJE_ID, nombre: 'Roma 2028' } }));

    const res = await llamar('editar', {
      body: { nombre: '  Roma 2028 ', presupuesto: 950, fecha_inicio: '', estado: 'archivado', id: 'otro' },
    });

    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { id: VIAJE_ID, nombre: 'Roma 2028' });
    const [, usuarioId, viajeId, cambios] = editar.mock.calls[0].arguments;
    assert.equal(usuarioId, USUARIO.id);
    assert.equal(viajeId, VIAJE_ID);
    assert.deepEqual(cambios, { nombre: 'Roma 2028', presupuesto: 950, fecha_inicio: null });
  });

  const invalidos = [
    ['sin datos', {}, 'Indica al menos un dato del viaje que cambiar'],
    ['sin cuerpo', undefined, 'Indica al menos un dato del viaje que cambiar'],
    ['solo campos desconocidos', { estado: 'archivado' }, 'Indica al menos un dato del viaje que cambiar'],
    ['nombre vacío', { nombre: '   ' }, 'El nombre es obligatorio y tiene un máximo de 100 caracteres'],
    ['presupuesto negativo', { presupuesto: -1 }, 'El presupuesto es obligatorio y debe ser un número entre 0 y 9999999999'],
    ['presupuesto como texto', { presupuesto: '900' }, 'El presupuesto es obligatorio y debe ser un número entre 0 y 9999999999'],
    ['destino vacío', { destino: '' }, 'El destino no puede quedar vacío'],
    ['destino null', { destino: null }, 'El destino no puede quedar vacío'],
    ['fecha mal formada', { fecha_fin: '15/05/2027' }, 'Las fechas deben tener el formato AAAA-MM-DD'],
    ['fechas invertidas', { fecha_inicio: '2027-05-15', fecha_fin: '2027-05-12' }, 'La fecha de fin no puede ser anterior a la de inicio'],
  ];
  for (const [caso, body, mensaje] of invalidos) {
    it(`rechaza con 400 ${caso} sin llamar al servicio`, async () => {
      const editar = simular('editar', async () => ({ estado: 'ok' }));

      const res = await llamar('editar', { body });

      assert.equal(res.codigo, 400);
      assert.deepEqual(res.cuerpo, { error: { codigo: 'datos_invalidos', mensaje } });
      assert.equal(editar.mock.callCount(), 0);
    });
  }

  it('rechaza un identificador que no es un UUID', async () => {
    const res = await llamar('editar', { viajeId: 'roma-2025', body: { nombre: 'X' } });

    assert.equal(res.codigo, 400);
    assert.equal(res.cuerpo.error.mensaje, 'El identificador del viaje no es válido');
  });

  const motivos = [
    ['no_existe', 404, 'viaje_no_encontrado'],
    ['no_creador', 403, 'no_creador'],
    ['no_activo', 409, 'viaje_no_activo'],
  ];
  for (const [estado, codigoHttp, codigo] of motivos) {
    it(`responde ${codigoHttp} ${codigo} si el servicio dice ${estado}`, async () => {
      simular('editar', async () => ({ estado }));

      const res = await llamar('editar', { body: { nombre: 'X' } });

      assert.equal(res.codigo, codigoHttp);
      assert.equal(res.cuerpo.error.codigo, codigo);
    });
  }

  it('traduce el CHECK de fechas de la base de datos a un 400', async () => {
    simular('editar', async () => ({ error: { code: '23514' } }));

    const res = await llamar('editar', { body: { fecha_fin: '2027-05-01' } });

    assert.equal(res.codigo, 400);
    assert.equal(res.cuerpo.error.mensaje, 'La fecha de fin no puede ser anterior a la de inicio');
  });

  it('responde 502 si falla Supabase y 500 si algo revienta', async () => {
    simular('editar', async () => ({ error: { code: 'PGRST000' } }));
    assert.equal((await llamar('editar', { body: { nombre: 'X' } })).codigo, 502);

    mock.restoreAll();
    simular('editar', async () => {
      throw new Error('boom');
    });
    assert.equal((await llamar('editar', { body: { nombre: 'X' } })).codigo, 500);
  });
});

describe('POST /viajes/:viajeId/archivar', () => {
  it('devuelve el viaje archivado', async () => {
    const archivar = simular('archivar', async () => ({ estado: 'ok', viaje: { id: VIAJE_ID, estado: 'archivado' } }));

    const res = await llamar('archivar');

    assert.equal(res.codigo, 200);
    assert.equal(res.cuerpo.estado, 'archivado');
    assert.deepEqual(archivar.mock.calls[0].arguments.slice(1), [USUARIO.id, VIAJE_ID]);
  });

  it('responde 409 si ya estaba archivado y 403 si no es el creador', async () => {
    simular('archivar', async () => ({ estado: 'ya_archivado' }));
    const yaArchivado = await llamar('archivar');
    assert.equal(yaArchivado.codigo, 409);
    assert.equal(yaArchivado.cuerpo.error.codigo, 'viaje_archivado');

    mock.restoreAll();
    simular('archivar', async () => ({ estado: 'no_creador' }));
    assert.equal((await llamar('archivar')).codigo, 403);
  });

  it('rechaza un identificador inválido y responde 502 si falla Supabase', async () => {
    assert.equal((await llamar('archivar', { viajeId: 'x' })).codigo, 400);

    simular('archivar', async () => ({ error: { code: 'PGRST000' } }));
    const res = await llamar('archivar');
    assert.equal(res.codigo, 502);
    assert.equal(res.cuerpo.error.mensaje, 'No se ha podido archivar el viaje');
  });
});

describe('DELETE /viajes/:viajeId', () => {
  it('responde 204 sin cuerpo al eliminar', async () => {
    simular('eliminar', async () => ({ estado: 'ok' }));

    const res = await llamar('eliminar');

    assert.equal(res.codigo, 204);
    assert.equal(res.cuerpo, undefined);
  });

  it('responde 409 si el viaje no está archivado y 404 si no existe', async () => {
    simular('eliminar', async () => ({ estado: 'no_archivado' }));
    const noArchivado = await llamar('eliminar');
    assert.equal(noArchivado.codigo, 409);
    assert.equal(noArchivado.cuerpo.error.mensaje, 'Solo se pueden eliminar viajes archivados');

    mock.restoreAll();
    simular('eliminar', async () => ({ estado: 'no_existe' }));
    assert.equal((await llamar('eliminar')).codigo, 404);
  });
});

describe('POST /viajes (crear) tras separar los validadores', () => {
  it('mantiene las mismas validaciones y datos para el servicio', async () => {
    const crear = simular('crear', async () => ({ estado: 'ok', viaje: { id: VIAJE_ID } }));
    const req = (body) => ({ body, usuario: USUARIO, supabase: {} });

    const sinNombre = crearRes();
    await viajeController.crear(req({ presupuesto: 1 }), sinNombre);
    assert.equal(sinNombre.cuerpo.error.mensaje, 'El nombre es obligatorio y tiene un máximo de 100 caracteres');

    const invertidas = crearRes();
    await viajeController.crear(req({ nombre: 'X', presupuesto: 1, fecha_inicio: '2027-05-15', fecha_fin: '2027-05-12' }), invertidas);
    assert.equal(invertidas.cuerpo.error.mensaje, 'La fecha de fin no puede ser anterior a la de inicio');

    const ok = crearRes();
    await viajeController.crear(req({ nombre: ' Roma ', presupuesto: 850, destino: '' }), ok);
    assert.equal(ok.codigo, 201);
    assert.deepEqual(crear.mock.calls[0].arguments[1], {
      nombre: 'Roma',
      presupuesto: 850,
      destino: null,
      fechaInicio: null,
      fechaFin: null,
    });
  });
});
