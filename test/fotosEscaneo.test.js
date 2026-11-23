// Pruebas de las fotos de los tickets y documentos escaneados que se guardan con un gasto o una actividad:
// la comprobación de la ruta, el guardado al escanear, el alta con foto y el enlace para verla.
// Los servicios se sustituyen por mocks: aquí se comprueba la validación y la traducción a códigos HTTP
const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const fotoEscaneoService = require('../src/services/fotoEscaneoService');
const gastoService = require('../src/services/gastoService');
const actividadService = require('../src/services/actividadService');
const viajeService = require('../src/services/viajeService');
const gastoController = require('../src/controllers/gastoController');
const actividadController = require('../src/controllers/actividadController');

const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const OTRO_VIAJE = '9f3c2a1b-7d6e-4f5a-8b9c-0d1e2f3a4b5c';
const GASTO_ID = '5b1f0c2e-8a7d-4c3b-9e6f-2d4a1b3c5e7f';
const ACTIVIDAD_ID = 'a7b8c9d0-e1f2-4a3b-8c4d-5e6f7a8b9c0d';
const USUARIO = { id: 'df77cba6-4be5-4cbc-814b-1e228dd73dcc' };
const RUTA = `${VIAJE_ID}/escaneos/0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e.jpg`;
const RUTA_AJENA = `${OTRO_VIAJE}/escaneos/0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e.jpg`;
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(64)]);

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

const GASTO_VALIDO = { concepto: 'Cena', importe: 60, pagado_por: USUARIO.id, participantes: [USUARIO.id] };

afterEach(() => mock.restoreAll());

describe('rutaDeFotoValida', () => {
  it('acepta una foto escaneada del mismo viaje', () => {
    assert.equal(fotoEscaneoService.rutaDeFotoValida(RUTA, VIAJE_ID), true);
  });

  it('rechaza una foto de otro viaje, aunque tenga la forma correcta', () => {
    assert.equal(fotoEscaneoService.rutaDeFotoValida(RUTA_AJENA, VIAJE_ID), false);
  });

  it('rechaza rutas que no son fotos escaneadas', () => {
    assert.equal(fotoEscaneoService.rutaDeFotoValida(`${VIAJE_ID}/documentos/foto.jpg`, VIAJE_ID), false);
    assert.equal(fotoEscaneoService.rutaDeFotoValida(`${VIAJE_ID}/escaneos/../../secreto.jpg`, VIAJE_ID), false);
    assert.equal(fotoEscaneoService.rutaDeFotoValida(42, VIAJE_ID), false);
  });
});

describe('escanear guarda la foto solo si es un gasto o una actividad', () => {
  it('un ticket guarda la foto y devuelve su ruta', async () => {
    mock.method(viajeService, 'obtener', async () => ({ viaje: { id: VIAJE_ID } }));
    mock.method(require('../src/services/ocrService'), 'reconocerTexto', async () => 'Bar Sol\nTOTAL 12,50 €');
    const guardar = mock.method(fotoEscaneoService, 'guardar', async () => ({ ruta: RUTA }));
    const res = crearRes();

    await gastoController.escanear({ params: { viajeId: VIAJE_ID }, file: { buffer: JPEG }, usuario: USUARIO, supabase: {} }, res);

    assert.equal(res.codigo, 200);
    assert.equal(res.cuerpo.foto_ruta, RUTA);
    assert.equal(guardar.mock.callCount(), 1);
  });

  it('un documento que no es gasto ni actividad no guarda foto', async () => {
    mock.method(viajeService, 'obtener', async () => ({ viaje: { id: VIAJE_ID } }));
    mock.method(require('../src/services/ocrService'), 'reconocerTexto', async () => 'Póliza de seguro');
    const guardar = mock.method(fotoEscaneoService, 'guardar', async () => ({ ruta: RUTA }));
    const res = crearRes();

    await gastoController.escanear({ params: { viajeId: VIAJE_ID }, file: { buffer: JPEG }, usuario: USUARIO, supabase: {} }, res);

    assert.equal(res.cuerpo.foto_ruta, null);
    assert.equal(guardar.mock.callCount(), 0);
  });

  it('si Supabase no guarda la foto, el escaneo sigue y devuelve foto_ruta null', async () => {
    mock.method(viajeService, 'obtener', async () => ({ viaje: { id: VIAJE_ID } }));
    mock.method(require('../src/services/ocrService'), 'reconocerTexto', async () => 'Bar Sol\nTOTAL 12,50 €');
    mock.method(fotoEscaneoService, 'guardar', async () => ({ error: { message: 'fallo' } }));
    const res = crearRes();

    await gastoController.escanear({ params: { viajeId: VIAJE_ID }, file: { buffer: JPEG }, usuario: USUARIO, supabase: {} }, res);

    assert.equal(res.codigo, 200);
    assert.equal(res.cuerpo.tipo, 'gasto');
    assert.equal(res.cuerpo.foto_ruta, null);
  });
});

describe('alta de un gasto con foto', () => {
  it('pasa la foto al servicio cuando es de este viaje', async () => {
    const crear = mock.method(gastoService, 'crear', async () => ({ estado: 'ok', gasto: { id: GASTO_ID } }));
    const res = crearRes();

    await gastoController.crear({ params: { viajeId: VIAJE_ID }, body: { ...GASTO_VALIDO, foto_ruta: RUTA }, usuario: USUARIO, supabase: {} }, res);

    assert.equal(res.codigo, 201);
    assert.equal(crear.mock.calls[0].arguments[2].foto_ruta, RUTA);
  });

  it('rechaza una foto de otro viaje sin llamar al servicio', async () => {
    const crear = mock.method(gastoService, 'crear', async () => ({ estado: 'ok' }));
    const res = crearRes();

    await gastoController.crear({ params: { viajeId: VIAJE_ID }, body: { ...GASTO_VALIDO, foto_ruta: RUTA_AJENA }, usuario: USUARIO, supabase: {} }, res);

    assert.equal(res.codigo, 400);
    assert.equal(crear.mock.callCount(), 0);
  });
});

describe('enlace para ver la foto del gasto', () => {
  it('devuelve el enlace temporal cuando el gasto tiene foto', async () => {
    mock.method(gastoService, 'obtenerFoto', async () => ({ estado: 'ok', url: 'https://x/foto.jpg', expira_en: '2026-11-22T10:05:00Z' }));
    const res = crearRes();

    await gastoController.fotoUrl({ params: { viajeId: VIAJE_ID, gastoId: GASTO_ID }, usuario: USUARIO, supabase: {} }, res);

    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { url: 'https://x/foto.jpg', expira_en: '2026-11-22T10:05:00Z' });
  });

  it('responde 404 sin_foto si el gasto no tiene foto', async () => {
    mock.method(gastoService, 'obtenerFoto', async () => ({ estado: 'sin_foto' }));
    const res = crearRes();

    await gastoController.fotoUrl({ params: { viajeId: VIAJE_ID, gastoId: GASTO_ID }, usuario: USUARIO, supabase: {} }, res);

    assert.equal(res.codigo, 404);
    assert.equal(res.cuerpo.error.codigo, 'sin_foto');
  });
});

describe('enlace para ver la foto de la actividad', () => {
  it('devuelve el enlace temporal cuando la actividad tiene foto', async () => {
    mock.method(actividadService, 'obtenerFoto', async () => ({ estado: 'ok', url: 'https://x/doc.jpg', expira_en: '2026-11-22T10:05:00Z' }));
    const res = crearRes();

    await actividadController.fotoUrl({ params: { viajeId: VIAJE_ID, actividadId: ACTIVIDAD_ID }, usuario: USUARIO, supabase: {} }, res);

    assert.equal(res.codigo, 200);
    assert.equal(res.cuerpo.url, 'https://x/doc.jpg');
  });

  it('responde 404 si la actividad no existe en el viaje', async () => {
    mock.method(actividadService, 'obtenerFoto', async () => ({ estado: 'no_encontrada' }));
    const res = crearRes();

    await actividadController.fotoUrl({ params: { viajeId: VIAJE_ID, actividadId: ACTIVIDAD_ID }, usuario: USUARIO, supabase: {} }, res);

    assert.equal(res.codigo, 404);
    assert.equal(res.cuerpo.error.codigo, 'actividad_no_encontrada');
  });
});
