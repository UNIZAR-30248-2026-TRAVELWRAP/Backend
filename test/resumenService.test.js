const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const resumenService = require('../src/services/resumenService');
const viajeService = require('../src/services/viajeService');

const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const USUARIO_ID = 'df77cba6-4be5-4cbc-814b-1e228dd73dcc';

const clienteFalso = (respuestas) => {
  const consultas = [];
  const from = (tabla) => {
    const consulta = { tabla, operaciones: [] };
    consultas.push(consulta);
    const encadenable = new Proxy(
      {},
      {
        get: (_, metodo) => {
          if (metodo === 'then') {
            const respuesta = respuestas[tabla] ?? { data: [], error: null };
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
  return { cliente: { from }, consultas };
};

const viaje = (datos = {}) =>
  mock.method(viajeService, 'obtener', async () => ({
    viaje: { id: VIAJE_ID, fecha_inicio: '2027-05-12', fecha_fin: '2027-05-15', ...datos },
  }));

afterEach(() => mock.restoreAll());

describe('resumenService.obtener', () => {
  it('calcula los días, los gastos y la actividad más votada del viaje', async () => {
    viaje();
    const { cliente, consultas } = clienteFalso({
      gastos: { data: [{ concepto: 'Cena', importe: '120.50' }, { concepto: 'Taxi', importe: '12.40' }], error: null },
      votaciones: { data: [{ id: 'v1' }], error: null },
      opciones_votacion: { data: [{ id: 'a', texto: 'Coliseo', orden: 0 }, { id: 'b', texto: 'Trevi', orden: 1 }], error: null },
      votos: { data: [{ opcion_id: 'a' }, { opcion_id: 'a' }, { opcion_id: 'b' }], error: null },
    });

    const resultado = await resumenService.obtener(cliente, USUARIO_ID, VIAJE_ID);

    assert.deepEqual(resultado, {
      estado: 'ok',
      resumen: {
        dias: 4,
        gasto_total: 132.9,
        gasto_mayor: { concepto: 'Cena', importe: 120.5 },
        actividad_mas_votada: { titulo: 'Coliseo', votos: 2 },
      },
    });
    const votaciones = consultas.find((c) => c.tabla === 'votaciones');
    assert.deepEqual(votaciones.operaciones.filter(([m]) => m === 'eq'), [['eq', 'viaje_id', VIAJE_ID], ['eq', 'tipo', 'actividad']]);
    assert.ok(!consultas.some((c) => c.tabla === 'actividades'));
  });

  it('sin votaciones de actividades no consulta opciones ni votos', async () => {
    viaje();
    const { cliente, consultas } = clienteFalso({ votaciones: { data: [], error: null } });

    const { resumen } = await resumenService.obtener(cliente, USUARIO_ID, VIAJE_ID);

    assert.deepEqual(resumen, { dias: 4, gasto_total: 0, gasto_mayor: null, actividad_mas_votada: null });
    assert.ok(!consultas.some((c) => c.tabla === 'opciones_votacion' || c.tabla === 'votos'));
  });

  it('sin fechas del viaje cuenta los días con actividades', async () => {
    viaje({ fecha_inicio: null, fecha_fin: null });
    const { cliente } = clienteFalso({
      actividades: { data: [{ fecha: '2027-07-01' }, { fecha: '2027-07-01' }, { fecha: '2027-07-03' }], error: null },
    });

    const { resumen } = await resumenService.obtener(cliente, USUARIO_ID, VIAJE_ID);

    assert.equal(resumen.dias, 2);
  });

  it('devuelve no_existe si el viaje no existe o no es del usuario', async () => {
    mock.method(viajeService, 'obtener', async () => ({ viaje: null }));
    const { cliente, consultas } = clienteFalso({});
    assert.deepEqual(await resumenService.obtener(cliente, USUARIO_ID, VIAJE_ID), { estado: 'no_existe' });
    assert.equal(consultas.length, 0);
  });

  it('devuelve el error si falla la consulta del viaje, de los gastos, de las votaciones o de las actividades', async () => {
    const error = { code: 'XX000' };

    mock.method(viajeService, 'obtener', async () => ({ error }));
    assert.deepEqual(await resumenService.obtener(clienteFalso({}).cliente, USUARIO_ID, VIAJE_ID), { error });
    mock.restoreAll();

    viaje();
    assert.deepEqual(
      await resumenService.obtener(clienteFalso({ gastos: { data: null, error } }).cliente, USUARIO_ID, VIAJE_ID),
      { error },
    );
    assert.deepEqual(
      await resumenService.obtener(clienteFalso({ votaciones: { data: null, error } }).cliente, USUARIO_ID, VIAJE_ID),
      { error },
    );
    mock.restoreAll();

    viaje({ fecha_inicio: null, fecha_fin: null });
    assert.deepEqual(
      await resumenService.obtener(clienteFalso({ actividades: { data: null, error } }).cliente, USUARIO_ID, VIAJE_ID),
      { error },
    );
  });
});
