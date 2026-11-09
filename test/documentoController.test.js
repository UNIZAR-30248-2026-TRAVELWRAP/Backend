// Pruebas del controlador de documentos (GET y POST /api/viajes/:viajeId/documentos).
// El servicio se sustituye por un mock: aquí se comprueba la validación del archivo y la traducción
// de cada resultado del servicio a su código HTTP. El límite de tamaño lo aplica el middleware de subida,
// que se prueba con un servidor real.
const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const documentoService = require('../src/services/documentoService');
const documentoController = require('../src/controllers/documentoController');
const { recibirArchivo } = require('../src/routes/documentoRoutes');

const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const USUARIO = { id: 'df77cba6-4be5-4cbc-814b-1e228dd73dcc' };

const PDF = Buffer.from('%PDF-1.4\n%contenido de prueba');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const TEXTO = Buffer.from('esto es un texto, no un PDF');

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

const llamarSubir = async ({ viajeId = VIAJE_ID, file, body = {} } = {}) => {
  const req = { params: { viajeId }, file, body, usuario: USUARIO, supabase: {} };
  const res = crearRes();
  await documentoController.subir(req, res);
  return res;
};

const llamarListar = async ({ viajeId = VIAJE_ID } = {}) => {
  const res = crearRes();
  await documentoController.listar({ params: { viajeId }, usuario: USUARIO, supabase: {} }, res);
  return res;
};

const esperarError = (res, codigo, codigoError) => {
  assert.equal(res.codigo, codigo);
  assert.equal(res.cuerpo.error.codigo, codigoError);
  assert.ok(res.cuerpo.error.mensaje);
};

afterEach(() => mock.restoreAll());

describe('detectarTipo', () => {
  it('reconoce PDF, JPEG y PNG por sus primeros bytes', () => {
    assert.equal(documentoController.detectarTipo(PDF), 'application/pdf');
    assert.equal(documentoController.detectarTipo(PNG), 'image/png');
    assert.equal(documentoController.detectarTipo(JPEG), 'image/jpeg');
  });

  it('devuelve null con otro contenido o con un archivo demasiado corto', () => {
    assert.equal(documentoController.detectarTipo(TEXTO), null);
    assert.equal(documentoController.detectarTipo(Buffer.from('%P')), null);
  });
});

describe('POST /viajes/:viajeId/documentos (subir)', () => {
  it('sube el documento y devuelve 201 con él', async () => {
    const documento = { id: 'd1', nombre: 'billete.pdf', tipo_mime: 'application/pdf' };
    const subir = mock.method(documentoService, 'subir', async () => ({ estado: 'ok', documento }));

    const res = await llamarSubir({ file: { buffer: PDF, originalname: 'billete.pdf' } });

    assert.equal(res.codigo, 201);
    assert.deepEqual(res.cuerpo, documento);
    const [, usuarioId, viajeId, datos] = subir.mock.calls[0].arguments;
    assert.equal(usuarioId, USUARIO.id);
    assert.equal(viajeId, VIAJE_ID);
    assert.equal(datos.nombre, 'billete.pdf');
    assert.equal(datos.tipoMime, 'application/pdf');
    assert.equal(datos.buffer, PDF);
  });

  it('usa el nombre indicado en el formulario, recortado, en lugar del del archivo', async () => {
    const subir = mock.method(documentoService, 'subir', async () => ({ estado: 'ok', documento: {} }));
    await llamarSubir({ file: { buffer: PNG, originalname: 'IMG_001.png' }, body: { nombre: '  Reserva hotel ' } });
    assert.equal(subir.mock.calls[0].arguments[3].nombre, 'Reserva hotel');
    assert.equal(subir.mock.calls[0].arguments[3].tipoMime, 'image/png');
  });

  it('sin nombre usa «Documento» si el archivo tampoco tiene', async () => {
    const subir = mock.method(documentoService, 'subir', async () => ({ estado: 'ok', documento: {} }));
    await llamarSubir({ file: { buffer: JPEG, originalname: '   ' } });
    assert.equal(subir.mock.calls[0].arguments[3].nombre, 'Documento');
  });

  it('rechaza un nombre de más de 150 caracteres con 400', async () => {
    const subir = mock.method(documentoService, 'subir');
    const res = await llamarSubir({ file: { buffer: PDF, originalname: 'a.pdf' }, body: { nombre: 'x'.repeat(151) } });
    esperarError(res, 400, 'datos_invalidos');
    assert.equal(subir.mock.callCount(), 0);
  });

  it('devuelve 400 si el identificador del viaje no es un UUID', async () => {
    const res = await llamarSubir({ viajeId: 'no-es-uuid', file: { buffer: PDF, originalname: 'a.pdf' } });
    esperarError(res, 400, 'datos_invalidos');
  });

  it('devuelve 400 si no se adjunta archivo', async () => {
    const subir = mock.method(documentoService, 'subir');
    esperarError(await llamarSubir({}), 400, 'datos_invalidos');
    esperarError(await llamarSubir({ file: { buffer: Buffer.alloc(0), originalname: 'vacio.pdf' } }), 400, 'datos_invalidos');
    assert.equal(subir.mock.callCount(), 0);
  });

  it('devuelve 400 tipo_no_permitido si el contenido no es PDF/JPEG/PNG aunque diga ser un PDF', async () => {
    const subir = mock.method(documentoService, 'subir');
    const res = await llamarSubir({ file: { buffer: TEXTO, originalname: 'falso.pdf', mimetype: 'application/pdf' } });
    esperarError(res, 400, 'tipo_no_permitido');
    assert.equal(subir.mock.callCount(), 0);
  });

  it('devuelve 404 si el viaje no existe o no pertenece al usuario', async () => {
    mock.method(documentoService, 'subir', async () => ({ estado: 'no_existe' }));
    esperarError(await llamarSubir({ file: { buffer: PDF, originalname: 'a.pdf' } }), 404, 'viaje_no_encontrado');
  });

  it('devuelve 409 si el viaje no está activo', async () => {
    mock.method(documentoService, 'subir', async () => ({ estado: 'no_activo' }));
    esperarError(await llamarSubir({ file: { buffer: PDF, originalname: 'a.pdf' } }), 409, 'viaje_no_activo');
  });

  it('devuelve 502 si Supabase falla', async () => {
    mock.method(documentoService, 'subir', async () => ({ error: { code: 'XX000' } }));
    esperarError(await llamarSubir({ file: { buffer: PDF, originalname: 'a.pdf' } }), 502, 'error_documento');
  });

  it('devuelve 400 si la base de datos rechaza los datos (check violation)', async () => {
    mock.method(documentoService, 'subir', async () => ({ error: { code: '23514' } }));
    esperarError(await llamarSubir({ file: { buffer: PDF, originalname: 'a.pdf' } }), 400, 'datos_invalidos');
  });

  it('devuelve 500 si el servicio lanza una excepción', async () => {
    mock.method(documentoService, 'subir', async () => {
      throw new Error('fallo');
    });
    esperarError(await llamarSubir({ file: { buffer: PDF, originalname: 'a.pdf' } }), 500, 'error_interno');
  });
});

describe('GET /viajes/:viajeId/documentos (listar)', () => {
  it('devuelve 200 con los documentos', async () => {
    const documentos = [{ id: 'd1' }, { id: 'd2' }];
    mock.method(documentoService, 'listar', async () => ({ estado: 'ok', documentos }));
    const res = await llamarListar();
    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { documentos });
  });

  it('devuelve 400 si el identificador del viaje no es un UUID', async () => {
    esperarError(await llamarListar({ viajeId: 'x' }), 400, 'datos_invalidos');
  });

  it('devuelve 404 si el viaje no existe', async () => {
    mock.method(documentoService, 'listar', async () => ({ estado: 'no_existe' }));
    esperarError(await llamarListar(), 404, 'viaje_no_encontrado');
  });

  it('devuelve 502 si Supabase falla', async () => {
    mock.method(documentoService, 'listar', async () => ({ error: { code: 'XX000' } }));
    esperarError(await llamarListar(), 502, 'error_documento');
  });

  it('devuelve 500 si el servicio lanza una excepción', async () => {
    mock.method(documentoService, 'listar', async () => {
      throw new Error('fallo');
    });
    esperarError(await llamarListar(), 500, 'error_interno');
  });
});

describe('middleware de subida (límite de 8 MB)', () => {
  // Servidor real con solo el middleware y un controlador mínimo que responde con lo recibido
  const enviar = async (archivo, campo = 'archivo') => {
    const app = express();
    app.post('/', recibirArchivo, (req, res) => res.status(200).json({ bytes: req.file.size, nombre: req.file.originalname }));
    const servidor = await new Promise((resolver) => {
      const s = app.listen(0, () => resolver(s));
    });
    try {
      const formulario = new FormData();
      formulario.append(campo, new Blob([archivo]), 'ñandú.pdf');
      const respuesta = await fetch(`http://127.0.0.1:${servidor.address().port}/`, { method: 'POST', body: formulario });
      return { estado: respuesta.status, cuerpo: await respuesta.json() };
    } finally {
      await new Promise((resolver) => servidor.close(resolver));
    }
  };

  it('acepta un archivo pequeño y conserva las tildes del nombre', async () => {
    const { estado, cuerpo } = await enviar(PDF);
    assert.equal(estado, 200);
    assert.equal(cuerpo.nombre, 'ñandú.pdf');
  });

  it('rechaza con 400 archivo_demasiado_grande un archivo de más de 8 MB', async () => {
    const { estado, cuerpo } = await enviar(Buffer.alloc(8_000_001, 1));
    assert.equal(estado, 400);
    assert.equal(cuerpo.error.codigo, 'archivo_demasiado_grande');
  });

  it('acepta un archivo de exactamente 8 MB', async () => {
    const { estado } = await enviar(Buffer.alloc(8_000_000, 1));
    assert.equal(estado, 200);
  });

  it('rechaza con 400 un archivo enviado en un campo inesperado', async () => {
    const { estado, cuerpo } = await enviar(PDF, 'otro');
    assert.equal(estado, 400);
    assert.equal(cuerpo.error.codigo, 'datos_invalidos');
  });
});
