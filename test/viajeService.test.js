const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const viajeService = require('../src/services/viajeService');

const USUARIO = 'df77cba6-4be5-4cbc-814b-1e228dd73dcc';
const OTRO = 'a1b2c3d4-0000-4000-8000-000000000001';
const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';

// Cliente de Supabase falso: cada consulta encadenable (from().select().eq()...) se resuelve con la
// siguiente respuesta preparada, y se apuntan sus operaciones para comprobarlas después
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

// Fila de viajes tal como la devuelve el select con los miembros embebidos
const fila = (datos = {}, rol = 'creador') => ({
  id: VIAJE_ID,
  nombre: 'Roma 2027',
  destino: 'Roma',
  descripcion: null,
  fecha_inicio: '2027-05-12',
  fecha_fin: '2027-05-15',
  moneda: 'EUR',
  presupuesto: 850,
  estado: 'activo',
  creado_en: '2026-10-12T10:00:00Z',
  miembros_viaje: [
    { usuario_id: USUARIO, rol, abandonado_en: null, perfiles: { nombre: 'Adriana', avatar_url: null } },
    { usuario_id: OTRO, rol: rol === 'creador' ? 'miembro' : 'creador', abandonado_en: null, perfiles: { nombre: 'Berta', avatar_url: null } },
  ],
  ...datos,
});

const encontrado = (datos, rol) => ({ data: fila(datos, rol), error: null });
const actualizado = { data: [{ id: VIAJE_ID }], error: null };
const operacion = (consulta, metodo) => consulta.operaciones.find(([m]) => m === metodo);

describe('viajeService.editar', () => {
  it('actualiza los campos del viaje del creador y devuelve el viaje actualizado', async () => {
    const cliente = clienteFalso([encontrado(), actualizado, encontrado({ nombre: 'Roma 2028', presupuesto: 950 })]);

    const resultado = await viajeService.editar(cliente, USUARIO, VIAJE_ID, { nombre: 'Roma 2028', presupuesto: 950 });

    assert.equal(resultado.estado, 'ok');
    assert.equal(resultado.viaje.nombre, 'Roma 2028');
    assert.equal(resultado.viaje.rol, 'creador');
    const update = cliente.consultas[1];
    assert.equal(update.tabla, 'viajes');
    assert.deepEqual(operacion(update, 'update'), ['update', { nombre: 'Roma 2028', presupuesto: 950 }]);
    assert.deepEqual(operacion(update, 'eq'), ['eq', 'id', VIAJE_ID]);
  });

  it('no deja editar a un miembro que no es el creador', async () => {
    const cliente = clienteFalso([encontrado({}, 'miembro')]);

    const resultado = await viajeService.editar(cliente, USUARIO, VIAJE_ID, { nombre: 'X' });

    assert.deepEqual(resultado, { estado: 'no_creador' });
    assert.equal(cliente.consultas.length, 1);
  });

  it('no deja editar un viaje archivado', async () => {
    const cliente = clienteFalso([encontrado({ estado: 'archivado' })]);

    assert.deepEqual(await viajeService.editar(cliente, USUARIO, VIAJE_ID, { nombre: 'X' }), { estado: 'no_activo' });
    assert.equal(cliente.consultas.length, 1);
  });

  it('distingue un viaje inexistente o ajeno', async () => {
    const cliente = clienteFalso([{ data: null, error: null }]);

    assert.deepEqual(await viajeService.editar(cliente, USUARIO, VIAJE_ID, { nombre: 'X' }), { estado: 'no_existe' });
  });

  it('propaga el error de Supabase al actualizar (p. ej. un CHECK de fechas)', async () => {
    const cliente = clienteFalso([encontrado(), { data: null, error: { code: '23514' } }]);

    assert.deepEqual(await viajeService.editar(cliente, USUARIO, VIAJE_ID, { fecha_fin: '2027-05-01' }), {
      error: { code: '23514' },
    });
  });

  it('trata como error que RLS no deje actualizar ninguna fila', async () => {
    const cliente = clienteFalso([encontrado(), { data: [], error: null }]);

    const resultado = await viajeService.editar(cliente, USUARIO, VIAJE_ID, { nombre: 'X' });

    assert.ok(resultado.error);
  });
});

describe('viajeService.archivar', () => {
  it('archiva un viaje activo guardando el momento del cierre', async () => {
    const cliente = clienteFalso([encontrado(), actualizado, encontrado({ estado: 'archivado' })]);

    const resultado = await viajeService.archivar(cliente, USUARIO, VIAJE_ID);

    assert.equal(resultado.estado, 'ok');
    assert.equal(resultado.viaje.estado, 'archivado');
    const [, cambios] = operacion(cliente.consultas[1], 'update');
    assert.equal(cambios.estado, 'archivado');
    assert.ok(!Number.isNaN(Date.parse(cambios.finalizado_en)));
  });

  it('archiva un viaje finalizado sin cambiar su fecha de cierre', async () => {
    const cliente = clienteFalso([encontrado({ estado: 'finalizado' }), actualizado, encontrado({ estado: 'archivado' })]);

    await viajeService.archivar(cliente, USUARIO, VIAJE_ID);

    assert.deepEqual(operacion(cliente.consultas[1], 'update'), ['update', { estado: 'archivado' }]);
  });

  it('no vuelve a archivar un viaje ya archivado', async () => {
    const cliente = clienteFalso([encontrado({ estado: 'archivado' })]);

    assert.deepEqual(await viajeService.archivar(cliente, USUARIO, VIAJE_ID), { estado: 'ya_archivado' });
  });

  it('solo archiva el creador', async () => {
    const cliente = clienteFalso([encontrado({}, 'miembro')]);

    assert.deepEqual(await viajeService.archivar(cliente, USUARIO, VIAJE_ID), { estado: 'no_creador' });
  });
});

describe('viajeService.eliminar', () => {
  it('elimina un viaje archivado del creador', async () => {
    const cliente = clienteFalso([encontrado({ estado: 'archivado' }), { data: [{ id: VIAJE_ID }], error: null }]);

    assert.deepEqual(await viajeService.eliminar(cliente, USUARIO, VIAJE_ID), { estado: 'ok' });
    const borrado = cliente.consultas[1];
    assert.ok(operacion(borrado, 'delete'));
    assert.deepEqual(operacion(borrado, 'eq'), ['eq', 'id', VIAJE_ID]);
  });

  it('no elimina un viaje que no está archivado', async () => {
    const cliente = clienteFalso([encontrado()]);

    assert.deepEqual(await viajeService.eliminar(cliente, USUARIO, VIAJE_ID), { estado: 'no_archivado' });
    assert.equal(cliente.consultas.length, 1);
  });

  it('solo elimina el creador', async () => {
    const cliente = clienteFalso([encontrado({ estado: 'archivado' }, 'miembro')]);

    assert.deepEqual(await viajeService.eliminar(cliente, USUARIO, VIAJE_ID), { estado: 'no_creador' });
  });

  it('trata como error que RLS no deje borrar el viaje', async () => {
    const cliente = clienteFalso([encontrado({ estado: 'archivado' }), { data: [], error: null }]);

    assert.ok((await viajeService.eliminar(cliente, USUARIO, VIAJE_ID)).error);
  });
});
