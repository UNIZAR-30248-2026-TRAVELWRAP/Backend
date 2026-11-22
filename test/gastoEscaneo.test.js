// Pruebas del endpoint de escaneo de tickets (POST /api/viajes/:viajeId/gastos/escaneo).
// El OCR y la consulta del viaje se sustituyen por mocks: aquí se comprueba la validación de la foto,
// la traducción de cada resultado a su código HTTP y que no se guarda nada
const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const viajeService = require('../src/services/viajeService');
const ocrService = require('../src/services/ocrService');
const gastoController = require('../src/controllers/gastoController');

const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const USUARIO = { id: 'df77cba6-4be5-4cbc-814b-1e228dd73dcc' };

// Cabeceras de un JPEG y de un PNG reales, seguidas de relleno: lo que se reconoce es el tipo por la firma
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(64)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

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

// Llama al controlador como lo haría Express tras la subida del archivo
const escanear = async ({ viajeId = VIAJE_ID, archivo } = {}) => {
  const req = { params: { viajeId }, file: archivo, usuario: USUARIO, supabase: {} };
  const res = crearRes();
  await gastoController.escanear(req, res);
  return res;
};

const viajeExiste = () => mock.method(viajeService, 'obtener', async () => ({ viaje: { id: VIAJE_ID } }));

afterEach(() => mock.restoreAll());

describe('escanear (foto de un ticket)', () => {
  it('rechaza el envío sin archivo', async () => {
    const res = await escanear({ archivo: undefined });

    assert.equal(res.codigo, 400);
    assert.equal(res.cuerpo.error.codigo, 'datos_invalidos');
  });

  it('rechaza un archivo que no es JPEG ni PNG aunque diga serlo', async () => {
    const pdf = Buffer.from('%PDF-1.4 texto');

    const res = await escanear({ archivo: { buffer: pdf, originalname: 'ticket.jpg' } });

    assert.equal(res.codigo, 400);
    assert.equal(res.cuerpo.error.codigo, 'tipo_no_permitido');
  });

  it('rechaza un identificador de viaje que no es un UUID', async () => {
    const res = await escanear({ viajeId: 'no-es-un-uuid', archivo: { buffer: JPEG } });

    assert.equal(res.codigo, 400);
    assert.equal(res.cuerpo.error.codigo, 'datos_invalidos');
  });

  it('responde 404 si el viaje no existe o el usuario no es miembro', async () => {
    mock.method(viajeService, 'obtener', async () => ({ viaje: null }));
    const ocr = mock.method(ocrService, 'reconocerTexto', async () => '');

    const res = await escanear({ archivo: { buffer: JPEG } });

    assert.equal(res.codigo, 404);
    assert.equal(res.cuerpo.error.codigo, 'viaje_no_encontrado');
    assert.equal(ocr.mock.callCount(), 0, 'no se lee la imagen de un viaje que no es suyo');
  });

  it('responde 502 si el OCR falla', async () => {
    viajeExiste();
    mock.method(ocrService, 'reconocerTexto', async () => {
      throw new Error('motor no disponible');
    });

    const res = await escanear({ archivo: { buffer: PNG } });

    assert.equal(res.codigo, 502);
    assert.equal(res.cuerpo.error.codigo, 'error_ocr');
  });

  it('devuelve el concepto y el importe reconocidos sin guardar nada', async () => {
    viajeExiste();
    mock.method(ocrService, 'reconocerTexto', async () => 'Bar Sol\nTOTAL 12,50 €');

    const res = await escanear({ archivo: { buffer: JPEG } });

    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { concepto: 'Bar Sol', importe: 12.5 });
  });

  it('devuelve null en los campos que no reconoce en lugar de fallar', async () => {
    viajeExiste();
    mock.method(ocrService, 'reconocerTexto', async () => '');

    const res = await escanear({ archivo: { buffer: PNG } });

    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { concepto: null, importe: null });
  });
});
