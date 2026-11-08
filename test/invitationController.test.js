// Pruebas del controlador de invitaciones con el servicio simulado. No tocan la red ni la base de datos real.
const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const invitationService = require('../src/services/invitationService');
const invitationController = require('../src/controllers/invitationController');
const votacionesSocket = require('../src/sockets/votacionesSocket');

const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const TOKEN = '3f2b8c1d9e7a4f60b5d2c8a1e9f04b37';

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

const unirse = async (token = TOKEN) => {
  const res = crearRes();
  await invitationController.unirse({ params: { token }, supabase: {}, usuario: { id: 'u1' } }, res);
  return res;
};

const unido = (yaEraMiembro) => ({
  estado: 'ok',
  ya_era_miembro: yaEraMiembro,
  viaje: { id: VIAJE_ID, nombre: 'Roma 2027', destino: null, imagen_portada_url: null },
  miembro: { rol: 'miembro', unido_en: '2026-10-28T10:00:00Z' },
});

afterEach(() => mock.restoreAll());

describe('POST /invitaciones/:token/unirse', () => {
  it('al unirse un miembro nuevo responde con el viaje y avisa en tiempo real a los del viaje', async () => {
    mock.method(invitationService, 'unirse', async () => unido(false));
    const avisar = mock.method(votacionesSocket, 'avisarCambio', () => {});

    const res = await unirse();

    assert.equal(res.codigo, 200);
    assert.equal(res.cuerpo.viaje.id, VIAJE_ID);
    assert.deepEqual(avisar.mock.calls[0].arguments, [VIAJE_ID, { motivo: 'miembros' }]);
  });

  it('si ya era miembro no avisa, porque no cambia nada', async () => {
    mock.method(invitationService, 'unirse', async () => unido(true));
    const avisar = mock.method(votacionesSocket, 'avisarCambio', () => {});

    const res = await unirse();

    assert.equal(res.codigo, 200);
    assert.equal(res.cuerpo.ya_era_miembro, true);
    assert.equal(avisar.mock.callCount(), 0);
  });

  it('si no se puede unir no avisa', async () => {
    mock.method(invitationService, 'unirse', async () => ({ estado: 'viaje_no_activo' }));
    const avisar = mock.method(votacionesSocket, 'avisarCambio', () => {});

    const res = await unirse();

    assert.equal(res.codigo, 409);
    assert.equal(avisar.mock.callCount(), 0);
  });

  it('un token mal formado responde 404 sin llamar al servicio', async () => {
    const servicio = mock.method(invitationService, 'unirse', async () => unido(false));

    const res = await unirse('no-es-un-token');

    assert.equal(res.codigo, 404);
    assert.equal(servicio.mock.callCount(), 0);
  });
});
