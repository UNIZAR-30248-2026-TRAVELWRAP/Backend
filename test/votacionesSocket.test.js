// Pruebas del tiempo real de las votaciones con un servidor de Socket.io de verdad y clientes reales.
// La sesión y la pertenencia al viaje se simulan: no tocan Supabase. Se ejecutan con `npm test`.
const { after, before, beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Server } = require('socket.io');
const { io: conectar } = require('socket.io-client');
const votacionesSocket = require('../src/sockets/votacionesSocket');

const VIAJE = '123e4567-e89b-12d3-a456-426614174000';
const OTRO_VIAJE = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
const VOTACION = '6f1c2d3e-0000-4000-8000-000000000010';

// Usuarios por token y viajes de los que es miembro cada uno
const USUARIOS = { 'token-ana': 'ana', 'token-bea': 'bea', 'token-carla': 'carla' };
const MIEMBROS = { [VIAJE]: ['ana', 'bea'], [OTRO_VIAJE]: ['carla'] };

let servidor;
let url;
const clientes = [];

before(async () => {
  servidor = http.createServer();
  const io = new Server(servidor);
  votacionesSocket.configurar(io.of('/votaciones'), {
    comprobarToken: async (token) =>
      USUARIOS[token]
        ? { usuario: { id: USUARIOS[token] }, cliente: {} }
        : { error: [401, 'sesion_invalida', 'La sesión ha caducado o no es válida'] },
    esMiembro: async (_cliente, usuarioId, viajeId) => (MIEMBROS[viajeId] ?? []).includes(usuarioId),
  });
  await new Promise((resolver) => servidor.listen(0, resolver));
  url = `http://localhost:${servidor.address().port}/votaciones`;
});

after(async () => {
  clientes.forEach((cliente) => cliente.disconnect());
  await new Promise((resolver) => servidor.close(resolver));
});

beforeEach(() => {
  clientes.splice(0).forEach((cliente) => cliente.disconnect());
});

const nuevoCliente = (token) => {
  const cliente = conectar(url, { auth: { token }, transports: ['websocket'], reconnection: false });
  clientes.push(cliente);
  return cliente;
};

// Se conecta y se une al viaje. Devuelve el cliente y la respuesta de «unirse_viaje»
const unirse = async (token, viajeId) => {
  const cliente = nuevoCliente(token);
  const respuesta = await cliente.emitWithAck('unirse_viaje', { viaje_id: viajeId });
  return { cliente, respuesta };
};

// Cambios recibidos por un cliente
const recibidos = (cliente) => {
  const lista = [];
  cliente.on('votacion_cambiada', (cambio) => lista.push(cambio));
  return lista;
};

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

describe('Votaciones en tiempo real (namespace /votaciones)', () => {
  it('rechaza la conexión sin una sesión válida', async () => {
    const cliente = nuevoCliente('token-falso');
    const error = await new Promise((resolver) => cliente.on('connect_error', resolver));
    assert.deepEqual(error.data, { codigo: 'sesion_invalida', mensaje: 'La sesión ha caducado o no es válida' });
  });

  it('un miembro se une a la sala de su viaje', async () => {
    const { respuesta } = await unirse('token-ana', VIAJE);
    assert.deepEqual(respuesta, { ok: true });
  });

  it('quien no es miembro no puede unirse al viaje', async () => {
    const { respuesta } = await unirse('token-carla', VIAJE);
    assert.equal(respuesta.error.codigo, 'viaje_no_encontrado');
  });

  it('un identificador de viaje mal formado se rechaza', async () => {
    const { respuesta } = await unirse('token-ana', 'roma');
    assert.equal(respuesta.error.codigo, 'datos_invalidos');
  });

  it('avisa del cambio a todos los miembros unidos al viaje, y solo a ellos', async () => {
    const ana = recibidos((await unirse('token-ana', VIAJE)).cliente);
    const bea = recibidos((await unirse('token-bea', VIAJE)).cliente);
    const carla = recibidos((await unirse('token-carla', OTRO_VIAJE)).cliente);

    votacionesSocket.avisarCambio(VIAJE, { votacion_id: VOTACION, motivo: 'voto' });
    await esperar(100);

    const esperado = { viaje_id: VIAJE, votacion_id: VOTACION, motivo: 'voto' };
    assert.deepEqual(ana, [esperado]);
    assert.deepEqual(bea, [esperado]);
    assert.deepEqual(carla, []);
  });

  it('al cerrar la votación de destino el aviso lleva el destino', async () => {
    const ana = recibidos((await unirse('token-ana', VIAJE)).cliente);

    votacionesSocket.avisarCambio(VIAJE, { votacion_id: VOTACION, motivo: 'cerrada', destino: 'Praga' });
    await esperar(100);

    assert.deepEqual(ana, [{ viaje_id: VIAJE, votacion_id: VOTACION, motivo: 'cerrada', destino: 'Praga' }]);
  });

  it('quien sale del viaje deja de recibir avisos', async () => {
    const { cliente } = await unirse('token-ana', VIAJE);
    const ana = recibidos(cliente);
    cliente.emit('salir_viaje', { viaje_id: VIAJE });
    await esperar(50);

    votacionesSocket.avisarCambio(VIAJE, { votacion_id: VOTACION, motivo: 'voto' });
    await esperar(100);

    assert.deepEqual(ana, []);
  });

  it('no emite motivos desconocidos', async () => {
    const ana = recibidos((await unirse('token-ana', VIAJE)).cliente);

    votacionesSocket.avisarCambio(VIAJE, { votacion_id: VOTACION, motivo: 'borrada' });
    await esperar(100);

    assert.deepEqual(ana, []);
  });
});
