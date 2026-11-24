// Pruebas del servicio de mensajes: historial paginado y envío. Supabase se sustituye por un cliente falso
const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const mensajeService = require('../src/services/mensajeService');
const viajeService = require('../src/services/viajeService');

const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const ADRIANA = 'df77cba6-4be5-4cbc-814b-1e228dd73dcc';
const BERTA = '5b1f0c2e-8a7d-4c3b-9e6f-2d4a1b3c5e7f';
const MIEMBROS = [
  { usuario_id: ADRIANA, nombre: 'Adriana', avatar_url: null },
  { usuario_id: BERTA, nombre: 'Berta', avatar_url: 'https://ejemplo.test/berta.jpg' },
];

// Cliente de Supabase falso: cada consulta encadenable (from().select().eq()...) se resuelve con la siguiente
// respuesta preparada. Guarda las operaciones de cada consulta para comprobarlas
const clienteFalso = (respuestas = []) => {
  const consultas = [];
  const from = (tabla) => {
    const consulta = { tabla, operaciones: [] };
    consultas.push(consulta);
    const encadenable = new Proxy(
      {},
      {
        get: (_, metodo) => {
          if (metodo === 'then') {
            const respuesta = respuestas.shift() ?? { data: [], error: null };
            return (resolver, rechazar) => Promise.resolve(respuesta).then(resolver, rechazar);
          }
          return (...args) => {
            consulta.operaciones.push([metodo, ...args]);
            return encadenable;
          };
        },
      },
    );
    return encadenable;
  };
  return { from, consultas };
};

const conViaje = (estado = 'activo') =>
  mock.method(viajeService, 'obtener', async () => ({ viaje: { id: VIAJE_ID, estado, miembros: MIEMBROS } }));

const fila = (id, texto, creadoEn, autorId = ADRIANA) => ({ id, texto, creado_en: creadoEn, autor_id: autorId });

afterEach(() => mock.restoreAll());

describe('mensajeService.listar', () => {
  it('devuelve los mensajes en orden cronológico, con el nombre y el avatar del autor', async () => {
    conViaje();
    // Supabase los pide del más reciente al más antiguo; el servicio los devuelve al revés
    const cliente = clienteFalso([{
      data: [fila('m2', 'Vale', '2026-05-12T10:01:00Z', BERTA), fila('m1', 'Hola', '2026-05-12T10:00:00Z')],
      error: null,
    }]);

    const resultado = await mensajeService.listar(cliente, ADRIANA, VIAJE_ID);

    assert.deepEqual(resultado, {
      estado: 'ok',
      mensajes: [
        { id: 'm1', texto: 'Hola', creado_en: '2026-05-12T10:00:00Z', autor: { usuario_id: ADRIANA, nombre: 'Adriana', avatar_url: null } },
        { id: 'm2', texto: 'Vale', creado_en: '2026-05-12T10:01:00Z', autor: { usuario_id: BERTA, nombre: 'Berta', avatar_url: 'https://ejemplo.test/berta.jpg' } },
      ],
    });
    assert.deepEqual(cliente.consultas[0].operaciones.at(-1), ['limit', 50]);
  });

  it('con antes pide solo los mensajes anteriores a esa fecha', async () => {
    conViaje();
    const cliente = clienteFalso([{ data: [], error: null }]);

    await mensajeService.listar(cliente, ADRIANA, VIAJE_ID, '2026-05-12T10:00:00.000Z');

    assert.deepEqual(cliente.consultas[0].operaciones.slice(-3), [
      ['lt', 'creado_en', '2026-05-12T10:00:00.000Z'],
      ['order', 'creado_en', { ascending: false }],
      ['limit', 50],
    ]);
  });

  it('un autor que ya abandonó el viaje sale sin nombre ni avatar', async () => {
    conViaje();
    const cliente = clienteFalso([{ data: [fila('m1', 'Adiós', '2026-05-12T10:00:00Z', 'otro')], error: null }]);

    const resultado = await mensajeService.listar(cliente, ADRIANA, VIAJE_ID);

    assert.deepEqual(resultado.mensajes[0].autor, { usuario_id: 'otro', nombre: null, avatar_url: null });
  });

  it('devuelve no_existe sin leer mensajes si el viaje no existe o no se es miembro', async () => {
    mock.method(viajeService, 'obtener', async () => ({ viaje: null }));
    const cliente = clienteFalso();

    assert.deepEqual(await mensajeService.listar(cliente, ADRIANA, VIAJE_ID), { estado: 'no_existe' });
    assert.equal(cliente.consultas.length, 0);
  });

});

describe('mensajeService.crear', () => {
  it('guarda el mensaje como del usuario y lo devuelve con su autor', async () => {
    conViaje();
    const cliente = clienteFalso([{ data: fila('m3', 'Hola', '2026-05-12T10:02:00Z'), error: null }]);

    const resultado = await mensajeService.crear(cliente, ADRIANA, VIAJE_ID, 'Hola');

    assert.deepEqual(cliente.consultas[0].operaciones[0], [
      'insert',
      { viaje_id: VIAJE_ID, autor_id: ADRIANA, texto: 'Hola' },
    ]);
    assert.equal(resultado.estado, 'ok');
    assert.equal(resultado.mensaje.autor.nombre, 'Adriana');
  });



});
