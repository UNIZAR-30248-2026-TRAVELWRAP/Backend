const { afterEach, beforeEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const notificacionService = require('../src/services/notificacionService');

const VIAJE = '123e4567-e89b-12d3-a456-426614174000';
const AVISO = { viaje_id: VIAJE, viaje_nombre: 'Roma 2027', tipo: 'gasto', pantalla: 'gastos', texto: 'Ana ha registrado un gasto' };
const SUSCRIPCIONES = [
  { usuario_id: 'bea', endpoint: 'https://push.test/bea', p256dh: 'p1', auth: 'a1' },
  { usuario_id: 'carla', endpoint: 'https://push.test/carla', p256dh: 'p2', auth: 'a2' },
];

// Cliente de Supabase simulado: guarda las llamadas a rpc y a la tabla
const crearCliente = ({ rpc = async () => ({ data: SUSCRIPCIONES, error: null }), tabla = {} } = {}) => {
  const llamadas = { rpc: [], upsert: [], borrados: [] };
  return {
    llamadas,
    rpc: async (nombre, parametros) => {
      llamadas.rpc.push([nombre, parametros]);
      return rpc(nombre, parametros);
    },
    from: (nombre) => {
      assert.equal(nombre, 'suscripciones_push');
      return {
        upsert: async (fila, opciones) => {
          llamadas.upsert.push([fila, opciones]);
          return { error: tabla.error ?? null };
        },
        delete: () => {
          const filtros = {};
          const consulta = {
            eq: (columna, valor) => {
              filtros[columna] = valor;
              if (Object.keys(filtros).length < 2) return consulta;
              llamadas.borrados.push({ ...filtros });
              return Promise.resolve({ error: tabla.error ?? null });
            },
          };
          return consulta;
        },
      };
    },
  };
};

const entornoOriginal = { ...process.env };
beforeEach(() => {
  process.env.VAPID_PUBLIC_KEY = 'publica';
  process.env.VAPID_PRIVATE_KEY = 'privada';
});
afterEach(() => {
  mock.restoreAll();
  process.env = { ...entornoOriginal };
});

describe('clavePublica', () => {
  it('devuelve la clave VAPID configurada', () => {
    assert.equal(notificacionService.clavePublica(), 'publica');
  });

  it('devuelve null si faltan las claves', () => {
    delete process.env.VAPID_PRIVATE_KEY;
    assert.equal(notificacionService.clavePublica(), null);
  });
});

describe('suscribir y cancelar', () => {
  it('guarda la suscripción del usuario, actualizándola si el endpoint ya existe', async () => {
    const cliente = crearCliente();
    const resultado = await notificacionService.suscribir(cliente, 'ana', { endpoint: 'https://push.test/ana', p256dh: 'p', auth: 'a' });

    assert.deepEqual(resultado, { estado: 'ok' });
    assert.deepEqual(cliente.llamadas.upsert, [
      [{ usuario_id: 'ana', endpoint: 'https://push.test/ana', p256dh: 'p', auth: 'a' }, { onConflict: 'endpoint' }],
    ]);
  });

  it('devuelve el error de Supabase al suscribir', async () => {
    const cliente = crearCliente({ tabla: { error: { code: 'X' } } });
    const resultado = await notificacionService.suscribir(cliente, 'ana', { endpoint: 'e', p256dh: 'p', auth: 'a' });
    assert.deepEqual(resultado, { error: { code: 'X' } });
  });

  it('borra solo la suscripción del usuario con ese endpoint', async () => {
    const cliente = crearCliente();
    const resultado = await notificacionService.cancelar(cliente, 'ana', 'https://push.test/ana');

    assert.deepEqual(resultado, { estado: 'ok' });
    assert.deepEqual(cliente.llamadas.borrados, [{ usuario_id: 'ana', endpoint: 'https://push.test/ana' }]);
  });
});

describe('enviarPush', () => {
  it('envía la notificación a las suscripciones de los demás miembros', async () => {
    const envio = mock.method(notificacionService.envio, 'enviar', async () => ({}));
    const cliente = crearCliente();

    await notificacionService.enviarPush(cliente, VIAJE, AVISO);

    assert.deepEqual(cliente.llamadas.rpc, [['suscripciones_push_del_viaje', { p_viaje_id: VIAJE }]]);
    assert.equal(envio.mock.callCount(), 2);
    assert.deepEqual(envio.mock.calls[0].arguments, [
      { endpoint: 'https://push.test/bea', keys: { p256dh: 'p1', auth: 'a1' } },
      JSON.stringify(AVISO),
      { publica: 'publica', privada: 'privada', contacto: 'mailto:travelwrap@example.com' },
    ]);
  });

  it('no hace nada sin claves VAPID', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    const envio = mock.method(notificacionService.envio, 'enviar', async () => ({}));
    const cliente = crearCliente();

    await notificacionService.enviarPush(cliente, VIAJE, AVISO);

    assert.equal(envio.mock.callCount(), 0);
    assert.deepEqual(cliente.llamadas.rpc, []);
  });


  it('borra la suscripción caducada (410) y sigue con las demás', async () => {
    const envio = mock.method(notificacionService.envio, 'enviar', async (suscripcion) => {
      if (suscripcion.endpoint.endsWith('/bea')) throw Object.assign(new Error('gone'), { statusCode: 410 });
      return {};
    });
    const cliente = crearCliente();

    await notificacionService.enviarPush(cliente, VIAJE, AVISO);

    assert.equal(envio.mock.callCount(), 2);
    assert.deepEqual(cliente.llamadas.rpc[1], ['borrar_suscripcion_caducada', { p_endpoint: 'https://push.test/bea' }]);
  });

});
