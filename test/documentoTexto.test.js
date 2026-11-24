// Pruebas del endpoint que guarda el resumen en texto de un documento escaneado (POST /api/viajes/:viajeId/documentos/texto).
// El servicio se sustituye por un mock: aquí se comprueban las validaciones del texto y del nombre, el .txt que se guarda
// y la traducción de cada resultado del servicio a su código HTTP.
const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const documentoService = require('../src/services/documentoService');
const documentoController = require('../src/controllers/documentoController');

const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const USUARIO = { id: 'df77cba6-4be5-4cbc-814b-1e228dd73dcc' };
const DOCUMENTO = { id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', nombre: 'Resumen escaneado.txt', tipo_mime: 'text/plain' };

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

const guardar = async ({ viajeId = VIAJE_ID, body } = {}) => {
  const req = { params: { viajeId }, body, usuario: USUARIO, supabase: {} };
  const res = crearRes();
  await documentoController.guardarTexto(req, res);
  return res;
};

afterEach(() => mock.restoreAll());

describe('guardarTexto (resumen en texto de un documento escaneado)', () => {
  it('rechaza un identificador de viaje que no es un UUID', async () => {
    const res = await guardar({ viajeId: 'no-es-un-uuid', body: { texto: 'Resumen' } });

    assert.equal(res.codigo, 400);
    assert.equal(res.cuerpo.error.codigo, 'datos_invalidos');
  });


  it('rechaza un texto que no es una cadena', async () => {
    const res = await guardar({ body: { texto: 12 } });

    assert.equal(res.codigo, 400);
  });


  it('rechaza un nombre de más de 150 caracteres', async () => {
    const res = await guardar({ body: { texto: 'Resumen', nombre: 'n'.repeat(151) } });

    assert.equal(res.codigo, 400);
    assert.equal(res.cuerpo.error.codigo, 'datos_invalidos');
  });

  it('guarda el texto como .txt en UTF-8 con el nombre por defecto', async () => {
    const subir = mock.method(documentoService, 'subir', async () => ({ estado: 'ok', documento: DOCUMENTO }));

    const res = await guardar({ body: { texto: '  Póliza de seguro\nCobertura total  ' } });

    assert.equal(res.codigo, 201);
    assert.deepEqual(res.cuerpo, DOCUMENTO);
    const [, , viajeId, datos] = subir.mock.calls[0].arguments;
    assert.equal(viajeId, VIAJE_ID);
    assert.equal(datos.nombre, 'Resumen escaneado.txt');
    assert.equal(datos.tipoMime, 'text/plain');
    assert.equal(datos.buffer.toString('utf8'), 'Póliza de seguro\nCobertura total');
  });

  it('usa el nombre indicado por quien guarda el resumen', async () => {
    const subir = mock.method(documentoService, 'subir', async () => ({ estado: 'ok', documento: DOCUMENTO }));

    await guardar({ body: { texto: 'Resumen', nombre: '  Seguro de viaje  ' } });

    assert.equal(subir.mock.calls[0].arguments[3].nombre, 'Seguro de viaje');
  });

  it('responde 404 si el viaje no existe o el usuario no es miembro', async () => {
    mock.method(documentoService, 'subir', async () => ({ estado: 'no_existe' }));

    const res = await guardar({ body: { texto: 'Resumen' } });

    assert.equal(res.codigo, 404);
    assert.equal(res.cuerpo.error.codigo, 'viaje_no_encontrado');
  });


  it('responde 502 si Supabase falla al guardar', async () => {
    mock.method(documentoService, 'subir', async () => ({ error: { message: 'fallo' } }));

    const res = await guardar({ body: { texto: 'Resumen' } });

    assert.equal(res.codigo, 502);
    assert.equal(res.cuerpo.error.codigo, 'error_documento');
  });
});
