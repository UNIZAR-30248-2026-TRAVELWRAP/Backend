// Pruebas del servicio de sellos (PB-44): sello de un viaje y colección del usuario.
// Supabase se sustituye por un cliente falso y viajeService.obtener por un mock
const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const selloService = require('../src/services/selloService');
const viajeService = require('../src/services/viajeService');
const { textoDelSello } = require('../src/utils/sellos');

const USUARIO_ID = 'df77cba6-4be5-4cbc-814b-1e228dd73dcc';
const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const SELLO_ID = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';

const VIAJE = { id: VIAJE_ID, nombre: 'Escapada', destino: 'Roma', fecha_inicio: '2027-05-12', estado: 'finalizado' };
const SELLO = { id: SELLO_ID, viaje_id: VIAJE_ID, diseno: 'mapa', destino: 'Roma', anio: 2027, elegido_en: '2027-05-20T10:00:00Z' };

// Cliente falso: cada consulta devuelve, por orden, una de las respuestas y guarda sus operaciones
const clienteFalso = (...respuestas) => {
  const consultas = [];
  const pendientes = [...respuestas];
  const from = (tabla) => {
    const consulta = { tabla, operaciones: [] };
    consultas.push(consulta);
    const respuesta = pendientes.shift() ?? { data: null, error: null };
    const encadenable = new Proxy(
      {},
      {
        get: (_, metodo) => {
          if (metodo === 'then') return (resolver, rechazar) => Promise.resolve(respuesta).then(resolver, rechazar);
          return (...args) => {
            consulta.operaciones.push([metodo, ...args]);
            return encadenable;
          };
        },
      },
    );
    return encadenable;
  };
  return { cliente: { from }, consultas };
};

const operacion = (consulta, metodo) => consulta.operaciones.find(([m]) => m === metodo);
const viajeVisible = (viaje) => mock.method(viajeService, 'obtener', async () => ({ viaje }));

afterEach(() => mock.restoreAll());

describe('utils/sellos', () => {

  it('usa el destino y, si no hay, el nombre del viaje', () => {
    assert.equal(textoDelSello({ destino: ' Roma ', nombre: 'Escapada', fecha_inicio: '2027-05-12' }).destino, 'Roma');
    assert.equal(textoDelSello({ destino: null, nombre: 'Escapada', fecha_inicio: '2027-05-12' }).destino, 'Escapada');
  });

  it('toma el año del inicio, si no de la finalización y si no de la creación', () => {
    const base = { destino: 'Roma', nombre: 'x' };
    assert.equal(textoDelSello({ ...base, fecha_inicio: '2027-05-12', finalizado_en: '2028-01-01T00:00:00Z' }).anio, 2027);
    assert.equal(textoDelSello({ ...base, fecha_inicio: null, finalizado_en: '2028-01-01T00:00:00Z' }).anio, 2028);
    assert.equal(textoDelSello({ ...base, creado_en: '2026-10-07T18:00:00Z' }).anio, 2026);
  });
});

describe('selloService.obtener', () => {
  it('devuelve el sello del usuario en un viaje finalizado', async () => {
    viajeVisible(VIAJE);
    const { cliente, consultas } = clienteFalso({ data: SELLO, error: null });

    const resultado = await selloService.obtener(cliente, USUARIO_ID, VIAJE_ID);

    assert.deepEqual(resultado, { estado: 'ok', sello: SELLO });
    assert.deepEqual(operacion(consultas[0], 'eq'), ['eq', 'usuario_id', USUARIO_ID]);
  });

  it('devuelve null si el usuario no ha elegido sello', async () => {
    viajeVisible(VIAJE);
    const { cliente } = clienteFalso({ data: null, error: null });
    assert.deepEqual(await selloService.obtener(cliente, USUARIO_ID, VIAJE_ID), { estado: 'ok', sello: null });
  });

  it('un viaje activo responde null sin consultar los sellos', async () => {
    viajeVisible({ ...VIAJE, estado: 'activo' });
    const { cliente, consultas } = clienteFalso();
    assert.deepEqual(await selloService.obtener(cliente, USUARIO_ID, VIAJE_ID), { estado: 'ok', sello: null });
    assert.equal(consultas.length, 0);
  });

  it('un viaje que no existe o no es del usuario da no_existe', async () => {
    viajeVisible(null);
    const { cliente } = clienteFalso();
    assert.deepEqual(await selloService.obtener(cliente, USUARIO_ID, VIAJE_ID), { estado: 'no_existe' });
  });

  it('propaga el error de la base de datos', async () => {
    viajeVisible(VIAJE);
    const { cliente } = clienteFalso({ data: null, error: { code: 'x' } });
    assert.deepEqual((await selloService.obtener(cliente, USUARIO_ID, VIAJE_ID)).error, { code: 'x' });
  });
});

describe('selloService.elegir', () => {
  it('guarda el sello con el destino y el año del viaje (finalizado sin archivar o archivado por el usuario)', async () => {
    for (const archivado of [false, true]) {
      viajeVisible({ ...VIAJE, archivado });
      const { cliente, consultas } = clienteFalso({ data: { finalizado_en: '2027-05-16T09:00:00Z' }, error: null }, { data: SELLO, error: null });

      const resultado = await selloService.elegir(cliente, USUARIO_ID, VIAJE_ID, 'mapa');

      assert.deepEqual(resultado, { estado: 'ok', sello: SELLO });
      const [, fila, opciones] = operacion(consultas[1], 'upsert');
      assert.equal(fila.usuario_id, USUARIO_ID);
      assert.equal(fila.viaje_id, VIAJE_ID);
      assert.equal(fila.diseno, 'mapa');
      assert.equal(fila.destino, 'Roma');
      assert.equal(fila.anio, 2027);
      assert.deepEqual(opciones, { onConflict: 'usuario_id,viaje_id' });
      mock.restoreAll();
    }
  });


  it('un viaje activo da no_terminado y no escribe nada', async () => {
    viajeVisible({ ...VIAJE, estado: 'activo' });
    const { cliente, consultas } = clienteFalso();
    assert.deepEqual(await selloService.elegir(cliente, USUARIO_ID, VIAJE_ID, 'mapa'), { estado: 'no_terminado' });
    assert.equal(consultas.length, 0);
  });

  it('un viaje que no existe, o que el usuario ha eliminado, da no_existe', async () => {
    viajeVisible(null);
    const { cliente } = clienteFalso();
    assert.deepEqual(await selloService.elegir(cliente, USUARIO_ID, VIAJE_ID, 'mapa'), { estado: 'no_existe' });
  });

  it('propaga el error al guardar', async () => {
    viajeVisible(VIAJE);
    const { cliente } = clienteFalso({ data: { finalizado_en: null }, error: null }, { data: null, error: { code: 'x' } });
    assert.deepEqual((await selloService.elegir(cliente, USUARIO_ID, VIAJE_ID, 'mapa')).error, { code: 'x' });
  });
});

describe('selloService.quitar', () => {
  it('borra el sello del usuario en el viaje', async () => {
    viajeVisible(VIAJE);
    const { cliente, consultas } = clienteFalso({ error: null });
    assert.deepEqual(await selloService.quitar(cliente, USUARIO_ID, VIAJE_ID), { estado: 'ok' });
    assert.ok(operacion(consultas[0], 'delete'));
  });

  it('un viaje activo da no_terminado y uno inexistente no_existe', async () => {
    const { cliente } = clienteFalso();
    viajeVisible({ ...VIAJE, estado: 'activo' });
    assert.deepEqual(await selloService.quitar(cliente, USUARIO_ID, VIAJE_ID), { estado: 'no_terminado' });
    mock.restoreAll();
    viajeVisible(null);
    assert.deepEqual(await selloService.quitar(cliente, USUARIO_ID, VIAJE_ID), { estado: 'no_existe' });
  });
});

describe('selloService.listarMios', () => {
  it('lista solo los sellos del usuario, por año descendente y luego por fecha, sin consultar viajes', async () => {
    const { cliente, consultas } = clienteFalso({ data: [SELLO, { ...SELLO, id: 'otro', viaje_id: null }], error: null });

    const resultado = await selloService.listarMios(cliente, USUARIO_ID);

    assert.equal(resultado.estado, 'ok');
    assert.equal(resultado.sellos.length, 2);
    assert.equal(resultado.sellos[1].viaje_id, null);
    assert.equal(consultas.length, 1);
    assert.equal(consultas[0].tabla, 'sellos');
    assert.deepEqual(operacion(consultas[0], 'eq'), ['eq', 'usuario_id', USUARIO_ID]);
    const orden = consultas[0].operaciones.filter(([m]) => m === 'order');
    assert.deepEqual(orden, [
      ['order', 'anio', { ascending: false }],
      ['order', 'elegido_en', { ascending: true }],
    ]);
  });

  it('sin sellos devuelve una lista vacía y propaga el error', async () => {
    assert.deepEqual(await selloService.listarMios(clienteFalso({ data: null, error: null }).cliente, USUARIO_ID), {
      estado: 'ok',
      sellos: [],
    });
    const fallo = await selloService.listarMios(clienteFalso({ data: null, error: { code: 'x' } }).cliente, USUARIO_ID);
    assert.deepEqual(fallo.error, { code: 'x' });
  });
});

describe('selloService.cambiarDiseno', () => {

  it('un sello ajeno o inexistente da sello_no_existe', async () => {
    const { cliente } = clienteFalso({ data: null, error: null });
    assert.deepEqual(await selloService.cambiarDiseno(cliente, USUARIO_ID, SELLO_ID, 'ruta'), { estado: 'sello_no_existe' });
  });

  it('propaga el error', async () => {
    const { cliente } = clienteFalso({ data: null, error: { code: 'x' } });
    assert.deepEqual((await selloService.cambiarDiseno(cliente, USUARIO_ID, SELLO_ID, 'ruta')).error, { code: 'x' });
  });
});

