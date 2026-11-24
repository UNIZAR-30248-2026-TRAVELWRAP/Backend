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
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(8)]);
const MOV = Buffer.concat([Buffer.from([0, 0, 0, 0x14]), Buffer.from('ftypqt  '), Buffer.alloc(8)]);
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f]), Buffer.from('B\x82\x84webm'), Buffer.alloc(8)]);

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

describe('detectarTipo (vídeos)', () => {
  it('reconoce MP4, MOV y WebM por su contenido', () => {
    assert.equal(fotoController.detectarTipo(MP4), 'video/mp4');
    assert.equal(fotoController.detectarTipo(MOV), 'video/quicktime');
    assert.equal(fotoController.detectarTipo(WEBM), 'video/webm');
  });

});

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


  it('devuelve 502 si Supabase falla', async () => {
    mock.method(fotoService, 'subir', async () => ({ error: { code: 'XX000' } }));
    esperarError(await llamarSubir({ file: { buffer: JPEG } }), 502, 'error_foto');
  });


  it('devuelve 500 si el servicio lanza una excepción', async () => {
    mock.method(fotoService, 'subir', async () => {
      throw new Error('fallo');
    });
    esperarError(await llamarSubir({ file: { buffer: JPEG } }), 500, 'error_interno');
  });
});

describe('POST /viajes/:viajeId/fotos (vídeos y límites)', () => {
  it('sube un vídeo reconocido por su contenido y lo llama «Vídeo» si no tiene nombre', async () => {
    const subir = mock.method(fotoService, 'subir', async () => ({ estado: 'ok', foto: { id: 'v1' } }));
    const res = await llamarSubir({ file: { buffer: MP4, originalname: '' } });

    assert.equal(res.codigo, 201);
    assert.equal(subir.mock.calls[0].arguments[3].tipoMime, 'video/mp4');
    assert.equal(subir.mock.calls[0].arguments[3].nombre, 'Vídeo');
  });

  it('una foto de más de 8 MB se rechaza aunque un vídeo del mismo tamaño se admita', async () => {
    const subir = mock.method(fotoService, 'subir', async () => ({ estado: 'ok', foto: { id: 'x' } }));
    const grande = (cabecera) => Buffer.concat([cabecera, Buffer.alloc(8_000_001, 1)]);

    esperarError(await llamarSubir({ file: { buffer: grande(JPEG), originalname: 'a.jpg' } }), 400, 'archivo_demasiado_grande');
    assert.equal(subir.mock.calls.length, 0);
    assert.equal((await llamarSubir({ file: { buffer: grande(MP4), originalname: 'a.mp4' } })).codigo, 201);
  });

});

describe('DELETE /viajes/:viajeId/fotos/:fotoId (eliminar)', () => {
  const FOTO_ID = '5b1f0c2e-8a7d-4c3b-9e6f-2d4a1b3c5e7f';
  const llamarEliminar = async ({ viajeId = VIAJE_ID, fotoId = FOTO_ID } = {}) => {
    const res = { ...crearRes(), end() { this.terminado = true; return this; } };
    await fotoController.eliminar({ params: { viajeId, fotoId }, usuario: USUARIO, supabase: {} }, res);
    return res;
  };

  it('borra la foto y devuelve 204', async () => {
    const eliminar = mock.method(fotoService, 'eliminar', async () => ({ estado: 'ok' }));
    const res = await llamarEliminar();

    assert.equal(res.codigo, 204);
    assert.equal(res.terminado, true);
    assert.deepEqual(eliminar.mock.calls[0].arguments.slice(1), [USUARIO.id, VIAJE_ID, FOTO_ID]);
  });



});

describe('GET /viajes/:viajeId/fotos (listar)', () => {
  it('devuelve 200 con las fotos', async () => {
    const fotos = [{ id: 'f1', url: 'https://storage/a' }];
    const almacenamiento = { usado_bytes: 1500, limite_bytes: 200_000_000 };
    mock.method(fotoService, 'listar', async () => ({ estado: 'ok', fotos, almacenamiento }));
    const res = await llamarListar();
    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { fotos, almacenamiento });
  });

  it('devuelve 400 si el identificador del viaje no es un UUID', async () => {
    esperarError(await llamarListar({ viajeId: 'x' }), 400, 'datos_invalidos');
  });



});

describe('middleware de subida (límite de 50 MB por archivo)', () => {
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


  it('rechaza con 400 archivo_demasiado_grande un archivo de más de 50 MB', async () => {
    const { estado, cuerpo } = await enviar(Buffer.alloc(50_000_001, 1));
    assert.equal(estado, 400);
    assert.equal(cuerpo.error.codigo, 'archivo_demasiado_grande');
  });


});
