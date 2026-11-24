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
  name: 'Colosseo',
  display_name: 'Colosseo, Piazza del Colosseo, Municipio I, Roma, Lazio, 00184, Italia',
  address: {
    tourism: 'Colosseo',
    road: 'Piazza del Colosseo',
    suburb: 'Municipio I',
    city: 'Roma',
    state: 'Lazio',
    postcode: '00184',
    country: 'Italia',
  },
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


describe('geocodificacionService · resultados', () => {
  it('devuelve nombre corto, título, detalle, coordenadas con seis decimales e identificador del lugar', async () => {
    const { geocodificador } = montar();

    const resultado = await geocodificador.buscar('Colosseo', 'u1');

    assert.deepEqual(resultado, {
      estado: 'ok',
      direcciones: [
        {
          nombre: 'Colosseo, Roma',
          titulo: 'Colosseo',
          detalle: 'Roma, Italia',
          latitud: 41.890214,
          longitud: 12.492231,
          lugar_externo_id: 'way/24146600',
        },
      ],
    });
  });


  it('si el lugar no tiene nombre propio usa la calle y el número como título', async () => {
    const casa = {
      ...COLISEO,
      name: '',
      display_name: '10, Via del Corso, Municipio I, Roma, Lazio, 00186, Italia',
      address: { house_number: '10', road: 'Via del Corso', city: 'Roma', state: 'Lazio', country: 'Italia' },
    };
    const { geocodificador } = montar([respuestaDe([casa])]);

    const { direcciones } = await geocodificador.buscar('via del corso 10', 'u1');

    assert.equal(direcciones[0].titulo, 'Via del Corso 10');
    assert.equal(direcciones[0].nombre, 'Via del Corso 10, Roma');
    assert.equal(direcciones[0].detalle, 'Roma, Italia');
  });


  it('si el lugar es la propia ciudad no la repite y el detalle muestra la región y el país', async () => {
    const roma = {
      ...COLISEO,
      name: 'Roma',
      display_name: 'Roma, Lazio, Italia',
      address: { city: 'Roma', state: 'Lazio', country: 'Italia' },
    };
    const { geocodificador } = montar([respuestaDe([roma])]);

    const { direcciones } = await geocodificador.buscar('roma', 'u1');

    assert.equal(direcciones[0].nombre, 'Roma');
    assert.equal(direcciones[0].titulo, 'Roma');
    assert.equal(direcciones[0].detalle, 'Lazio, Italia');
  });

  it('sin datos de dirección parte el nombre completo en título y detalle', async () => {
    const { geocodificador } = montar([
      respuestaDe([{ ...COLISEO, name: undefined, address: undefined }]),
    ]);

    const { direcciones } = await geocodificador.buscar('colosseo', 'u1');

    assert.equal(direcciones[0].titulo, 'Colosseo');
    assert.equal(direcciones[0].detalle, '00184, Italia');
    assert.equal(direcciones[0].nombre, COLISEO.display_name);
  });

  it('el detalle es null si no hay nada más que decir', async () => {
    const { geocodificador } = montar([respuestaDe([{ lat: '1', lon: '2', display_name: 'Sitio' }])]);

    const { direcciones } = await geocodificador.buscar('sitio', 'u1');

    assert.deepEqual(
      [direcciones[0].titulo, direcciones[0].detalle, direcciones[0].nombre],
      ['Sitio', null, 'Sitio'],
    );
  });

  it('quita los resultados que se verían iguales y se guardarían con el mismo nombre', async () => {
    const otro = { ...COLISEO, osm_type: 'node', osm_id: 99, lat: '41.8903', lon: '12.4923' };
    const foro = { ...COLISEO, osm_id: 5, name: 'Foro Romano', address: { ...COLISEO.address, tourism: undefined } };
    const { geocodificador } = montar([respuestaDe([COLISEO, otro, foro, otro])]);

    const { direcciones } = await geocodificador.buscar('colosseo', 'u1');

    assert.deepEqual(
      direcciones.map((d) => [d.titulo, d.lugar_externo_id]),
      [['Colosseo', 'way/24146600'], ['Foro Romano', 'way/5']],
    );
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
    const { geocodificador } = montar([respuestaDe([{ ...COLISEO, name: largo, display_name: largo }])]);

    const resultado = await geocodificador.buscar('aaa', 'u1');

    assert.equal(resultado.direcciones[0].nombre.length, 200);
    assert.ok(resultado.direcciones[0].nombre.endsWith('…'));
    assert.equal(resultado.direcciones[0].titulo.length, 200);
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

});

