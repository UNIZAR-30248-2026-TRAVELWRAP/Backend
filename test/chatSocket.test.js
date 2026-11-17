// Pruebas del socket del chat con un servidor de Socket.io real y clientes reales
const { after, before, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Server } = require('socket.io');
const { io: conectarCliente } = require('socket.io-client');
const chatSocket = require('../src/sockets/chatSocket');

const VIAJE_A = '123e4567-e89b-12d3-a456-426614174000';
const VIAJE_B = '223e4567-e89b-12d3-a456-426614174000';
const TOKEN_VALIDO = 'token-valido';

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

describe('Chat en tiempo real (namespace /chat)', () => {
  let servidor;
  let io;
  let url;
  const clientes = [];

  // Cliente con el token indicado. Se cierran todos al terminar
  const conectar = (token = TOKEN_VALIDO) => {
    const cliente = conectarCliente(`${url}/chat`, { auth: { token }, transports: ['websocket'], forceNew: true });
    clientes.push(cliente);
    return cliente;
  };
  const conectado = (cliente) => new Promise((resolver, rechazar) => {
    cliente.on('connect', resolver);
    cliente.on('connect_error', rechazar);
  });
  const unirse = (cliente, viajeId) =>
    new Promise((resolver) => cliente.emit('unirse_viaje', { viaje_id: viajeId }, resolver));

  before(async () => {
    servidor = http.createServer();
    io = new Server(servidor);
    await new Promise((resolver) => servidor.listen(0, resolver));
    url = `http://localhost:${servidor.address().port}`;

    chatSocket.configurar(io.of('/chat'), {
      comprobarToken: async (token) =>
        token === TOKEN_VALIDO
          ? { usuario: { id: 'u1' }, cliente: {} }
          : { error: [401, 'sesion_invalida', 'La sesión ha caducado o no es válida'] },
      // Solo es miembro del viaje A
      esMiembro: async (_cliente, _usuarioId, viajeId) => viajeId === VIAJE_A,
    });
  });

  after(async () => {
    clientes.forEach((cliente) => cliente.close());
    io.close();
    await new Promise((resolver) => servidor.close(resolver));
  });

  it('rechaza la conexión sin un token válido, con el error de la API', async () => {
    const cliente = conectar('token-malo');

    const error = await new Promise((resolver) => cliente.on('connect_error', resolver));

    assert.deepEqual(error.data, { codigo: 'sesion_invalida', mensaje: 'La sesión ha caducado o no es válida' });
  });

  it('solo se une a la sala de un viaje del que es miembro', async () => {
    const cliente = conectar();
    await conectado(cliente);

    assert.deepEqual(await unirse(cliente, VIAJE_A), { ok: true });
    assert.deepEqual(await unirse(cliente, VIAJE_B), {
      error: { codigo: 'viaje_no_encontrado', mensaje: 'El viaje no existe o no perteneces a él' },
    });
  });

  it('un identificador de viaje que no es un UUID se rechaza', async () => {
    const cliente = conectar();
    await conectado(cliente);

    const respuesta = await new Promise((resolver) => cliente.emit('unirse_viaje', { viaje_id: 'x' }, resolver));

    assert.equal(respuesta.error.codigo, 'datos_invalidos');
  });

  it('un mensaje guardado llega solo a los miembros unidos a la sala de su viaje', async () => {
    const miembro = conectar();
    const otroViaje = conectar();
    await Promise.all([conectado(miembro), conectado(otroViaje)]);
    await unirse(miembro, VIAJE_A);
    await unirse(otroViaje, VIAJE_B);
    const recibidosMiembro = [];
    const recibidosOtro = [];
    miembro.on('mensaje', (datos) => recibidosMiembro.push(datos));
    otroViaje.on('mensaje', (datos) => recibidosOtro.push(datos));

    const mensaje = { id: 'm1', texto: 'Hola', creado_en: '2026-05-12T10:00:00Z', autor: { usuario_id: 'u1', nombre: 'Adriana', avatar_url: null } };
    chatSocket.avisarMensaje(VIAJE_A, mensaje);
    await esperar(200);

    assert.deepEqual(recibidosMiembro, [{ viaje_id: VIAJE_A, mensaje }]);
    assert.deepEqual(recibidosOtro, []);
  });

  it('después de salir del viaje ya no recibe sus mensajes', async () => {
    const cliente = conectar();
    await conectado(cliente);
    await unirse(cliente, VIAJE_A);
    const recibidos = [];
    cliente.on('mensaje', (datos) => recibidos.push(datos));

    cliente.emit('salir_viaje', { viaje_id: VIAJE_A });
    await esperar(100);
    chatSocket.avisarMensaje(VIAJE_A, { id: 'm2', texto: 'Adiós' });
    await esperar(200);

    assert.deepEqual(recibidos, []);
  });
});
