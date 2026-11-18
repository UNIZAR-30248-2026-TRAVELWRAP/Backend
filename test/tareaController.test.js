// Pruebas del controlador de tareas (PB-41): validación y traducción de cada resultado del servicio a HTTP.
// El servicio se sustituye por un mock
const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const tareaService = require('../src/services/tareaService');
const tareaController = require('../src/controllers/tareaController');

const USUARIO = { id: 'df77cba6-4be5-4cbc-814b-1e228dd73dcc' };
const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const TAREA_ID = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
const RESPONSABLE_ID = '5b1f0c2e-8a7d-4c3b-9e6f-2d4a1b3c5e7f';
const TAREA = { id: TAREA_ID, texto: 'Reservar la cena', hecha: false, hecha_en: null, creado_en: '2027-05-01T10:00:00Z', responsable: { usuario_id: RESPONSABLE_ID, nombre: 'Berta', avatar_url: null } };

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
  await tareaController[accion]({ usuario: USUARIO, supabase: {}, params: {}, body: {}, ...req }, res);
  return res;
};

const esperarError = (res, codigo, codigoError) => {
  assert.equal(res.codigo, codigo);
  assert.equal(res.cuerpo.error.codigo, codigoError);
  assert.ok(res.cuerpo.error.mensaje);
};

const params = { viajeId: VIAJE_ID, tareaId: TAREA_ID };

afterEach(() => mock.restoreAll());

describe('GET /viajes/:viajeId/tareas', () => {
  it('devuelve la lista de tareas', async () => {
    mock.method(tareaService, 'listar', async () => ({ estado: 'ok', tareas: [TAREA] }));
    const res = await llamar('listar', { params });
    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { tareas: [TAREA] });
  });

  it('id mal formado 400, viaje inexistente o no miembro 404, fallo 502, excepción 500', async () => {
    esperarError(await llamar('listar', { params: { viajeId: 'x' } }), 400, 'datos_invalidos');

    mock.method(tareaService, 'listar', async () => ({ estado: 'no_existe' }));
    esperarError(await llamar('listar', { params }), 404, 'viaje_no_encontrado');
    mock.restoreAll();

    mock.method(tareaService, 'listar', async () => ({ error: { code: 'x' } }));
    esperarError(await llamar('listar', { params }), 502, 'error_tarea');
    mock.restoreAll();

    mock.method(tareaService, 'listar', async () => {
      throw new Error('fallo');
    });
    esperarError(await llamar('listar', { params }), 500, 'error_interno');
  });
});

describe('POST /viajes/:viajeId/tareas', () => {
  it('crea la tarea con el texto recortado y responde 201', async () => {
    const crear = mock.method(tareaService, 'crear', async () => ({ estado: 'ok', tarea: TAREA }));
    const res = await llamar('crear', { params, body: { texto: '  Reservar la cena  ', responsable_id: RESPONSABLE_ID } });

    assert.equal(res.codigo, 201);
    assert.deepEqual(res.cuerpo, TAREA);
    assert.deepEqual(crear.mock.calls[0].arguments.slice(1), [USUARIO.id, VIAJE_ID, { texto: 'Reservar la cena', responsableId: RESPONSABLE_ID }]);
  });

  it('un texto vacío, solo espacios, que no es texto o de más de 200 caracteres da 400 sin llamar al servicio', async () => {
    const crear = mock.method(tareaService, 'crear', async () => ({ estado: 'ok', tarea: TAREA }));
    for (const texto of ['', '   ', 5, undefined, 'a'.repeat(201)]) {
      esperarError(await llamar('crear', { params, body: { texto, responsable_id: RESPONSABLE_ID } }), 400, 'datos_invalidos');
    }
    assert.equal(crear.mock.calls.length, 0);
  });

  it('acepta un texto de exactamente 200 caracteres', async () => {
    mock.method(tareaService, 'crear', async () => ({ estado: 'ok', tarea: TAREA }));
    const res = await llamar('crear', { params, body: { texto: 'a'.repeat(200), responsable_id: RESPONSABLE_ID } });
    assert.equal(res.codigo, 201);
  });

  it('un responsable que no es un UUID da 400', async () => {
    esperarError(await llamar('crear', { params, body: { texto: 'x', responsable_id: 'no-uuid' } }), 400, 'datos_invalidos');
    esperarError(await llamar('crear', { params: { viajeId: 'x' }, body: { texto: 'x', responsable_id: RESPONSABLE_ID } }), 400, 'datos_invalidos');
  });

  it('responsable que no es miembro 400, viaje finalizado 409, inexistente 404, fallo 502', async () => {
    const body = { texto: 'x', responsable_id: RESPONSABLE_ID };

    mock.method(tareaService, 'crear', async () => ({ estado: 'responsable_no_miembro' }));
    esperarError(await llamar('crear', { params, body }), 400, 'datos_invalidos');
    mock.restoreAll();

    mock.method(tareaService, 'crear', async () => ({ estado: 'no_activo' }));
    esperarError(await llamar('crear', { params, body }), 409, 'viaje_no_activo');
    mock.restoreAll();

    mock.method(tareaService, 'crear', async () => ({ estado: 'no_existe' }));
    esperarError(await llamar('crear', { params, body }), 404, 'viaje_no_encontrado');
    mock.restoreAll();

    mock.method(tareaService, 'crear', async () => ({ error: { code: 'x' } }));
    esperarError(await llamar('crear', { params, body }), 502, 'error_tarea');
  });
});

describe('PATCH /viajes/:viajeId/tareas/:tareaId', () => {
  it('marca y desmarca con hecha', async () => {
    const editar = mock.method(tareaService, 'editar', async () => ({ estado: 'ok', tarea: { ...TAREA, hecha: true } }));
    const res = await llamar('editar', { params, body: { hecha: true } });
    assert.equal(res.codigo, 200);
    assert.equal(res.cuerpo.hecha, true);
    assert.deepEqual(editar.mock.calls[0].arguments.slice(1), [USUARIO.id, VIAJE_ID, TAREA_ID, { hecha: true }]);

    await llamar('editar', { params, body: { hecha: false } });
    assert.deepEqual(editar.mock.calls[1].arguments[4], { hecha: false });
  });

  it('edita el texto (recortado) y el responsable', async () => {
    const editar = mock.method(tareaService, 'editar', async () => ({ estado: 'ok', tarea: TAREA }));
    const res = await llamar('editar', { params, body: { texto: ' Nuevo ', responsable_id: RESPONSABLE_ID } });
    assert.equal(res.codigo, 200);
    assert.deepEqual(editar.mock.calls[0].arguments[4], { texto: 'Nuevo', responsableId: RESPONSABLE_ID });
  });

  it('un cuerpo sin ningún campo conocido da 400', async () => {
    const editar = mock.method(tareaService, 'editar', async () => ({ estado: 'ok', tarea: TAREA }));
    esperarError(await llamar('editar', { params, body: {} }), 400, 'datos_invalidos');
    esperarError(await llamar('editar', { params, body: { otro: 1 } }), 400, 'datos_invalidos');
    esperarError(await llamar('editar', { params, body: undefined }), 400, 'datos_invalidos');
    assert.equal(editar.mock.calls.length, 0);
  });

  it('valores inválidos: texto vacío o largo, responsable no UUID, hecha que no es booleano', async () => {
    for (const body of [{ texto: '  ' }, { texto: 'a'.repeat(201) }, { responsable_id: 'x' }, { hecha: 'si' }, { hecha: 1 }]) {
      esperarError(await llamar('editar', { params, body }), 400, 'datos_invalidos');
    }
  });

  it('ids mal formados dan 400', async () => {
    esperarError(await llamar('editar', { params: { viajeId: 'x', tareaId: TAREA_ID }, body: { hecha: true } }), 400, 'datos_invalidos');
    esperarError(await llamar('editar', { params: { viajeId: VIAJE_ID, tareaId: 'x' }, body: { hecha: true } }), 400, 'datos_invalidos');
  });

  it('tarea de otro viaje o inexistente 404, viaje no miembro 404, finalizado 409, fallo 502', async () => {
    const body = { hecha: true };

    mock.method(tareaService, 'editar', async () => ({ estado: 'tarea_no_existe' }));
    esperarError(await llamar('editar', { params, body }), 404, 'tarea_no_encontrada');
    mock.restoreAll();

    mock.method(tareaService, 'editar', async () => ({ estado: 'no_existe' }));
    esperarError(await llamar('editar', { params, body }), 404, 'viaje_no_encontrado');
    mock.restoreAll();

    mock.method(tareaService, 'editar', async () => ({ estado: 'no_activo' }));
    esperarError(await llamar('editar', { params, body }), 409, 'viaje_no_activo');
    mock.restoreAll();

    mock.method(tareaService, 'editar', async () => ({ error: { code: 'x' } }));
    esperarError(await llamar('editar', { params, body }), 502, 'error_tarea');
  });
});

describe('DELETE /viajes/:viajeId/tareas/:tareaId', () => {
  it('borra la tarea y responde 204', async () => {
    mock.method(tareaService, 'borrar', async () => ({ estado: 'ok' }));
    assert.equal((await llamar('borrar', { params })).codigo, 204);
  });

  it('ids mal formados 400, tarea inexistente 404, finalizado 409, no miembro 404, fallo 502', async () => {
    esperarError(await llamar('borrar', { params: { viajeId: 'x', tareaId: TAREA_ID } }), 400, 'datos_invalidos');
    esperarError(await llamar('borrar', { params: { viajeId: VIAJE_ID, tareaId: 'x' } }), 400, 'datos_invalidos');

    mock.method(tareaService, 'borrar', async () => ({ estado: 'tarea_no_existe' }));
    esperarError(await llamar('borrar', { params }), 404, 'tarea_no_encontrada');
    mock.restoreAll();

    mock.method(tareaService, 'borrar', async () => ({ estado: 'no_activo' }));
    esperarError(await llamar('borrar', { params }), 409, 'viaje_no_activo');
    mock.restoreAll();

    mock.method(tareaService, 'borrar', async () => ({ estado: 'no_existe' }));
    esperarError(await llamar('borrar', { params }), 404, 'viaje_no_encontrado');
    mock.restoreAll();

    mock.method(tareaService, 'borrar', async () => ({ error: { code: 'x' } }));
    esperarError(await llamar('borrar', { params }), 502, 'error_tarea');
  });
});
