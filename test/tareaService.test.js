// Pruebas del servicio de tareas (PB-41): listar, crear, marcar, editar y borrar.
// Supabase se sustituye por un cliente falso y viajeService.obtener por un mock
const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const tareaService = require('../src/services/tareaService');
const viajeService = require('../src/services/viajeService');

const USUARIO_ID = 'df77cba6-4be5-4cbc-814b-1e228dd73dcc';
const OTRO_ID = '5b1f0c2e-8a7d-4c3b-9e6f-2d4a1b3c5e7f';
const AJENO_ID = '123e4567-e89b-12d3-a456-426614174999';
const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const TAREA_ID = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';

const VIAJE = {
  id: VIAJE_ID,
  estado: 'activo',
  miembros: [
    { usuario_id: USUARIO_ID, nombre: 'Adriana', avatar_url: null },
    { usuario_id: OTRO_ID, nombre: 'Berta', avatar_url: 'https://x.test/b.png' },
  ],
};

const FILA = { id: TAREA_ID, texto: 'Reservar la cena', hecha: false, hecha_en: null, creado_en: '2027-05-01T10:00:00Z', responsable_id: OTRO_ID };
const TAREA = {
  id: TAREA_ID,
  texto: 'Reservar la cena',
  hecha: false,
  hecha_en: null,
  creado_en: '2027-05-01T10:00:00Z',
  responsable: { usuario_id: OTRO_ID, nombre: 'Berta', avatar_url: 'https://x.test/b.png' },
};

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

describe('tareaService.listar', () => {
  it('devuelve las tareas del viaje por antigüedad, con el responsable resuelto con los miembros', async () => {
    viajeVisible(VIAJE);
    const { cliente, consultas } = clienteFalso({ data: [FILA], error: null });

    const resultado = await tareaService.listar(cliente, USUARIO_ID, VIAJE_ID);

    assert.deepEqual(resultado, { estado: 'ok', tareas: [TAREA] });
    assert.deepEqual(operacion(consultas[0], 'order'), ['order', 'creado_en', { ascending: true }]);
  });

  it('también lista en un viaje finalizado y un responsable que ya no es miembro sale sin nombre', async () => {
    viajeVisible({ ...VIAJE, estado: 'finalizado' });
    const { cliente } = clienteFalso({ data: [{ ...FILA, responsable_id: AJENO_ID }], error: null });

    const { estado, tareas } = await tareaService.listar(cliente, USUARIO_ID, VIAJE_ID);

    assert.equal(estado, 'ok');
    assert.deepEqual(tareas[0].responsable, { usuario_id: AJENO_ID, nombre: null, avatar_url: null });
  });

  it('un viaje que no existe o no es del usuario da no_existe', async () => {
    viajeVisible(null);
    assert.deepEqual(await tareaService.listar(clienteFalso().cliente, USUARIO_ID, VIAJE_ID), { estado: 'no_existe' });
  });

  it('propaga el error de la base de datos', async () => {
    viajeVisible(VIAJE);
    const { cliente } = clienteFalso({ data: null, error: { code: 'x' } });
    assert.deepEqual((await tareaService.listar(cliente, USUARIO_ID, VIAJE_ID)).error, { code: 'x' });
  });
});

describe('tareaService.crear', () => {
  it('crea la tarea con el responsable y quien la crea', async () => {
    viajeVisible(VIAJE);
    const { cliente, consultas } = clienteFalso({ data: FILA, error: null });

    const resultado = await tareaService.crear(cliente, USUARIO_ID, VIAJE_ID, { texto: 'Reservar la cena', responsableId: OTRO_ID });

    assert.deepEqual(resultado, { estado: 'ok', tarea: TAREA });
    assert.deepEqual(operacion(consultas[0], 'insert')[1], {
      viaje_id: VIAJE_ID,
      texto: 'Reservar la cena',
      responsable_id: OTRO_ID,
      creada_por: USUARIO_ID,
    });
  });


  it('un viaje finalizado da no_activo y uno que no es del usuario no_existe', async () => {
    const { cliente, consultas } = clienteFalso();
    viajeVisible({ ...VIAJE, estado: 'finalizado' });
    assert.deepEqual(await tareaService.crear(cliente, USUARIO_ID, VIAJE_ID, { texto: 'x', responsableId: OTRO_ID }), { estado: 'no_activo' });
    mock.restoreAll();
    viajeVisible(null);
    assert.deepEqual(await tareaService.crear(cliente, USUARIO_ID, VIAJE_ID, { texto: 'x', responsableId: OTRO_ID }), { estado: 'no_existe' });
    assert.equal(consultas.length, 0);
  });

});

describe('tareaService.editar', () => {
  it('marca la tarea como hecha con su fecha y la desmarca dejándola a null', async () => {
    viajeVisible(VIAJE);
    const hecha = { ...FILA, hecha: true, hecha_en: '2027-05-02T09:00:00Z' };
    const marcar = clienteFalso({ data: [hecha], error: null });

    const marcada = await tareaService.editar(marcar.cliente, USUARIO_ID, VIAJE_ID, TAREA_ID, { hecha: true });

    assert.equal(marcada.tarea.hecha, true);
    const [, cambios] = operacion(marcar.consultas[0], 'update');
    assert.equal(cambios.hecha, true);
    assert.match(cambios.hecha_en, /^\d{4}-\d{2}-\d{2}T/);

    const desmarcar = clienteFalso({ data: [FILA], error: null });
    await tareaService.editar(desmarcar.cliente, USUARIO_ID, VIAJE_ID, TAREA_ID, { hecha: false });
    assert.deepEqual(operacion(desmarcar.consultas[0], 'update')[1], { hecha: false, hecha_en: null });
  });



  it('un responsable ajeno, un viaje finalizado y un viaje inexistente se rechazan sin escribir', async () => {
    const { cliente, consultas } = clienteFalso();
    viajeVisible(VIAJE);
    assert.deepEqual(await tareaService.editar(cliente, USUARIO_ID, VIAJE_ID, TAREA_ID, { responsableId: AJENO_ID }), { estado: 'responsable_no_miembro' });
    mock.restoreAll();
    viajeVisible({ ...VIAJE, estado: 'finalizado' });
    assert.deepEqual(await tareaService.editar(cliente, USUARIO_ID, VIAJE_ID, TAREA_ID, { hecha: true }), { estado: 'no_activo' });
    mock.restoreAll();
    viajeVisible(null);
    assert.deepEqual(await tareaService.editar(cliente, USUARIO_ID, VIAJE_ID, TAREA_ID, { hecha: true }), { estado: 'no_existe' });
    assert.equal(consultas.length, 0);
  });

});

describe('tareaService.borrar', () => {
  it('borra la tarea del viaje', async () => {
    viajeVisible(VIAJE);
    const { cliente, consultas } = clienteFalso({ data: [{ id: TAREA_ID }], error: null });
    assert.deepEqual(await tareaService.borrar(cliente, USUARIO_ID, VIAJE_ID, TAREA_ID), { estado: 'ok' });
    assert.deepEqual(consultas[0].operaciones.filter(([m]) => m === 'eq'), [
      ['eq', 'id', TAREA_ID],
      ['eq', 'viaje_id', VIAJE_ID],
    ]);
  });



});
