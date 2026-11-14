const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const viajeService = require('../src/services/viajeService');
const viajeController = require('../src/controllers/viajeController');
const votacionesSocket = require('../src/sockets/votacionesSocket');

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

const llamar = async (accion, { viajeId = VIAJE_ID, body, query = {} } = {}) => {
  const req = { params: { viajeId }, query, body, usuario: USUARIO, supabase: {} };
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
      body: { nombre: '  Roma 2028 ', presupuesto: 950, fecha_inicio: '', estado: 'finalizado', id: 'otro' },
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
    ['solo campos desconocidos', { estado: 'finalizado' }, 'Indica al menos un dato del viaje que cambiar'],
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

describe('GET /viajes (listar)', () => {
  it('por defecto pide los viajes no archivados, sin filtrar por estado', async () => {
    const listar = simular('listar', async () => ({ viajes: [{ id: VIAJE_ID }] }));

    const res = await llamar('listar');

    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { viajes: [{ id: VIAJE_ID }] });
    assert.deepEqual(listar.mock.calls[0].arguments.slice(1), [USUARIO.id, { estado: undefined, archivados: false }]);
  });

  it('con archivados=true pide solo los archivados del usuario y admite filtrar por estado', async () => {
    const listar = simular('listar', async () => ({ viajes: [] }));

    await llamar('listar', { query: { archivados: 'true' } });
    await llamar('listar', { query: { estado: 'finalizado', archivados: 'false' } });

    assert.deepEqual(listar.mock.calls[0].arguments[2], { estado: undefined, archivados: true });
    assert.deepEqual(listar.mock.calls[1].arguments[2], { estado: 'finalizado', archivados: false });
  });

  it('rechaza con 400 el estado archivado (ya no existe) y los valores no válidos, sin llamar al servicio', async () => {
    const listar = simular('listar', async () => ({ viajes: [] }));

    const archivado = await llamar('listar', { query: { estado: 'archivado' } });
    assert.equal(archivado.codigo, 400);
    assert.equal(archivado.cuerpo.error.mensaje, 'El estado debe ser activo o finalizado');

    const archivados = await llamar('listar', { query: { archivados: 'quizas' } });
    assert.equal(archivados.codigo, 400);
    assert.equal(archivados.cuerpo.error.codigo, 'datos_invalidos');
    assert.equal(listar.mock.callCount(), 0);
  });

  it('responde 502 si falla Supabase y 500 si algo revienta', async () => {
    simular('listar', async () => ({ error: { code: 'PGRST000' } }));
    assert.equal((await llamar('listar')).codigo, 502);

    mock.restoreAll();
    simular('listar', async () => {
      throw new Error('boom');
    });
    assert.equal((await llamar('listar')).codigo, 500);
  });
});

describe('POST /viajes/:viajeId/finalizar', () => {
  it('devuelve el viaje finalizado', async () => {
    const finalizar = simular('finalizar', async () => ({ estado: 'ok', viaje: { id: VIAJE_ID, estado: 'finalizado' } }));

    const res = await llamar('finalizar');

    assert.equal(res.codigo, 200);
    assert.equal(res.cuerpo.estado, 'finalizado');
    assert.deepEqual(finalizar.mock.calls[0].arguments.slice(1), [USUARIO.id, VIAJE_ID]);
  });

  it('responde 409 si ya estaba finalizado, 403 si no es el creador y 404 si no existe', async () => {
    simular('finalizar', async () => ({ estado: 'ya_finalizado' }));
    const yaFinalizado = await llamar('finalizar');
    assert.equal(yaFinalizado.codigo, 409);
    assert.equal(yaFinalizado.cuerpo.error.codigo, 'viaje_finalizado');

    mock.restoreAll();
    simular('finalizar', async () => ({ estado: 'no_creador' }));
    assert.equal((await llamar('finalizar')).codigo, 403);

    mock.restoreAll();
    simular('finalizar', async () => ({ estado: 'no_existe' }));
    assert.equal((await llamar('finalizar')).codigo, 404);
  });

  it('rechaza un identificador inválido y responde 502 si falla Supabase', async () => {
    assert.equal((await llamar('finalizar', { viajeId: 'x' })).codigo, 400);

    simular('finalizar', async () => ({ error: { code: 'PGRST000' } }));
    const res = await llamar('finalizar');
    assert.equal(res.codigo, 502);
    assert.equal(res.cuerpo.error.mensaje, 'No se ha podido finalizar el viaje');
  });
});

describe('POST /viajes/:viajeId/archivar', () => {
  it('devuelve el viaje finalizado para el usuario, sea o no el creador', async () => {
    const archivar = simular('archivar', async () => ({
      estado: 'ok',
      viaje: { id: VIAJE_ID, estado: 'finalizado', rol: 'miembro', archivado: true },
    }));

    const res = await llamar('archivar');

    assert.equal(res.codigo, 200);
    assert.equal(res.cuerpo.archivado, true);
    assert.equal(res.cuerpo.estado, 'finalizado');
    assert.deepEqual(archivar.mock.calls[0].arguments.slice(1), [USUARIO.id, VIAJE_ID]);
  });

  it('responde 409 viaje_no_finalizado si el viaje sigue activo', async () => {
    simular('archivar', async () => ({ estado: 'no_finalizado' }));

    const res = await llamar('archivar');

    assert.equal(res.codigo, 409);
    assert.equal(res.cuerpo.error.codigo, 'viaje_no_finalizado');
    assert.equal(res.cuerpo.error.mensaje, 'Solo se pueden archivar viajes finalizados');
  });

  it('responde 409 viaje_archivado si ya lo tenía archivado y 404 si no existe', async () => {
    simular('archivar', async () => ({ estado: 'ya_archivado' }));
    const yaArchivado = await llamar('archivar');
    assert.equal(yaArchivado.codigo, 409);
    assert.equal(yaArchivado.cuerpo.error.codigo, 'viaje_archivado');

    mock.restoreAll();
    simular('archivar', async () => ({ estado: 'no_existe' }));
    assert.equal((await llamar('archivar')).codigo, 404);
  });

  it('rechaza un identificador inválido, responde 502 si falla Supabase y 500 si hay una excepción', async () => {
    assert.equal((await llamar('archivar', { viajeId: 'x' })).codigo, 400);

    simular('archivar', async () => ({ error: { code: 'PGRST000' } }));
    const res = await llamar('archivar');
    assert.equal(res.codigo, 502);
    assert.equal(res.cuerpo.error.mensaje, 'No se ha podido archivar el viaje');

    mock.restoreAll();
    simular('archivar', async () => {
      throw new Error('fallo');
    });
    assert.equal((await llamar('archivar')).codigo, 500);
  });
});

describe('POST /viajes/:viajeId/desarchivar', () => {
  it('devuelve el viaje desarchivado, que sigue finalizado, sea o no el creador', async () => {
    const desarchivar = simular('desarchivar', async () => ({
      estado: 'ok',
      viaje: { id: VIAJE_ID, estado: 'finalizado', rol: 'miembro', archivado: false },
    }));

    const res = await llamar('desarchivar');

    assert.equal(res.codigo, 200);
    assert.equal(res.cuerpo.archivado, false);
    assert.equal(res.cuerpo.estado, 'finalizado');
    assert.deepEqual(desarchivar.mock.calls[0].arguments.slice(1), [USUARIO.id, VIAJE_ID]);
  });

  it('responde 404 si el viaje no existe', async () => {
    simular('desarchivar', async () => ({ estado: 'no_existe' }));

    assert.equal((await llamar('desarchivar')).codigo, 404);
  });

  it('responde 409 si el viaje no estaba archivado', async () => {
    simular('desarchivar', async () => ({ estado: 'no_estaba_archivado' }));

    const res = await llamar('desarchivar');

    assert.equal(res.codigo, 409);
    assert.equal(res.cuerpo.error.codigo, 'viaje_no_archivado');
    assert.equal(res.cuerpo.error.mensaje, 'El viaje no está archivado');
  });

  it('rechaza un identificador inválido, responde 502 si falla Supabase y 500 si hay una excepción', async () => {
    assert.equal((await llamar('desarchivar', { viajeId: 'x' })).codigo, 400);

    simular('desarchivar', async () => ({ error: { code: 'PGRST000' } }));
    const res = await llamar('desarchivar');
    assert.equal(res.codigo, 502);
    assert.equal(res.cuerpo.error.mensaje, 'No se ha podido desarchivar el viaje');

    mock.restoreAll();
    simular('desarchivar', async () => {
      throw new Error('fallo');
    });
    assert.equal((await llamar('desarchivar')).codigo, 500);
  });
});

describe('DELETE /viajes/:viajeId', () => {
  it('responde 204 sin cuerpo al eliminar, sea o no el creador', async () => {
    const eliminar = simular('eliminar', async () => ({ estado: 'ok' }));

    const res = await llamar('eliminar');

    assert.equal(res.codigo, 204);
    assert.equal(res.cuerpo, undefined);
    assert.deepEqual(eliminar.mock.calls[0].arguments.slice(1), [USUARIO.id, VIAJE_ID]);
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

  it('responde 502 sin rutas de archivos si falla el borrado y 500 si hay una excepción', async () => {
    simular('eliminar', async () => ({ error: { message: 'fallo', rutas: ['x/y.pdf'] } }));

    const res = await llamar('eliminar');

    assert.equal(res.codigo, 502);
    assert.deepEqual(res.cuerpo, { error: { codigo: 'error_viaje', mensaje: 'No se ha podido eliminar el viaje' } });

    mock.restoreAll();
    simular('eliminar', async () => {
      throw new Error('boom');
    });
    assert.equal((await llamar('eliminar')).codigo, 500);
  });

  it('rechaza un identificador que no es un UUID', async () => {
    assert.equal((await llamar('eliminar', { viajeId: 'x' })).codigo, 400);
  });
});

describe('POST /viajes (crear) tras separar los validadores', () => {
  it('mantiene las mismas validaciones y datos para el servicio', async () => {
    const crear = simular('crear', async () => ({ estado: 'ok', viaje: { id: VIAJE_ID } }));
    const req = (body) => ({ body, usuario: USUARIO, supabase: {} });

    const nombreLargo = crearRes();
    await viajeController.crear(req({ nombre: 'x'.repeat(101), presupuesto: 1 }), nombreLargo);
    assert.equal(nombreLargo.cuerpo.error.mensaje, 'El nombre debe ser un texto de 100 caracteres como máximo');

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

describe('POST /viajes/:viajeId/abandonar', () => {
  it('responde 204 sin cuerpo y avisa a las votaciones abiertas de que han cambiado los miembros', async () => {
    const abandonar = simular('abandonar', async () => ({ estado: 'ok' }));
    const avisar = mock.method(votacionesSocket, 'avisarCambio', () => {});

    const res = await llamar('abandonar');

    assert.equal(res.codigo, 204);
    assert.equal(res.cuerpo, undefined);
    assert.deepEqual(abandonar.mock.calls[0].arguments.slice(1), [VIAJE_ID]);
    assert.deepEqual(avisar.mock.calls[0].arguments, [VIAJE_ID, { motivo: 'miembros' }]);
  });

  it('con saldo pendiente responde 409 con el saldo y no avisa a nadie', async () => {
    const avisar = mock.method(votacionesSocket, 'avisarCambio', () => {});
    simular('abandonar', async () => ({ estado: 'saldo_pendiente', saldo: 12.5 }));

    const res = await llamar('abandonar');

    assert.equal(res.codigo, 409);
    assert.equal(res.cuerpo.error.codigo, 'saldo_pendiente');
    assert.equal(res.cuerpo.error.mensaje, 'Solo puedes abandonar el viaje con el saldo a cero. Tu saldo es de 12.50 €');
    assert.equal(avisar.mock.calls.length, 0);
  });

  it('responde 403 si es el creador, 409 si el viaje ya no está activo y 404 si no es miembro', async () => {
    simular('abandonar', async () => ({ estado: 'es_creador' }));
    const creador = await llamar('abandonar');
    assert.equal(creador.codigo, 403);
    assert.equal(creador.cuerpo.error.codigo, 'es_creador');

    mock.restoreAll();
    simular('abandonar', async () => ({ estado: 'no_activo' }));
    const finalizado = await llamar('abandonar');
    assert.equal(finalizado.codigo, 409);
    assert.equal(finalizado.cuerpo.error.codigo, 'viaje_no_activo');

    mock.restoreAll();
    simular('abandonar', async () => ({ estado: 'no_miembro' }));
    assert.equal((await llamar('abandonar')).codigo, 404);
  });

  it('rechaza un identificador inválido, responde 502 si falla Supabase y 500 si hay una excepción', async () => {
    const avisar = mock.method(votacionesSocket, 'avisarCambio', () => {});
    assert.equal((await llamar('abandonar', { viajeId: 'x' })).codigo, 400);

    simular('abandonar', async () => ({ error: { code: 'PGRST000' } }));
    const fallo = await llamar('abandonar');
    assert.equal(fallo.codigo, 502);
    assert.equal(fallo.cuerpo.error.mensaje, 'No se ha podido abandonar el viaje');

    mock.restoreAll();
    mock.method(votacionesSocket, 'avisarCambio', () => {});
    simular('abandonar', async () => {
      throw new Error('fallo inesperado');
    });
    assert.equal((await llamar('abandonar')).codigo, 500);
    assert.equal(avisar.mock.calls.length, 0);
  });
});
