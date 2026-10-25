const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const actividadService = require('../src/services/actividadService');

const USUARIO = 'df77cba6-4be5-4cbc-814b-1e228dd73dcc';
const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const ACTIVIDAD_ID = '8a1b2c3d-0000-4000-8000-000000000020';

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
            const respuesta = respuestas.shift();
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

const viaje = (estado = 'activo', miembro = true) => ({
  id: VIAJE_ID,
  nombre: 'Roma 2027',
  destino: 'Roma',
  descripcion: null,
  fecha_inicio: '2027-05-12',
  fecha_fin: '2027-05-15',
  moneda: 'EUR',
  presupuesto: 850,
  estado,
  creado_en: '2026-10-12T10:00:00Z',
  miembros_viaje: miembro
    ? [{ usuario_id: USUARIO, rol: 'miembro', abandonado_en: null, perfiles: { nombre: 'Adriana', avatar_url: null } }]
    : [],
});

const actividad = (datos = {}) => ({
  id: ACTIVIDAD_ID,
  viaje_id: VIAJE_ID,
  titulo: 'Coliseo',
  fecha: '2027-05-12',
  hora_inicio: '10:00:00',
  hora_fin: '12:00:00',
  orden: 1,
  ubicacion_nombre: 'Piazza',
  categoria: 'cultura',
  ...datos,
});

const operacion = (consulta, metodo) => consulta.operaciones.find(([m]) => m === metodo);

const encontrada = (datos) => ({ data: actividad(datos), error: null });

describe('actividadService.editar', () => {
  it('actualiza solo los campos cambiados, acotando por actividad y viaje, y devuelve la fila', async () => {
    const actualizada = actividad({ titulo: 'Coliseo y Foro' });
    const cliente = clienteFalso([
      { data: viaje(), error: null },
      encontrada(),
      { data: [actualizada], error: null },
    ]);

    const resultado = await actividadService.editar(cliente, USUARIO, VIAJE_ID, ACTIVIDAD_ID, { titulo: 'Coliseo y Foro' });

    assert.deepEqual(resultado, { estado: 'ok', actividad: actualizada });
    const consulta = cliente.consultas[2];
    assert.equal(consulta.tabla, 'actividades');
    assert.deepEqual(operacion(consulta, 'update'), ['update', { titulo: 'Coliseo y Foro' }]);
    assert.deepEqual(
      consulta.operaciones.filter(([m]) => m === 'eq'),
      [
        ['eq', 'id', ACTIVIDAD_ID],
        ['eq', 'viaje_id', VIAJE_ID],
      ],
    );
  });

  it('al cambiarla de día la coloca al final de ese día', async () => {
    const cliente = clienteFalso([
      { data: viaje(), error: null },
      encontrada(),
      { data: { orden: 2 }, error: null },
      { data: [actividad({ fecha: '2027-05-13', orden: 3 })], error: null },
    ]);

    await actividadService.editar(cliente, USUARIO, VIAJE_ID, ACTIVIDAD_ID, { fecha: '2027-05-13' });

    assert.deepEqual(operacion(cliente.consultas[3], 'update'), ['update', { fecha: '2027-05-13', orden: 3 }]);
  });

  it('al cambiarla a un día sin actividades su orden es 0', async () => {
    const cliente = clienteFalso([
      { data: viaje(), error: null },
      encontrada(),
      { data: null, error: null },
      { data: [actividad({ fecha: '2027-05-14', orden: 0 })], error: null },
    ]);

    await actividadService.editar(cliente, USUARIO, VIAJE_ID, ACTIVIDAD_ID, { fecha: '2027-05-14' });

    assert.equal(operacion(cliente.consultas[3], 'update')[1].orden, 0);
  });

  it('si la fecha enviada es la misma no cambia el orden ni consulta el día', async () => {
    const cliente = clienteFalso([
      { data: viaje(), error: null },
      encontrada(),
      { data: [actividad()], error: null },
    ]);

    await actividadService.editar(cliente, USUARIO, VIAJE_ID, ACTIVIDAD_ID, { fecha: '2027-05-12' });

    assert.equal(cliente.consultas.length, 3);
    assert.deepEqual(operacion(cliente.consultas[2], 'update'), ['update', { fecha: '2027-05-12' }]);
  });

  it('rechaza una hora de fin si se quita la hora de inicio y no se quita también la de fin', async () => {
    const cliente = clienteFalso([{ data: viaje(), error: null }, encontrada()]);

    const resultado = await actividadService.editar(cliente, USUARIO, VIAJE_ID, ACTIVIDAD_ID, { hora_inicio: null });

    assert.deepEqual(resultado, { estado: 'hora_fin_sin_inicio' });
    assert.equal(cliente.consultas.length, 2);
  });

  it('permite quitar a la vez la hora de inicio y la de fin', async () => {
    const cliente = clienteFalso([
      { data: viaje(), error: null },
      encontrada(),
      { data: [actividad({ hora_inicio: null, hora_fin: null })], error: null },
    ]);

    const resultado = await actividadService.editar(cliente, USUARIO, VIAJE_ID, ACTIVIDAD_ID, {
      hora_inicio: null,
      hora_fin: null,
    });

    assert.equal(resultado.estado, 'ok');
  });

  it('rechaza una hora de inicio posterior a la hora de fin que ya tenía', async () => {
    const cliente = clienteFalso([{ data: viaje(), error: null }, encontrada()]);

    const resultado = await actividadService.editar(cliente, USUARIO, VIAJE_ID, ACTIVIDAD_ID, { hora_inicio: '13:00' });

    assert.deepEqual(resultado, { estado: 'horas_invertidas' });
  });

  it('rechaza una hora de fin anterior a la hora de inicio que ya tenía', async () => {
    const cliente = clienteFalso([{ data: viaje(), error: null }, encontrada()]);

    const resultado = await actividadService.editar(cliente, USUARIO, VIAJE_ID, ACTIVIDAD_ID, { hora_fin: '09:59' });

    assert.deepEqual(resultado, { estado: 'horas_invertidas' });
  });

  it('acepta una hora de fin igual a la de inicio', async () => {
    const cliente = clienteFalso([
      { data: viaje(), error: null },
      encontrada(),
      { data: [actividad({ hora_fin: '10:00:00' })], error: null },
    ]);

    const resultado = await actividadService.editar(cliente, USUARIO, VIAJE_ID, ACTIVIDAD_ID, { hora_fin: '10:00' });

    assert.equal(resultado.estado, 'ok');
  });

  it('devuelve no_existe, no_activo o no_encontrada sin modificar nada', async () => {
    const sinViaje = clienteFalso([{ data: null, error: null }]);
    const ajeno = clienteFalso([{ data: viaje('activo', false), error: null }]);
    const archivado = clienteFalso([{ data: viaje('archivado'), error: null }]);
    const sinActividad = clienteFalso([{ data: viaje(), error: null }, { data: null, error: null }]);

    assert.deepEqual(await actividadService.editar(sinViaje, USUARIO, VIAJE_ID, ACTIVIDAD_ID, { titulo: 'X' }), { estado: 'no_existe' });
    assert.deepEqual(await actividadService.editar(ajeno, USUARIO, VIAJE_ID, ACTIVIDAD_ID, { titulo: 'X' }), { estado: 'no_existe' });
    assert.deepEqual(await actividadService.editar(archivado, USUARIO, VIAJE_ID, ACTIVIDAD_ID, { titulo: 'X' }), { estado: 'no_activo' });
    assert.deepEqual(await actividadService.editar(sinActividad, USUARIO, VIAJE_ID, ACTIVIDAD_ID, { titulo: 'X' }), { estado: 'no_encontrada' });
    assert.equal(archivado.consultas.length, 1);
  });

  it('devuelve el error si falla alguna consulta, y sin_filas si las políticas rechazan el cambio', async () => {
    const error = { code: 'XX000' };
    const enViaje = clienteFalso([{ data: null, error }]);
    const enActividad = clienteFalso([{ data: viaje(), error: null }, { data: null, error }]);
    const enOrden = clienteFalso([{ data: viaje(), error: null }, encontrada(), { data: null, error }]);
    const enUpdate = clienteFalso([{ data: viaje(), error: null }, encontrada(), { data: null, error }]);
    const sinFilas = clienteFalso([{ data: viaje(), error: null }, encontrada(), { data: [], error: null }]);

    assert.deepEqual(await actividadService.editar(enViaje, USUARIO, VIAJE_ID, ACTIVIDAD_ID, { titulo: 'X' }), { error });
    assert.deepEqual(await actividadService.editar(enActividad, USUARIO, VIAJE_ID, ACTIVIDAD_ID, { titulo: 'X' }), { error });
    assert.deepEqual(await actividadService.editar(enOrden, USUARIO, VIAJE_ID, ACTIVIDAD_ID, { fecha: '2027-05-13' }), { error });
    assert.deepEqual(await actividadService.editar(enUpdate, USUARIO, VIAJE_ID, ACTIVIDAD_ID, { titulo: 'X' }), { error });
    assert.deepEqual(await actividadService.editar(sinFilas, USUARIO, VIAJE_ID, ACTIVIDAD_ID, { titulo: 'X' }), {
      error: { code: 'sin_filas' },
    });
  });
});

describe('actividadService.eliminar', () => {
  it('borra la actividad acotando por actividad y viaje', async () => {
    const cliente = clienteFalso([
      { data: viaje(), error: null },
      encontrada(),
      { data: [{ id: ACTIVIDAD_ID }], error: null },
    ]);

    const resultado = await actividadService.eliminar(cliente, USUARIO, VIAJE_ID, ACTIVIDAD_ID);

    assert.deepEqual(resultado, { estado: 'ok' });
    const consulta = cliente.consultas[2];
    assert.ok(operacion(consulta, 'delete'));
    assert.deepEqual(
      consulta.operaciones.filter(([m]) => m === 'eq'),
      [
        ['eq', 'id', ACTIVIDAD_ID],
        ['eq', 'viaje_id', VIAJE_ID],
      ],
    );
  });

  it('devuelve no_existe, no_activo o no_encontrada sin borrar nada', async () => {
    const sinViaje = clienteFalso([{ data: null, error: null }]);
    const archivado = clienteFalso([{ data: viaje('archivado'), error: null }]);
    const sinActividad = clienteFalso([{ data: viaje(), error: null }, { data: null, error: null }]);

    assert.deepEqual(await actividadService.eliminar(sinViaje, USUARIO, VIAJE_ID, ACTIVIDAD_ID), { estado: 'no_existe' });
    assert.deepEqual(await actividadService.eliminar(archivado, USUARIO, VIAJE_ID, ACTIVIDAD_ID), { estado: 'no_activo' });
    assert.deepEqual(await actividadService.eliminar(sinActividad, USUARIO, VIAJE_ID, ACTIVIDAD_ID), { estado: 'no_encontrada' });
    assert.equal(archivado.consultas.length, 1);
    assert.equal(sinActividad.consultas.length, 2);
  });

  it('devuelve el error si falla alguna consulta, y sin_filas si las políticas rechazan el borrado', async () => {
    const error = { code: 'XX000' };
    const enViaje = clienteFalso([{ data: null, error }]);
    const enActividad = clienteFalso([{ data: viaje(), error: null }, { data: null, error }]);
    const enBorrado = clienteFalso([{ data: viaje(), error: null }, encontrada(), { data: null, error }]);
    const sinFilas = clienteFalso([{ data: viaje(), error: null }, encontrada(), { data: [], error: null }]);

    assert.deepEqual(await actividadService.eliminar(enViaje, USUARIO, VIAJE_ID, ACTIVIDAD_ID), { error });
    assert.deepEqual(await actividadService.eliminar(enActividad, USUARIO, VIAJE_ID, ACTIVIDAD_ID), { error });
    assert.deepEqual(await actividadService.eliminar(enBorrado, USUARIO, VIAJE_ID, ACTIVIDAD_ID), { error });
    assert.deepEqual(await actividadService.eliminar(sinFilas, USUARIO, VIAJE_ID, ACTIVIDAD_ID), {
      error: { code: 'sin_filas' },
    });
  });
});
