const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const geocodificacionService = require('../src/services/geocodificacionService');

const { crearGeocodificador } = geocodificacionService;

const COLISEO = {
  place_id: 1,
  osm_type: 'way',
  osm_id: 24146600,
  lat: '41.8902142',
  lon: '12.4922309',
  display_name: 'Colosseo, Piazza del Colosseo, Municipio I, Roma, Lazio, 00184, Italia',
};

const respuestaDe = (cuerpo, estado = 200) => ({
  status: estado,
  ok: estado >= 200 && estado < 300,
  json: async () => cuerpo,
});

const montar = (respuestas = [respuestaDe([COLISEO])], opciones = {}) => {
  const llamadas = [];
  const esperas = [];
  const reloj = { ahora: 1_000_000 };
  const peticion = async (url, parametros) => {
    llamadas.push({ url: new URL(url), cabeceras: parametros.headers, signal: parametros.signal });
    const siguiente = respuestas.length > 1 ? respuestas.shift() : respuestas[0];
    if (typeof siguiente === 'function') return siguiente(parametros);
    return siguiente;
  };
  const geocodificador = crearGeocodificador({
    peticion,
    ahora: () => reloj.ahora,
    pausa: async (milisegundos) => {
      esperas.push(milisegundos);
      reloj.ahora += milisegundos;
    },
    userAgent: 'TravelWrap/pruebas (equipo@travelwrap.app)',
    ...opciones,
  });
  return { geocodificador, llamadas, esperas, reloj };
};

describe('geocodificacionService · petición a Nominatim', () => {
  it('pregunta a OpenStreetMap con los parámetros, el User-Agent propio y el idioma', async () => {
    const { geocodificador, llamadas } = montar();

    await geocodificador.buscar('Colosseo', 'u1');

    assert.equal(llamadas.length, 1);
    const { url, cabeceras } = llamadas[0];
    assert.equal(url.origin + url.pathname, 'https://nominatim.openstreetmap.org/search');
    assert.equal(url.searchParams.get('q'), 'colosseo');
    assert.equal(url.searchParams.get('format'), 'jsonv2');
    assert.equal(url.searchParams.get('limit'), '5');
    assert.equal(cabeceras['User-Agent'], 'TravelWrap/pruebas (equipo@travelwrap.app)');
    assert.equal(cabeceras['Accept-Language'], 'es');
  });

  it('usa un User-Agent por defecto que identifica a la aplicación', async () => {
    const { geocodificador, llamadas } = montar([respuestaDe([])], { userAgent: undefined });

    await geocodificador.buscar('Roma', 'u1');

    assert.match(llamadas[0].cabeceras['User-Agent'], /^TravelWrap\/1\.0/);
  });

  it('codifica en la URL los caracteres especiales de la dirección', async () => {
    const { geocodificador, llamadas } = montar();

    await geocodificador.buscar('Calle Alfonso I, 12 & más', 'u1');

    assert.equal(llamadas[0].url.searchParams.get('q'), 'calle alfonso i, 12 & más');
  });
});

describe('geocodificacionService · resultados', () => {
  it('devuelve nombre, coordenadas con seis decimales e identificador del lugar', async () => {
    const { geocodificador } = montar();

    const resultado = await geocodificador.buscar('Colosseo', 'u1');

    assert.deepEqual(resultado, {
      estado: 'ok',
      direcciones: [
        {
          nombre: COLISEO.display_name,
          latitud: 41.890214,
          longitud: 12.492231,
          lugar_externo_id: 'way/24146600',
        },
      ],
    });
  });

  it('deja el identificador en null si el lugar no lo trae', async () => {
    const { geocodificador } = montar([respuestaDe([{ lat: '1', lon: '2', display_name: 'Sitio' }])]);

    const resultado = await geocodificador.buscar('Sitio', 'u1');

    assert.equal(resultado.direcciones[0].lugar_externo_id, null);
  });

  it('descarta los lugares sin nombre o con coordenadas que no son válidas', async () => {
    const lugares = [
      COLISEO,
      { ...COLISEO, display_name: '   ' },
      { ...COLISEO, lat: 'abc' },
      { ...COLISEO, lon: '181' },
      { ...COLISEO, lat: '-90.5' },
      { lat: '1', lon: '1' },
      null,
    ];
    const { geocodificador } = montar([respuestaDe(lugares)]);

    const resultado = await geocodificador.buscar('Colosseo', 'u1');

    assert.equal(resultado.direcciones.length, 1);
  });

  it('acorta los nombres de más de 200 caracteres para que quepan al guardarlos', async () => {
    const largo = `${'a'.repeat(250)}`;
    const { geocodificador } = montar([respuestaDe([{ ...COLISEO, display_name: largo }])]);

    const resultado = await geocodificador.buscar('aaa', 'u1');

    assert.equal(resultado.direcciones[0].nombre.length, 200);
    assert.ok(resultado.direcciones[0].nombre.endsWith('…'));
  });

  it('devuelve una lista vacía si no hay coincidencias', async () => {
    const { geocodificador } = montar([respuestaDe([])]);

    assert.deepEqual(await geocodificador.buscar('zzzzzz', 'u1'), { estado: 'ok', direcciones: [] });
  });
});

describe('geocodificacionService · caché', () => {
  it('repite la misma búsqueda sin volver a llamar a OpenStreetMap', async () => {
    const { geocodificador, llamadas } = montar();

    const primera = await geocodificador.buscar('Colosseo', 'u1');
    const segunda = await geocodificador.buscar('  COLOSSEO ', 'u2');
    const tercera = await geocodificador.buscar('  Colosseo ', 'u3');

    assert.deepEqual(segunda, primera);
    assert.deepEqual(tercera, primera);
    assert.equal(llamadas.length, 1);
  });

  it('ignora mayúsculas y espacios repetidos al reutilizar el resultado', async () => {
    const { geocodificador, llamadas, reloj } = montar();

    await geocodificador.buscar('Via   del Corso', 'u1');
    reloj.ahora += 5000;
    await geocodificador.buscar('via del corso', 'u2');

    assert.equal(llamadas.length, 1);
  });

  it('el resultado guardado caduca a los 10 minutos', async () => {
    const { geocodificador, llamadas, reloj } = montar();

    await geocodificador.buscar('Colosseo', 'u1');
    reloj.ahora += 10 * 60 * 1000 + 1;
    await geocodificador.buscar('Colosseo', 'u1');

    assert.equal(llamadas.length, 2);
  });

  it('no guarda en caché los errores', async () => {
    const { geocodificador, llamadas, reloj } = montar([respuestaDe([], 500), respuestaDe([COLISEO])]);

    const fallo = await geocodificador.buscar('Colosseo', 'u1');
    reloj.ahora += 2000;
    const acierto = await geocodificador.buscar('Colosseo', 'u1');

    assert.deepEqual(fallo, { error: { code: 'http_500' } });
    assert.equal(acierto.estado, 'ok');
    assert.equal(llamadas.length, 2);
  });
});

describe('geocodificacionService · límite de uso', () => {
  it('la primera búsqueda no espera y las siguientes se espacian un segundo', async () => {
    const { geocodificador, esperas } = montar([respuestaDe([])]);

    await geocodificador.buscar('aaa', 'u1');
    await geocodificador.buscar('bbb', 'u2');
    await geocodificador.buscar('ccc', 'u3');

    assert.deepEqual(esperas, [1000, 1000]);
  });

  it('dos búsquedas a la vez de usuarios distintos no se pisan: la segunda espera su turno', async () => {
    const { geocodificador, llamadas, esperas } = montar([respuestaDe([])]);

    const [primera, segunda] = await Promise.all([geocodificador.buscar('aaa', 'u1'), geocodificador.buscar('bbb', 'u2')]);

    assert.equal(primera.estado, 'ok');
    assert.equal(segunda.estado, 'ok');
    assert.equal(llamadas.length, 2);
    assert.deepEqual(esperas, [1000]);
  });

  it('un mismo usuario no puede buscar dos veces en menos de un segundo', async () => {
    const { geocodificador, llamadas, reloj } = montar([respuestaDe([])]);

    const primera = await geocodificador.buscar('aaa', 'u1');
    const rapida = await geocodificador.buscar('bbb', 'u1');
    reloj.ahora += 1000;
    const lenta = await geocodificador.buscar('ccc', 'u1');

    assert.equal(primera.estado, 'ok');
    assert.deepEqual(rapida, { estado: 'demasiado_rapido' });
    assert.equal(lenta.estado, 'ok');
    assert.equal(llamadas.length, 2);
  });

  it('una búsqueda que sale de la caché no cuenta para el límite del usuario', async () => {
    const { geocodificador } = montar([respuestaDe([])]);

    await geocodificador.buscar('aaa', 'u1');
    const repetida = await geocodificador.buscar('aaa', 'u1');

    assert.equal(repetida.estado, 'ok');
  });

  it('con demasiadas búsquedas pendientes rechaza las nuevas sin llamar a OpenStreetMap', async () => {
    const liberar = [];
    const pendiente = () => new Promise((resolver) => liberar.push(() => resolver(respuestaDe([]))));
    const { geocodificador, llamadas } = montar([pendiente]);

    const iniciadas = [1, 2, 3, 4, 5].map((numero) => geocodificador.buscar(`consulta ${numero}`, `u${numero}`));
    const sexta = await geocodificador.buscar('consulta 6', 'u6');

    assert.deepEqual(sexta, { estado: 'ocupado' });
    while (liberar.length < 5) await new Promise((resolver) => setImmediate(resolver));
    liberar.forEach((terminar) => terminar());
    const resultados = await Promise.all(iniciadas);
    assert.ok(resultados.every((resultado) => resultado.estado === 'ok'));
    assert.equal(llamadas.length, 5);
  });

  it('cuando se vacía la cola vuelve a aceptar búsquedas', async () => {
    const { geocodificador } = montar([respuestaDe([])]);

    await Promise.all([1, 2, 3, 4, 5].map((numero) => geocodificador.buscar(`consulta ${numero}`, `u${numero}`)));
    const siguiente = await geocodificador.buscar('consulta 6', 'u6');

    assert.equal(siguiente.estado, 'ok');
  });
});

describe('geocodificacionService · fallos de OpenStreetMap', () => {
  it('si OpenStreetMap responde 429 devuelve ocupado y no lo guarda', async () => {
    const { geocodificador, llamadas, reloj } = montar([respuestaDe([], 429), respuestaDe([COLISEO])]);

    const limitada = await geocodificador.buscar('Colosseo', 'u1');
    reloj.ahora += 2000;
    const siguiente = await geocodificador.buscar('Colosseo', 'u1');

    assert.deepEqual(limitada, { estado: 'ocupado' });
    assert.equal(siguiente.estado, 'ok');
    assert.equal(llamadas.length, 2);
  });

  it('un error HTTP se devuelve como error del servicio', async () => {
    const { geocodificador } = montar([respuestaDe([], 503)]);

    assert.deepEqual(await geocodificador.buscar('Colosseo', 'u1'), { error: { code: 'http_503' } });
  });

  it('si no hay conexión devuelve el error sin lanzar excepción', async () => {
    const { geocodificador } = montar([
      () => {
        throw new TypeError('fetch failed');
      },
    ]);

    assert.deepEqual(await geocodificador.buscar('Colosseo', 'u1'), { error: { code: 'sin_conexion' } });
  });

  it('si la respuesta no es una lista lo trata como error', async () => {
    const { geocodificador } = montar([respuestaDe({ error: 'algo' })]);

    assert.deepEqual(await geocodificador.buscar('Colosseo', 'u1'), { error: { code: 'respuesta_no_valida' } });
  });

  it('si la respuesta no es un JSON válido lo trata como error', async () => {
    const rota = { status: 200, ok: true, json: async () => Promise.reject(new SyntaxError('JSON')) };
    const { geocodificador } = montar([rota]);

    assert.deepEqual(await geocodificador.buscar('Colosseo', 'u1'), { error: { code: 'sin_conexion' } });
  });

  it('corta la petición si OpenStreetMap tarda demasiado', async () => {
    const colgada = (parametros) =>
      new Promise((_, rechazar) => {
        parametros.signal.addEventListener('abort', () => rechazar(Object.assign(new Error('abortada'), { name: 'AbortError' })));
      });
    const { geocodificador } = montar([colgada], { tiempoMaximoMs: 20 });

    assert.deepEqual(await geocodificador.buscar('Colosseo', 'u1'), { error: { code: 'tiempo_agotado' } });
  });

  it('un fallo no deja la cola bloqueada para la siguiente búsqueda', async () => {
    const { geocodificador, reloj } = montar([respuestaDe([], 500), respuestaDe([COLISEO])]);

    await geocodificador.buscar('aaa', 'u1');
    reloj.ahora += 2000;
    const siguiente = await geocodificador.buscar('bbb', 'u2');

    assert.equal(siguiente.estado, 'ok');
  });
});

describe('geocodificacionService · instancia por defecto', () => {
  it('exporta buscar y la fábrica', () => {
    assert.equal(typeof geocodificacionService.buscar, 'function');
    assert.equal(typeof crearGeocodificador, 'function');
  });
});
