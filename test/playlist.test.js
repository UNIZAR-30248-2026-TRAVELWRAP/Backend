// Pruebas de la playlist del viaje (PB-56): la comprobación del enlace de Spotify y el controlador
// (el servicio se sustituye por un mock)
const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const { normalizarPlaylist } = require('../src/utils/playlist');
const playlistService = require('../src/services/playlistService');
const playlistController = require('../src/controllers/playlistController');

const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const USUARIO = { id: 'df77cba6-4be5-4cbc-814b-1e228dd73dcc' };
const ID = '37i9dQZF1DXcBWIGoYBM5M';
const CANONICO = `https://open.spotify.com/playlist/${ID}`;

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

afterEach(() => mock.restoreAll());

describe('normalizarPlaylist', () => {
  it('acepta el enlace web de una playlist y lo deja en su forma canónica', () => {
    assert.deepEqual(normalizarPlaylist(`https://open.spotify.com/playlist/${ID}`), { valor: CANONICO });
  });

  it('quita los parámetros de compartir y el idioma del enlace', () => {
    assert.deepEqual(normalizarPlaylist(`https://open.spotify.com/intl-es/playlist/${ID}?si=abc123`), { valor: CANONICO });
  });

  it('acepta el formato spotify:playlist:', () => {
    assert.deepEqual(normalizarPlaylist(`spotify:playlist:${ID}`), { valor: CANONICO });
  });

  it('rechaza enlaces que no son de una playlist de Spotify', () => {
    assert.ok(normalizarPlaylist('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC').error);
    assert.ok(normalizarPlaylist('https://www.youtube.com/playlist?list=PL123').error);
    assert.ok(normalizarPlaylist('https://open.spotify.com.evil.com/playlist/' + ID).error);
    assert.ok(normalizarPlaylist('').error);
    assert.ok(normalizarPlaylist(42).error);
  });
});

describe('controlador de la playlist', () => {
  it('devuelve la playlist del viaje', async () => {
    mock.method(playlistService, 'obtener', async () => ({ estado: 'ok', playlist: { url: CANONICO, actualizado_en: '2026-11-22T10:00:00Z' } }));
    const res = crearRes();

    await playlistController.obtener({ params: { viajeId: VIAJE_ID }, usuario: USUARIO, supabase: {} }, res);

    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { playlist: { url: CANONICO, actualizado_en: '2026-11-22T10:00:00Z' } });
  });

  it('devuelve playlist null si el viaje no tiene ninguna', async () => {
    mock.method(playlistService, 'obtener', async () => ({ estado: 'ok', playlist: null }));
    const res = crearRes();

    await playlistController.obtener({ params: { viajeId: VIAJE_ID }, usuario: USUARIO, supabase: {} }, res);

    assert.deepEqual(res.cuerpo, { playlist: null });
  });

  it('rechaza un enlace que no es de Spotify sin llamar al servicio', async () => {
    const guardar = mock.method(playlistService, 'guardar', async () => ({ estado: 'ok' }));
    const res = crearRes();

    await playlistController.guardar({ params: { viajeId: VIAJE_ID }, body: { url: 'https://example.com' }, usuario: USUARIO, supabase: {} }, res);

    assert.equal(res.codigo, 400);
    assert.equal(res.cuerpo.error.codigo, 'datos_invalidos');
    assert.equal(guardar.mock.callCount(), 0);
  });

  it('guarda el enlace ya normalizado', async () => {
    const guardar = mock.method(playlistService, 'guardar', async () => ({ estado: 'ok', playlist: { url: CANONICO, actualizado_en: 'x' } }));
    const res = crearRes();

    await playlistController.guardar(
      { params: { viajeId: VIAJE_ID }, body: { url: `https://open.spotify.com/intl-es/playlist/${ID}?si=1` }, usuario: USUARIO, supabase: {} },
      res,
    );

    assert.equal(res.codigo, 200);
    assert.equal(guardar.mock.calls[0].arguments[3], CANONICO);
  });

  it('responde 409 si el viaje está finalizado', async () => {
    mock.method(playlistService, 'guardar', async () => ({ estado: 'no_activo' }));
    const res = crearRes();

    await playlistController.guardar({ params: { viajeId: VIAJE_ID }, body: { url: CANONICO }, usuario: USUARIO, supabase: {} }, res);

    assert.equal(res.codigo, 409);
    assert.equal(res.cuerpo.error.codigo, 'viaje_no_activo');
  });

  it('quita la playlist con 204', async () => {
    mock.method(playlistService, 'quitar', async () => ({ estado: 'ok' }));
    const res = crearRes();

    await playlistController.quitar({ params: { viajeId: VIAJE_ID }, usuario: USUARIO, supabase: {} }, res);

    assert.equal(res.codigo, 204);
  });
});
