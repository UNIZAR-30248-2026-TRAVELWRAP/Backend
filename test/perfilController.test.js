// Pruebas del controlador del perfil (PATCH /api/perfil, PUT y DELETE /api/perfil/avatar).
// El servicio se sustituye por un mock: aquí se comprueba la validación y la traducción de cada resultado
// del servicio a su código HTTP. El límite de 2 MB lo aplica el middleware de subida y las rutas sin sesión
// las rechaza requiereSesion; los dos se prueban con un servidor real.
const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const perfilService = require('../src/services/perfilService');
const perfilController = require('../src/controllers/perfilController');
const perfilRoutes = require('../src/routes/perfilRoutes');

const { recibirAvatar } = perfilRoutes;

const USUARIO = { id: 'df77cba6-4be5-4cbc-814b-1e228dd73dcc' };
const OTRO_ID = '123e4567-e89b-12d3-a456-426614174000';
const USUARIO_RESPUESTA = {
  id: USUARIO.id,
  nombre: 'Berta',
  email: 'berta@travelwrap.app',
  avatar_url: null,
  creado_en: '2026-10-07T18:00:00Z',
};

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const GIF = Buffer.from('GIF89a');
const PDF = Buffer.from('%PDF-1.4\n%contenido de prueba');

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

const llamar = async (accion, req) => {
  const res = crearRes();
  await perfilController[accion]({ usuario: USUARIO, supabase: {}, body: {}, ...req }, res);
  return res;
};

const esperarError = (res, codigo, codigoError) => {
  assert.equal(res.codigo, codigo);
  assert.equal(res.cuerpo.error.codigo, codigoError);
  assert.ok(res.cuerpo.error.mensaje);
};

afterEach(() => mock.restoreAll());

describe('PATCH /perfil (actualizarNombre)', () => {
  it('cambia el nombre y devuelve 200 con el usuario', async () => {
    const actualizar = mock.method(perfilService, 'actualizarNombre', async () => ({
      estado: 'ok',
      usuario: USUARIO_RESPUESTA,
    }));

    const res = await llamar('actualizarNombre', { body: { nombre: 'Berta' } });

    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { usuario: USUARIO_RESPUESTA });
    const [, usuarioId, nombre] = actualizar.mock.calls[0].arguments;
    assert.equal(usuarioId, USUARIO.id);
    assert.equal(nombre, 'Berta');
  });

  it('quita los espacios de los extremos antes de guardar', async () => {
    const actualizar = mock.method(perfilService, 'actualizarNombre', async () => ({ estado: 'ok', usuario: {} }));
    await llamar('actualizarNombre', { body: { nombre: '   Berta Castillo  ' } });
    assert.equal(actualizar.mock.calls[0].arguments[2], 'Berta Castillo');
  });

  it('acepta un nombre de exactamente 100 caracteres', async () => {
    mock.method(perfilService, 'actualizarNombre', async () => ({ estado: 'ok', usuario: {} }));
    assert.equal((await llamar('actualizarNombre', { body: { nombre: 'a'.repeat(100) } })).codigo, 200);
  });

  it('actualiza siempre el perfil del token, aunque el cuerpo traiga otro id', async () => {
    const actualizar = mock.method(perfilService, 'actualizarNombre', async () => ({ estado: 'ok', usuario: {} }));
    await llamar('actualizarNombre', { body: { nombre: 'Berta', id: OTRO_ID, usuario_id: OTRO_ID } });
    assert.equal(actualizar.mock.calls[0].arguments[1], USUARIO.id);
  });

  for (const [descripcion, body] of [
    ['vacío', { nombre: '' }],
    ['solo espacios', { nombre: '    ' }],
    ['de más de 100 caracteres', { nombre: 'a'.repeat(101) }],
    ['de más de 100 caracteres aunque tenga espacios de relleno', { nombre: `  ${'a'.repeat(101)}  ` }],
    ['que no es un texto', { nombre: 123 }],
    ['nulo', { nombre: null }],
    ['ausente', {}],
    ['con el cuerpo vacío', undefined],
  ]) {
    it(`rechaza con 400 un nombre ${descripcion}`, async () => {
      const actualizar = mock.method(perfilService, 'actualizarNombre');
      const res = await llamar('actualizarNombre', { body });
      esperarError(res, 400, 'datos_invalidos');
      assert.equal(res.cuerpo.error.mensaje, 'El nombre debe tener entre 1 y 100 caracteres');
      assert.equal(actualizar.mock.callCount(), 0);
    });
  }

  it('devuelve 400 si la base de datos rechaza el nombre por su restricción', async () => {
    mock.method(perfilService, 'actualizarNombre', async () => ({ error: { code: '23514' } }));
    esperarError(await llamar('actualizarNombre', { body: { nombre: 'Berta' } }), 400, 'datos_invalidos');
  });

  it('devuelve 500 si falla la base de datos', async () => {
    mock.method(perfilService, 'actualizarNombre', async () => ({ error: { code: 'XX000' } }));
    esperarError(await llamar('actualizarNombre', { body: { nombre: 'Berta' } }), 500, 'error_interno');
  });

  it('devuelve 500 si el servicio lanza una excepción', async () => {
    mock.method(perfilService, 'actualizarNombre', async () => {
      throw new Error('fallo');
    });
    esperarError(await llamar('actualizarNombre', { body: { nombre: 'Berta' } }), 500, 'error_interno');
  });

  it('devuelve 404 si el usuario no tiene perfil', async () => {
    mock.method(perfilService, 'actualizarNombre', async () => ({ estado: 'no_existe' }));
    esperarError(await llamar('actualizarNombre', { body: { nombre: 'Berta' } }), 404, 'perfil_no_encontrado');
  });
});

describe('PUT /perfil/avatar (cambiarAvatar)', () => {
  it('sube un PNG válido y devuelve 200 con el usuario', async () => {
    const cambiar = mock.method(perfilService, 'cambiarAvatar', async () => ({ estado: 'ok', usuario: USUARIO_RESPUESTA }));

    const res = await llamar('cambiarAvatar', { file: { buffer: PNG, mimetype: 'image/png' } });

    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { usuario: USUARIO_RESPUESTA });
    const [, usuarioId, datos] = cambiar.mock.calls[0].arguments;
    assert.equal(usuarioId, USUARIO.id);
    assert.equal(datos.tipoMime, 'image/png');
    assert.equal(datos.buffer, PNG);
  });

  it('sube un JPEG válido y devuelve 200', async () => {
    const cambiar = mock.method(perfilService, 'cambiarAvatar', async () => ({ estado: 'ok', usuario: {} }));
    const res = await llamar('cambiarAvatar', { file: { buffer: JPEG, mimetype: 'image/jpeg' } });
    assert.equal(res.codigo, 200);
    assert.equal(cambiar.mock.calls[0].arguments[2].tipoMime, 'image/jpeg');
  });

  it('usa el usuario del token, aunque el cuerpo traiga otro id', async () => {
    const cambiar = mock.method(perfilService, 'cambiarAvatar', async () => ({ estado: 'ok', usuario: {} }));
    await llamar('cambiarAvatar', {
      file: { buffer: PNG, mimetype: 'image/png' },
      body: { id: OTRO_ID, usuario_id: OTRO_ID },
    });
    assert.equal(cambiar.mock.calls[0].arguments[1], USUARIO.id);
  });

  it('sube el tipo que indica el contenido, no el que declara el cliente (JPEG declarado como PNG)', async () => {
    const cambiar = mock.method(perfilService, 'cambiarAvatar', async () => ({ estado: 'ok', usuario: {} }));
    await llamar('cambiarAvatar', { file: { buffer: JPEG, mimetype: 'image/png' } });
    assert.equal(cambiar.mock.calls[0].arguments[2].tipoMime, 'image/jpeg');
  });

  for (const [descripcion, file] of [
    ['un GIF', { buffer: GIF, mimetype: 'image/gif' }],
    ['un PDF', { buffer: PDF, mimetype: 'application/pdf' }],
    ['un archivo con tipo PNG pero firma de PDF', { buffer: PDF, mimetype: 'image/png' }],
    ['un archivo con tipo JPEG pero contenido de texto', { buffer: Buffer.from('hola'), mimetype: 'image/jpeg' }],
    ['una imagen válida con tipo declarado de PDF', { buffer: PNG, mimetype: 'application/pdf' }],
  ]) {
    it(`rechaza con 400 tipo_no_permitido ${descripcion}`, async () => {
      const cambiar = mock.method(perfilService, 'cambiarAvatar');
      esperarError(await llamar('cambiarAvatar', { file }), 400, 'tipo_no_permitido');
      assert.equal(cambiar.mock.callCount(), 0);
    });
  }

  it('rechaza con 400 datos_invalidos si no llega archivo o llega vacío', async () => {
    const cambiar = mock.method(perfilService, 'cambiarAvatar');
    esperarError(await llamar('cambiarAvatar', {}), 400, 'datos_invalidos');
    esperarError(await llamar('cambiarAvatar', { file: { buffer: Buffer.alloc(0), mimetype: 'image/png' } }), 400, 'datos_invalidos');
    assert.equal(cambiar.mock.callCount(), 0);
  });

  it('devuelve 502 error_storage si falla Storage o la base de datos', async () => {
    mock.method(perfilService, 'cambiarAvatar', async () => ({ error: { message: 'bucket' } }));
    esperarError(await llamar('cambiarAvatar', { file: { buffer: PNG, mimetype: 'image/png' } }), 502, 'error_storage');
  });

  it('devuelve 404 si el usuario no tiene perfil', async () => {
    mock.method(perfilService, 'cambiarAvatar', async () => ({ estado: 'no_existe' }));
    esperarError(await llamar('cambiarAvatar', { file: { buffer: PNG, mimetype: 'image/png' } }), 404, 'perfil_no_encontrado');
  });

  it('devuelve 500 si el servicio lanza una excepción', async () => {
    mock.method(perfilService, 'cambiarAvatar', async () => {
      throw new Error('fallo');
    });
    esperarError(await llamar('cambiarAvatar', { file: { buffer: PNG, mimetype: 'image/png' } }), 500, 'error_interno');
  });
});

describe('DELETE /perfil/avatar (quitarAvatar)', () => {
  it('quita la foto del usuario del token y devuelve 200 con avatar_url null', async () => {
    const quitar = mock.method(perfilService, 'quitarAvatar', async () => ({ estado: 'ok', usuario: USUARIO_RESPUESTA }));

    const res = await llamar('quitarAvatar', {});

    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { usuario: USUARIO_RESPUESTA });
    assert.equal(res.cuerpo.usuario.avatar_url, null);
    assert.equal(quitar.mock.calls[0].arguments[1], USUARIO.id);
  });

  it('devuelve 404 si el usuario no tiene perfil', async () => {
    mock.method(perfilService, 'quitarAvatar', async () => ({ estado: 'no_existe' }));
    esperarError(await llamar('quitarAvatar', {}), 404, 'perfil_no_encontrado');
  });

  it('devuelve 502 error_storage si falla el servicio', async () => {
    mock.method(perfilService, 'quitarAvatar', async () => ({ error: { code: 'XX000' } }));
    esperarError(await llamar('quitarAvatar', {}), 502, 'error_storage');
  });

  it('devuelve 500 si el servicio lanza una excepción', async () => {
    mock.method(perfilService, 'quitarAvatar', async () => {
      throw new Error('fallo');
    });
    esperarError(await llamar('quitarAvatar', {}), 500, 'error_interno');
  });
});

// Servidor real con solo lo que se quiere probar
const conServidor = async (montar, peticion) => {
  const app = express();
  app.use(express.json());
  montar(app);
  const servidor = await new Promise((resolver) => {
    const s = app.listen(0, () => resolver(s));
  });
  try {
    const respuesta = await peticion(`http://127.0.0.1:${servidor.address().port}`);
    return { estado: respuesta.status, cuerpo: await respuesta.json() };
  } finally {
    await new Promise((resolver) => servidor.close(resolver));
  }
};

describe('middleware de subida del avatar (límite de 2 MB)', () => {
  const enviar = (archivo, campo = 'avatar') =>
    conServidor(
      (app) => app.put('/', recibirAvatar, (req, res) => res.status(200).json({ bytes: req.file.size })),
      (url) => {
        const formulario = new FormData();
        formulario.append(campo, new Blob([archivo]), 'foto.png');
        return fetch(`${url}/`, { method: 'PUT', body: formulario });
      },
    );

  it('acepta una foto pequeña', async () => {
    const { estado, cuerpo } = await enviar(PNG);
    assert.equal(estado, 200);
    assert.equal(cuerpo.bytes, PNG.length);
  });

  it('acepta una foto de exactamente 2 MB', async () => {
    assert.equal((await enviar(Buffer.alloc(2_000_000, 1))).estado, 200);
  });

  it('rechaza con 400 archivo_demasiado_grande una foto de más de 2 MB', async () => {
    const { estado, cuerpo } = await enviar(Buffer.alloc(2_000_001, 1));
    assert.equal(estado, 400);
    assert.equal(cuerpo.error.codigo, 'archivo_demasiado_grande');
  });

  it('rechaza con 400 datos_invalidos un archivo enviado en un campo inesperado', async () => {
    const { estado, cuerpo } = await enviar(PNG, 'otro');
    assert.equal(estado, 400);
    assert.equal(cuerpo.error.codigo, 'datos_invalidos');
  });
});

describe('rutas del perfil sin sesión', () => {
  const sinToken = (metodo, ruta, opciones = {}) =>
    conServidor(
      (app) => app.use('/api/perfil', perfilRoutes),
      (url) => fetch(`${url}/api/perfil${ruta}`, { method: metodo, ...opciones }),
    );

  it('PATCH /api/perfil devuelve 401 sin token', async () => {
    const { estado, cuerpo } = await sinToken('PATCH', '', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'Berta' }),
    });
    assert.equal(estado, 401);
    assert.equal(cuerpo.error.codigo, 'sin_sesion');
  });

  it('PUT /api/perfil/avatar devuelve 401 sin token', async () => {
    const formulario = new FormData();
    formulario.append('avatar', new Blob([PNG]), 'foto.png');
    const { estado, cuerpo } = await sinToken('PUT', '/avatar', { body: formulario });
    assert.equal(estado, 401);
    assert.equal(cuerpo.error.codigo, 'sin_sesion');
  });

  it('DELETE /api/perfil/avatar devuelve 401 sin token', async () => {
    const { estado, cuerpo } = await sinToken('DELETE', '/avatar');
    assert.equal(estado, 401);
    assert.equal(cuerpo.error.codigo, 'sin_sesion');
  });
});
