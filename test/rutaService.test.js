const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const actividadService = require('../src/services/actividadService');
const enrutadorService = require('../src/services/enrutadorService');
const rutaService = require('../src/services/rutaService');

const USUARIO = 'df77cba6-4be5-4cbc-814b-1e228dd73dcc';
const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';

const actividad = (id, latitud, longitud, titulo = `Actividad ${id}`) => ({ id, titulo, latitud, longitud });

const RUTA = { distancia_m: 1200, duracion_s: 900, geometria: [[41.89, 12.49], [41.9, 12.5]] };

const simular = ({ listado, trazado = { estado: 'ok', ruta: RUTA } }) => {
  const listar = mock.method(actividadService, 'listar', async () => listado);
  const trazar = mock.method(enrutadorService, 'trazar', async () => trazado);
  return { listar, trazar };
};

afterEach(() => mock.restoreAll());

describe('rutaService.ordenMasCorto', () => {
  const punto = (latitud, longitud) => ({ latitud, longitud });

  it('con una o dos actividades mantiene el orden de la agenda', () => {
    assert.deepEqual(rutaService.ordenMasCorto([]), []);
    assert.deepEqual(rutaService.ordenMasCorto([punto(41, 12)]), [0]);
    assert.deepEqual(rutaService.ordenMasCorto([punto(41, 12), punto(42, 13)]), [0, 1]);
  });

  it('mantiene el orden si la agenda ya es el recorrido más corto', () => {
    const recto = [punto(41, 12), punto(41, 12.01), punto(41, 12.02), punto(41, 12.03)];

    assert.deepEqual(rutaService.ordenMasCorto(recto), [0, 1, 2, 3]);
  });

  it('empieza siempre por la primera actividad y reordena el resto para acortar el recorrido', () => {
    const enZigZag = [punto(41, 12), punto(41, 12.03), punto(41, 12.01), punto(41, 12.02)];

    const orden = rutaService.ordenMasCorto(enZigZag);

    assert.equal(orden[0], 0);
    assert.deepEqual(orden, [0, 2, 3, 1]);
  });

  it('devuelve una permutación de todas las actividades', () => {
    const puntos = Array.from({ length: 12 }, (_, i) => punto(41 + ((i * 7) % 5) * 0.01, 12 + ((i * 3) % 7) * 0.01));

    const orden = rutaService.ordenMasCorto(puntos);

    assert.deepEqual([...orden].sort((a, b) => a - b), puntos.map((_, i) => i));
  });
});

describe('rutaService.distanciaDirecta', () => {
  it('calcula en metros la distancia entre dos puntos', () => {
    const metros = rutaService.distanciaDirecta(
      { latitud: 41.890214, longitud: 12.492231 },
      { latitud: 41.892462, longitud: 12.485325 },
    );

    assert.ok(metros > 600 && metros < 700, `distancia inesperada: ${metros}`);
  });
});

describe('rutaService.calcular', () => {
  it('pide el listado del día y traza la ruta entre las actividades con ubicación, en el orden de la agenda', async () => {
    const { listar, trazar } = simular({
      listado: {
        estado: 'ok',
        actividades: [actividad('a1', 41.89, 12.49), actividad('a2', null, null), actividad('a3', 41.9, 12.5)],
      },
    });
    const cliente = {};

    const resultado = await rutaService.calcular(cliente, USUARIO, VIAJE_ID, '2027-05-12');

    assert.deepEqual(listar.mock.calls[0].arguments, [cliente, USUARIO, VIAJE_ID, '2027-05-12']);
    assert.deepEqual(trazar.mock.calls[0].arguments, [
      [
        { id: 'a1', titulo: 'Actividad a1', latitud: 41.89, longitud: 12.49 },
        { id: 'a3', titulo: 'Actividad a3', latitud: 41.9, longitud: 12.5 },
      ],
      USUARIO,
    ]);
    assert.equal(resultado.estado, 'ok');
    assert.deepEqual(resultado.puntos.map((p) => p.id), ['a1', 'a3']);
    assert.deepEqual(resultado.ruta, RUTA);
  });

  it('con menos de dos actividades con ubicación no llama al servicio de rutas', async () => {
    const { trazar } = simular({
      listado: { estado: 'ok', actividades: [actividad('a1', 41.89, 12.49), actividad('a2', null, null)] },
    });

    const resultado = await rutaService.calcular({}, USUARIO, VIAJE_ID, '2027-05-12');

    assert.equal(trazar.mock.callCount(), 0);
    assert.equal(resultado.estado, 'ok');
    assert.equal(resultado.ruta, null);
    assert.deepEqual(resultado.orden_sugerido, ['a1']);
    assert.equal(resultado.ahorro_m, 0);
  });

  it('un día sin actividades devuelve todo vacío', async () => {
    const { trazar } = simular({ listado: { estado: 'ok', actividades: [] } });

    const resultado = await rutaService.calcular({}, USUARIO, VIAJE_ID, '2027-05-12');

    assert.equal(trazar.mock.callCount(), 0);
    assert.deepEqual(resultado, { estado: 'ok', puntos: [], orden_sugerido: [], ahorro_m: 0, ruta: null });
  });

  it('propone un orden más corto y calcula el ahorro en línea recta', async () => {
    simular({
      listado: {
        estado: 'ok',
        actividades: [
          actividad('a', 41, 12),
          actividad('b', 41, 12.03),
          actividad('c', 41, 12.01),
          actividad('d', 41, 12.02),
        ],
      },
    });

    const resultado = await rutaService.calcular({}, USUARIO, VIAJE_ID, '2027-05-12');

    assert.deepEqual(resultado.orden_sugerido, ['a', 'c', 'd', 'b']);
    assert.ok(resultado.ahorro_m > 1000, `ahorro inesperado: ${resultado.ahorro_m}`);
  });

  it('con la agenda ya ordenada no propone cambios y el ahorro es cero', async () => {
    simular({
      listado: {
        estado: 'ok',
        actividades: [actividad('a', 41, 12), actividad('b', 41, 12.01), actividad('c', 41, 12.02)],
      },
    });

    const resultado = await rutaService.calcular({}, USUARIO, VIAJE_ID, '2027-05-12');

    assert.deepEqual(resultado.orden_sugerido, ['a', 'b', 'c']);
    assert.equal(resultado.ahorro_m, 0);
  });

  it('rechaza con demasiados_puntos si hay más de 25 actividades con ubicación', async () => {
    const actividades = Array.from({ length: 26 }, (_, i) => actividad(`a${i}`, 41 + i * 0.001, 12));
    const { trazar } = simular({ listado: { estado: 'ok', actividades } });

    const resultado = await rutaService.calcular({}, USUARIO, VIAJE_ID, '2027-05-12');

    assert.deepEqual(resultado, { estado: 'demasiados_puntos' });
    assert.equal(trazar.mock.callCount(), 0);
  });

  it('traslada el estado del listado cuando el viaje no existe', async () => {
    const { trazar } = simular({ listado: { estado: 'no_existe' } });

    assert.deepEqual(await rutaService.calcular({}, USUARIO, VIAJE_ID, '2027-05-12'), { estado: 'no_existe' });
    assert.equal(trazar.mock.callCount(), 0);
  });

  it('traslada el error del listado', async () => {
    simular({ listado: { error: { code: 'XX' } } });

    assert.deepEqual(await rutaService.calcular({}, USUARIO, VIAJE_ID, '2027-05-12'), { error: { code: 'XX' } });
  });

  it('traslada los estados y errores del servicio de rutas', async () => {
    const listado = { estado: 'ok', actividades: [actividad('a', 41, 12), actividad('b', 42, 13)] };

    simular({ listado, trazado: { estado: 'demasiado_rapido' } });
    assert.deepEqual(await rutaService.calcular({}, USUARIO, VIAJE_ID, '2027-05-12'), { estado: 'demasiado_rapido' });
    mock.restoreAll();

    simular({ listado, trazado: { error: { code: 'http_500' } } });
    assert.deepEqual(await rutaService.calcular({}, USUARIO, VIAJE_ID, '2027-05-12'), { error: { code: 'http_500' } });
  });
});
