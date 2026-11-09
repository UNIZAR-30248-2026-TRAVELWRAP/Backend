const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { crearEnrutador } = require('../src/services/enrutadorService');

const PUNTOS = [
  { latitud: 41.890214, longitud: 12.492231 },
  { latitud: 41.892462, longitud: 12.485325 },
];

const RESPUESTA_OK = {
  code: 'Ok',
  routes: [
    {
      distance: 812.4,
      duration: 590.6,
      geometry: {
        coordinates: [
          [12.492231, 41.890214],
          [12.49, 41.8911],
          [12.49, 41.8911],
          [12.485325, 41.892462],
        ],
      },
    },
  ],
};

const respuesta = (cuerpo, estado = 200) => ({
  status: estado,
  ok: estado >= 200 && estado < 300,
  json: async () => cuerpo,
});

const montar = (opciones = {}) => {
  const llamadas = [];
  let instante = 1_000_000;
  const pausas = [];
  const enrutador = crearEnrutador({
    peticion: async (url, init) => {
      llamadas.push({ url, init });
      return (opciones.responder ?? (() => respuesta(RESPUESTA_OK)))(url, init);
    },
    ahora: () => instante,
    pausa: async (ms) => {
      pausas.push(ms);
      instante += ms;
    },
    url: 'https://rutas.prueba/route/v1/driving',
    userAgent: 'TravelWrap/1.0 (prueba@unizar.es)',
    ...opciones.config,
  });
  return {
    enrutador,
    llamadas,
    pausas,
    avanzar: (ms) => {
      instante += ms;
    },
  };
};

describe('enrutadorService.trazar', () => {
  it('pide la ruta con las coordenadas en orden longitud,latitud y el User-Agent', async () => {
    const { enrutador, llamadas } = montar();

    await enrutador.trazar(PUNTOS, 'u1');

    assert.equal(llamadas.length, 1);
    assert.equal(
      llamadas[0].url,
      'https://rutas.prueba/route/v1/driving/12.492231,41.890214;12.485325,41.892462?overview=full&geometries=geojson&steps=false',
    );
    assert.equal(llamadas[0].init.headers['User-Agent'], 'TravelWrap/1.0 (prueba@unizar.es)');
  });

  it('devuelve distancia y duración redondeadas y la geometría como latitud,longitud sin puntos repetidos', async () => {
    const { enrutador } = montar();

    const resultado = await enrutador.trazar(PUNTOS, 'u1');

    assert.deepEqual(resultado, {
      estado: 'ok',
      ruta: {
        distancia_m: 812,
        duracion_s: 591,
        geometria: [
          [41.89021, 12.49223],
          [41.8911, 12.49],
          [41.89246, 12.48533],
        ],
      },
    });
  });

  it('no repite la llamada si la misma ruta está en la caché', async () => {
    const { enrutador, llamadas, avanzar } = montar();

    await enrutador.trazar(PUNTOS, 'u1');
    avanzar(5000);
    const segunda = await enrutador.trazar(PUNTOS, 'u2');

    assert.equal(llamadas.length, 1);
    assert.equal(segunda.estado, 'ok');
  });

  it('vuelve a pedir la ruta cuando la caché ha caducado', async () => {
    const { enrutador, llamadas, avanzar } = montar();

    await enrutador.trazar(PUNTOS, 'u1');
    avanzar(11 * 60 * 1000);
    await enrutador.trazar(PUNTOS, 'u1');

    assert.equal(llamadas.length, 2);
  });

  it('rechaza con demasiado_rapido al mismo usuario dentro del mismo segundo', async () => {
    const { enrutador, llamadas } = montar();

    await enrutador.trazar(PUNTOS, 'u1');
    const segunda = await enrutador.trazar([PUNTOS[1], PUNTOS[0]], 'u1');

    assert.deepEqual(segunda, { estado: 'demasiado_rapido' });
    assert.equal(llamadas.length, 1);
  });

  it('espera un segundo entre las llamadas de distintos usuarios', async () => {
    const { enrutador, pausas } = montar();

    await enrutador.trazar(PUNTOS, 'u1');
    await enrutador.trazar([PUNTOS[1], PUNTOS[0]], 'u2');

    assert.deepEqual(pausas, [1000]);
  });

  it('devuelve ocupado si hay demasiadas peticiones pendientes', async () => {
    let liberar;
    const bloqueo = new Promise((resolver) => {
      liberar = resolver;
    });
    const { enrutador } = montar({ responder: async () => (await bloqueo, respuesta(RESPUESTA_OK)) });

    const pendientes = [];
    for (let i = 0; i < 5; i += 1) {
      pendientes.push(enrutador.trazar([{ latitud: 41 + i, longitud: 12 }, PUNTOS[1]], `u${i}`));
    }
    const sexta = await enrutador.trazar([{ latitud: 50, longitud: 12 }, PUNTOS[1]], 'u6');
    liberar();
    await Promise.all(pendientes);

    assert.deepEqual(sexta, { estado: 'ocupado' });
  });

  it('devuelve ocupado si el servicio responde 429', async () => {
    const { enrutador } = montar({ responder: () => respuesta({}, 429) });

    assert.deepEqual(await enrutador.trazar(PUNTOS, 'u1'), { estado: 'ocupado' });
  });

  it('devuelve sin_ruta si el servicio no encuentra camino, con 200 o con 400', async () => {
    const con200 = montar({ responder: () => respuesta({ code: 'NoRoute' }) });
    const con400 = montar({ responder: () => respuesta({ code: 'NoSegment' }, 400) });

    assert.deepEqual(await con200.enrutador.trazar(PUNTOS, 'u1'), { estado: 'sin_ruta' });
    assert.deepEqual(await con400.enrutador.trazar(PUNTOS, 'u1'), { estado: 'sin_ruta' });
  });

  it('devuelve error si el servicio responde con un fallo, con datos no válidos o sin conexión', async () => {
    const fallo = montar({ responder: () => respuesta({}, 500) });
    const vacia = montar({ responder: () => respuesta({ code: 'Ok', routes: [] }) });
    const caida = montar({
      responder: () => {
        throw new TypeError('fetch failed');
      },
    });

    assert.deepEqual(await fallo.enrutador.trazar(PUNTOS, 'u1'), { error: { code: 'http_500' } });
    assert.deepEqual(await vacia.enrutador.trazar(PUNTOS, 'u1'), { error: { code: 'respuesta_no_valida' } });
    assert.deepEqual(await caida.enrutador.trazar(PUNTOS, 'u1'), { error: { code: 'sin_conexion' } });
  });

  it('devuelve error por tiempo agotado si el servicio no responde a tiempo', async () => {
    const { enrutador } = montar({
      config: { tiempoMaximoMs: 5 },
      responder: (_url, init) =>
        new Promise((_resolver, rechazar) => {
          init.signal.addEventListener('abort', () => rechazar(Object.assign(new Error('abortado'), { name: 'AbortError' })));
        }),
    });

    assert.deepEqual(await enrutador.trazar(PUNTOS, 'u1'), { error: { code: 'tiempo_agotado' } });
  });

  it('no guarda en la caché los fallos', async () => {
    let intento = 0;
    const { enrutador, llamadas, avanzar } = montar({
      responder: () => (intento++ === 0 ? respuesta({}, 500) : respuesta(RESPUESTA_OK)),
    });

    await enrutador.trazar(PUNTOS, 'u1');
    avanzar(2000);
    const segunda = await enrutador.trazar(PUNTOS, 'u1');

    assert.equal(segunda.estado, 'ok');
    assert.equal(llamadas.length, 2);
  });

  it('reduce las geometrías muy largas conservando el primer y el último punto', async () => {
    const coordenadas = Array.from({ length: 5000 }, (_, i) => [12 + i * 0.0001, 41 + i * 0.0001]);
    const { enrutador } = montar({
      responder: () => respuesta({ code: 'Ok', routes: [{ distance: 9000, duration: 7000, geometry: { coordinates: coordenadas } }] }),
    });

    const { ruta } = await enrutador.trazar(PUNTOS, 'u1');

    assert.ok(ruta.geometria.length <= 2001);
    assert.deepEqual(ruta.geometria[0], [41, 12]);
    assert.deepEqual(ruta.geometria[ruta.geometria.length - 1], [41.4999, 12.4999]);
  });
});
