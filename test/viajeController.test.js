const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const viajeService = require('../src/services/viajeService');
const viajeController = require('../src/controllers/viajeController');
const votacionesSocket = require('../src/sockets/votacionesSocket');
const express = require('express');
const { recibirPortada } = require('../src/routes/viajeRoutes');

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

  it('responde 409 si ya estaba finalizado y 404 si no existe', async () => {
    simular('finalizar', async () => ({ estado: 'ya_finalizado' }));
    const yaFinalizado = await llamar('finalizar');
    assert.equal(yaFinalizado.codigo, 409);
    assert.equal(yaFinalizado.cuerpo.error.codigo, 'viaje_finalizado');

    mock.restoreAll();
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

describe('POST /viajes/:viajeId/reabrir', () => {
  it('devuelve el viaje activo, sea o no el creador', async () => {
    const reabrir = simular('reabrir', async () => ({
      estado: 'ok',
      viaje: { id: VIAJE_ID, estado: 'activo', rol: 'miembro', archivado: false },
    }));

    const res = await llamar('reabrir');

    assert.equal(res.codigo, 200);
    assert.equal(res.cuerpo.estado, 'activo');
    assert.deepEqual(reabrir.mock.calls[0].arguments.slice(1), [USUARIO.id, VIAJE_ID]);
  });

  it('responde 404 si el viaje no existe o no es miembro', async () => {
    simular('reabrir', async () => ({ estado: 'no_existe' }));

    const res = await llamar('reabrir');

    assert.equal(res.codigo, 404);
    assert.equal(res.cuerpo.error.codigo, 'viaje_no_encontrado');
  });

  it('responde 409 si el viaje no está finalizado', async () => {
    simular('reabrir', async () => ({ estado: 'no_reabrible' }));

    const res = await llamar('reabrir');

    assert.equal(res.codigo, 409);
    assert.equal(res.cuerpo.error.codigo, 'viaje_no_finalizado');
    assert.equal(res.cuerpo.error.mensaje, 'Solo se pueden reabrir viajes finalizados');
  });

  it('rechaza un identificador inválido, responde 502 si falla Supabase y 500 si hay una excepción', async () => {
    assert.equal((await llamar('reabrir', { viajeId: 'x' })).codigo, 400);

    simular('reabrir', async () => ({ error: { code: 'PGRST000' } }));
    const res = await llamar('reabrir');
    assert.equal(res.codigo, 502);
    assert.equal(res.cuerpo.error.codigo, 'error_viaje');
    assert.equal(res.cuerpo.error.mensaje, 'No se ha podido reabrir el viaje');

    mock.restoreAll();
    simular('reabrir', async () => {
      throw new Error('fallo');
    });
    assert.equal((await llamar('reabrir')).codigo, 500);
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
    assert.equal(res.cuerpo.error.mensaje, 'Solo puedes abandonar el viaje con el saldo a cero. Tu saldo es de 12,50 €');
    assert.equal(avisar.mock.calls.length, 0);
  });


});

// Portada del viaje: PUT y DELETE /viajes/:viajeId/portada
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

const subirPortada = async ({ viajeId = VIAJE_ID, archivo } = {}) => {
  const req = { params: { viajeId }, body: {}, file: archivo, usuario: USUARIO, supabase: {} };
  const res = crearRes();
  await viajeController.subirPortada(req, res);
  return res;
};

describe('PUT /viajes/:viajeId/portada (subirPortada)', () => {
  it('pasa el archivo al servicio con el tipo detectado por su contenido y devuelve el viaje', async () => {
    const subir = simular('subirPortada', async () => ({ estado: 'ok', viaje: { id: VIAJE_ID, portada_url: 'https://storage.test/p' } }));

    const res = await subirPortada({ archivo: { buffer: PNG, mimetype: 'image/jpeg', originalname: 'foto.jpg' } });

    assert.equal(res.codigo, 200);
    assert.equal(res.cuerpo.portada_url, 'https://storage.test/p');
    const [, usuarioId, viajeId, datos] = subir.mock.calls[0].arguments;
    assert.equal(usuarioId, USUARIO.id);
    assert.equal(viajeId, VIAJE_ID);
    assert.equal(datos.tipoMime, 'image/png');
    assert.equal(datos.buffer, PNG);
  });



  it('rechaza con 400 si falta el archivo o está vacío', async () => {
    const subir = simular('subirPortada', async () => ({ estado: 'ok' }));

    for (const archivo of [undefined, { buffer: Buffer.alloc(0) }]) {
      const res = await subirPortada({ archivo });
      assert.equal(res.codigo, 400);
      assert.equal(res.cuerpo.error.codigo, 'datos_invalidos');
    }
    assert.equal(subir.mock.callCount(), 0);
  });

  it('rechaza con 400 tipo_no_permitido lo que no es JPEG o PNG aunque se llame .jpg', async () => {
    const subir = simular('subirPortada', async () => ({ estado: 'ok' }));

    const texto = await subirPortada({ archivo: { buffer: Buffer.from('hola, no soy una foto'), mimetype: 'image/jpeg', originalname: 'a.jpg' } });
    const webp = await subirPortada({ archivo: { buffer: Buffer.from('RIFF0000WEBP'), mimetype: 'image/webp' } });

    for (const res of [texto, webp]) {
      assert.equal(res.codigo, 400);
      assert.equal(res.cuerpo.error.codigo, 'tipo_no_permitido');
    }
    assert.equal(subir.mock.callCount(), 0);
  });


});

describe('DELETE /viajes/:viajeId/portada (quitarPortada)', () => {
  it('quita la portada y devuelve el viaje', async () => {
    const quitar = simular('quitarPortada', async () => ({ estado: 'ok', viaje: { id: VIAJE_ID, portada_url: null } }));

    const res = await llamar('quitarPortada');

    assert.equal(res.codigo, 200);
    assert.equal(res.cuerpo.portada_url, null);
    assert.deepEqual(quitar.mock.calls[0].arguments.slice(1), [USUARIO.id, VIAJE_ID]);
  });


});

describe('PUT /viajes/:viajeId/portada: recepción del archivo (límite de 5 MB)', () => {
  // Servidor real con solo el middleware y un controlador mínimo que responde con lo recibido
  const enviar = async (archivo, campo = 'archivo') => {
    const app = express();
    app.put('/', recibirPortada, (req, res) => res.status(200).json({ bytes: req.file.size }));
    const servidor = await new Promise((resolver) => {
      const s = app.listen(0, () => resolver(s));
    });
    try {
      const formulario = new FormData();
      formulario.append(campo, new Blob([archivo]), 'foto.jpg');
      const respuesta = await fetch(`http://127.0.0.1:${servidor.address().port}/`, { method: 'PUT', body: formulario });
      return { estado: respuesta.status, cuerpo: await respuesta.json() };
    } finally {
      await new Promise((resolver) => servidor.close(resolver));
    }
  };

  it('acepta una foto pequeña', async () => {
    const { estado, cuerpo } = await enviar(JPEG);
    assert.equal(estado, 200);
    assert.equal(cuerpo.bytes, JPEG.length);
  });

  it('rechaza con 400 archivo_demasiado_grande una foto de más de 5 MB', async () => {
    const { estado, cuerpo } = await enviar(Buffer.alloc(5_000_001, 1));
    assert.equal(estado, 400);
    assert.deepEqual(cuerpo.error, { codigo: 'archivo_demasiado_grande', mensaje: 'La portada no puede ocupar más de 5 MB' });
  });

  it('rechaza con 400 datos_invalidos un archivo en otro campo del formulario', async () => {
    const { estado, cuerpo } = await enviar(JPEG, 'foto');
    assert.equal(estado, 400);
    assert.equal(cuerpo.error.codigo, 'datos_invalidos');
  });
});
