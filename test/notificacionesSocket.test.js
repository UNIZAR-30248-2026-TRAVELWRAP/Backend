// Pruebas de los avisos en tiempo real (namespace /notificaciones) con un servidor de Socket.io de verdad y clientes
// reales. La sesión se simula: no toca Supabase. Se ejecutan con `npm test`.
const { after, before, beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Server } = require('socket.io');
const { io: conectar } = require('socket.io-client');
const notificacionesSocket = require('../src/sockets/notificacionesSocket');

const USUARIOS = { 'token-ana': 'ana', 'token-bea': 'bea', 'token-carla': 'carla' };
const AVISO = { viaje_id: 'viaje-1', viaje_nombre: 'Roma 2027', tipo: 'gasto', pantalla: 'gastos', texto: 'Ana ha registrado un gasto: Cena' };

let servidor;
let url;
const clientes = [];

before(async () => {
  servidor = http.createServer();
  const io = new Server(servidor);
  notificacionesSocket.configurar(io.of('/notificaciones'), {
    comprobarToken: async (token) =>
      USUARIOS[token]
        ? { usuario: { id: USUARIOS[token] }, cliente: {} }
        : { error: [401, 'sesion_invalida', 'La sesión ha caducado o no es válida'] },
  });
  await new Promise((resolver) => servidor.listen(0, resolver));
  url = `http://localhost:${servidor.address().port}/notificaciones`;
});

after(async () => {
  clientes.forEach((cliente) => cliente.disconnect());
  await new Promise((resolver) => servidor.close(resolver));
});

beforeEach(() => {
  clientes.splice(0).forEach((cliente) => cliente.disconnect());
});

// Conecta con el token y devuelve el cliente y la lista de avisos que va recibiendo
const conectarse = async (token) => {
  const cliente = conectar(url, { auth: { token }, transports: ['websocket'], reconnection: false });
  clientes.push(cliente);
  const avisos = [];
  cliente.on('notificacion', (aviso) => avisos.push(aviso));
  await new Promise((resolver) => cliente.on('connect', resolver));
  return { cliente, avisos };
};

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

describe('Avisos en tiempo real (namespace /notificaciones)', () => {
  it('rechaza la conexión sin una sesión válida', async () => {
    const cliente = conectar(url, { auth: { token: 'token-falso' }, transports: ['websocket'], reconnection: false });
    clientes.push(cliente);
    const error = await new Promise((resolver) => cliente.on('connect_error', resolver));
    assert.deepEqual(error.data, { codigo: 'sesion_invalida', mensaje: 'La sesión ha caducado o no es válida' });
  });

  it('avisa solo a los usuarios de la lista', async () => {
    const ana = await conectarse('token-ana');
    const bea = await conectarse('token-bea');
    const carla = await conectarse('token-carla');

    notificacionesSocket.avisarA(['bea'], AVISO);
    await esperar(100);

    assert.deepEqual(bea.avisos, [AVISO]);
    assert.deepEqual(ana.avisos, []);
    assert.deepEqual(carla.avisos, []);
  });

  it('avisa a todos los dispositivos conectados del mismo usuario', async () => {
    const movil = await conectarse('token-bea');
    const otro = await conectarse('token-bea');

    notificacionesSocket.avisarA(['bea'], AVISO);
    await esperar(100);

    assert.equal(movil.avisos.length, 1);
    assert.equal(otro.avisos.length, 1);
  });

});
