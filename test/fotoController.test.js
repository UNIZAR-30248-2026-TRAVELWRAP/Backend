const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fotoService = require('../src/services/fotoService');
const fotoController = require('../src/controllers/fotoController');
const { recibirFoto } = require('../src/routes/fotoRoutes');

const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const USUARIO = { id: 'df77cba6-4be5-4cbc-814b-1e228dd73dcc' };

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);
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

const llamarSubir = async ({ viajeId = VIAJE_ID, file } = {}) => {
  const res = crearRes();
  await fotoController.subir({ params: { viajeId }, file, body: {}, usuario: USUARIO, supabase: {} }, res);
  return res;
};

const llamarListar = async ({ viajeId = VIAJE_ID } = {}) => {
  const res = crearRes();
  await fotoController.listar({ params: { viajeId }, usuario: USUARIO, supabase: {} }, res);
  return res;
};

const esperarError = (res, codigo, codigoError) => {
  assert.equal(res.codigo, codigo);
  assert.equal(res.cuerpo.error.codigo, codigoError);
  assert.ok(res.cuerpo.error.mensaje);
};

afterEach(() => mock.restoreAll());

describe('detectarTipo (fotos)', () => {
  it('reconoce JPEG, PNG y WebP por sus primeros bytes', () => {
    assert.equal(fotoController.detectarTipo(JPEG), 'image/jpeg');
    assert.equal(fotoController.detectarTipo(PNG), 'image/png');
    assert.equal(fotoController.detectarTipo(WEBP), 'image/webp');
  });

  it('rechaza un PDF, un RIFF que no es WebP y los archivos demasiado cortos', () => {
    assert.equal(fotoController.detectarTipo(PDF), null);
    assert.equal(fotoController.detectarTipo(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVEfmt ')])), null);
    assert.equal(fotoController.detectarTipo(Buffer.from('RIFF')), null);
    assert.equal(fotoController.detectarTipo(Buffer.from([0xff, 0xd8])), null);
  });
});

describe('POST /viajes/:viajeId/fotos (subir)', () => {
  it('sube la foto y devuelve 201 con ella', async () => {
    const foto = { id: 'f1', nombre: 'coliseo.jpg', url: 'https://storage/a' };
    const subir = mock.method(fotoService, 'subir', async () => ({ estado: 'ok', foto }));

    const res = await llamarSubir({ file: { buffer: JPEG, originalname: 'coliseo.jpg' } });

    assert.equal(res.codigo, 201);
    assert.deepEqual(res.cuerpo, foto);
    const [, usuarioId, viajeId, datos] = subir.mock.calls[0].arguments;
    assert.equal(usuarioId, USUARIO.id);
    assert.equal(viajeId, VIAJE_ID);
    assert.equal(datos.nombre, 'coliseo.jpg');
    assert.equal(datos.tipoMime, 'image/jpeg');
    assert.equal(datos.buffer, JPEG);
  });

  it('recorta un nombre de archivo demasiado largo y usa «Foto» si no tiene', async () => {
    const subir = mock.method(fotoService, 'subir', async () => ({ estado: 'ok', foto: {} }));
    await llamarSubir({ file: { buffer: PNG, originalname: `${'a'.repeat(200)}.png` } });
    await llamarSubir({ file: { buffer: PNG, originalname: '   ' } });
    await llamarSubir({ file: { buffer: PNG } });
    const nombres = subir.mock.calls.map((llamada) => llamada.arguments[3].nombre);
    assert.equal(nombres[0].length, 150);
    assert.deepEqual(nombres.slice(1), ['Foto', 'Foto']);
  });

  it('devuelve 400 si el identificador del viaje no es un UUID', async () => {
    esperarError(await llamarSubir({ viajeId: 'x', file: { buffer: JPEG } }), 400, 'datos_invalidos');
  });

  it('devuelve 400 si no se adjunta archivo o está vacío', async () => {
    esperarError(await llamarSubir(), 400, 'datos_invalidos');
    esperarError(await llamarSubir({ file: { buffer: Buffer.alloc(0) } }), 400, 'datos_invalidos');
  });

  it('devuelve 400 tipo_no_permitido si el contenido no es una imagen JPEG, PNG o WebP aunque diga serlo', async () => {
    const subir = mock.method(fotoService, 'subir', async () => ({ estado: 'ok', foto: {} }));
    esperarError(await llamarSubir({ file: { buffer: PDF, originalname: 'foto.jpg' } }), 400, 'tipo_no_permitido');
    assert.equal(subir.mock.callCount(), 0);
  });

  it('devuelve 404 si el viaje no existe o no pertenece al usuario', async () => {
    mock.method(fotoService, 'subir', async () => ({ estado: 'no_existe' }));
    esperarError(await llamarSubir({ file: { buffer: JPEG } }), 404, 'viaje_no_encontrado');
  });

  it('devuelve 409 si el viaje no está activo', async () => {
    mock.method(fotoService, 'subir', async () => ({ estado: 'no_activo' }));
    esperarError(await llamarSubir({ file: { buffer: JPEG } }), 409, 'viaje_no_activo');
  });

  it('devuelve 502 si Supabase falla', async () => {
    mock.method(fotoService, 'subir', async () => ({ error: { code: 'XX000' } }));
    esperarError(await llamarSubir({ file: { buffer: JPEG } }), 502, 'error_foto');
  });

  it('devuelve 400 si la base de datos rechaza los datos (check violation)', async () => {
    mock.method(fotoService, 'subir', async () => ({ error: { code: '23514' } }));
    esperarError(await llamarSubir({ file: { buffer: JPEG } }), 400, 'datos_invalidos');
  });

  it('devuelve 500 si el servicio lanza una excepción', async () => {
    mock.method(fotoService, 'subir', async () => {
      throw new Error('fallo');
    });
    esperarError(await llamarSubir({ file: { buffer: JPEG } }), 500, 'error_interno');
  });
});

describe('GET /viajes/:viajeId/fotos (listar)', () => {
  it('devuelve 200 con las fotos', async () => {
    const fotos = [{ id: 'f1', url: 'https://storage/a' }];
    mock.method(fotoService, 'listar', async () => ({ estado: 'ok', fotos }));
    const res = await llamarListar();
    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { fotos });
  });

  it('devuelve 400 si el identificador del viaje no es un UUID', async () => {
    esperarError(await llamarListar({ viajeId: 'x' }), 400, 'datos_invalidos');
  });

  it('devuelve 404 si el viaje no existe', async () => {
    mock.method(fotoService, 'listar', async () => ({ estado: 'no_existe' }));
    esperarError(await llamarListar(), 404, 'viaje_no_encontrado');
  });

  it('devuelve 502 si Supabase falla', async () => {
    mock.method(fotoService, 'listar', async () => ({ error: { code: 'XX000' } }));
    esperarError(await llamarListar(), 502, 'error_foto');
  });

  it('devuelve 500 si el servicio lanza una excepción', async () => {
    mock.method(fotoService, 'listar', async () => {
      throw new Error('fallo');
    });
    esperarError(await llamarListar(), 500, 'error_interno');
  });
});

describe('middleware de subida de fotos (límite de 8 MB)', () => {
  const enviar = async (archivo, campo = 'archivo') => {
    const app = express();
    app.post('/', recibirFoto, (req, res) => res.status(200).json({ bytes: req.file.size, nombre: req.file.originalname }));
    const servidor = await new Promise((resolver) => {
      const s = app.listen(0, () => resolver(s));
    });
    try {
      const formulario = new FormData();
      formulario.append(campo, new Blob([archivo]), 'ñandú.jpg');
      const respuesta = await fetch(`http://127.0.0.1:${servidor.address().port}/`, { method: 'POST', body: formulario });
      return { estado: respuesta.status, cuerpo: await respuesta.json() };
    } finally {
      await new Promise((resolver) => servidor.close(resolver));
    }
  };

  it('acepta una foto pequeña y conserva las tildes del nombre', async () => {
    const { estado, cuerpo } = await enviar(JPEG);
    assert.equal(estado, 200);
    assert.equal(cuerpo.nombre, 'ñandú.jpg');
  });

  it('rechaza con 400 archivo_demasiado_grande una foto de más de 8 MB', async () => {
    const { estado, cuerpo } = await enviar(Buffer.alloc(8_000_001, 1));
    assert.equal(estado, 400);
    assert.equal(cuerpo.error.codigo, 'archivo_demasiado_grande');
  });

  it('acepta una foto de exactamente 8 MB', async () => {
    const { estado } = await enviar(Buffer.alloc(8_000_000, 1));
    assert.equal(estado, 200);
  });

  it('rechaza con 400 un archivo enviado en un campo inesperado', async () => {
    const { estado, cuerpo } = await enviar(JPEG, 'otro');
    assert.equal(estado, 400);
    assert.equal(cuerpo.error.codigo, 'datos_invalidos');
  });
});
