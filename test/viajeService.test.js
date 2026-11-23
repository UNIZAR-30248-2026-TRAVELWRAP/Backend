const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const viajeService = require('../src/services/viajeService');

const USUARIO = 'df77cba6-4be5-4cbc-814b-1e228dd73dcc';
const OTRO = 'a1b2c3d4-0000-4000-8000-000000000001';
const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';

// Cliente de Supabase falso: cada consulta encadenable (from().select().eq()...) se resuelve con la
// siguiente respuesta preparada, y se apuntan sus operaciones para comprobarlas después
const clienteFalso = (respuestas, respuestasStorage = []) => {
  const consultas = [];
  // Orden de las llamadas a rpc y a Storage, para comprobar que los archivos se borran antes que el viaje
  const orden = [];
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
  // rpc se resuelve con la siguiente respuesta preparada y apunta su nombre y parámetros
  const llamadasRpc = [];
  const rpc = async (nombre, parametros) => {
    llamadasRpc.push([nombre, parametros]);
    orden.push(`rpc:${nombre}`);
    return respuestas.shift();
  };
  // storage.from(bucket).remove(rutas) apunta bucket y rutas; sin respuesta preparada borra sin error
  const llamadasStorage = [];
  const storage = {
    from: (bucket) => ({
      remove: async (rutas) => {
        llamadasStorage.push([bucket, rutas]);
        orden.push(`storage:${bucket}`);
        return respuestasStorage.shift() ?? { data: [], error: null };
      },
    }),
  };
  return { from, rpc, storage, consultas, llamadasRpc, llamadasStorage, orden };
};

// Fila de viajes tal como la devuelve el select con los miembros embebidos
// «yo» sobrescribe las columnas de la fila del propio usuario en miembros_viaje (archivado_en, eliminado_en...)
const fila = (datos = {}, rol = 'creador', yo = {}) => ({
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
    {
      usuario_id: USUARIO,
      rol,
      abandonado_en: null,
      archivado_en: null,
      eliminado_en: null,
      perfiles: { nombre: 'Adriana', avatar_url: null },
      ...yo,
    },
    {
      usuario_id: OTRO,
      rol: rol === 'creador' ? 'miembro' : 'creador',
      abandonado_en: null,
      archivado_en: null,
      eliminado_en: null,
      perfiles: { nombre: 'Berta', avatar_url: null },
    },
  ],
  ...datos,
});

const encontrado = (datos, rol, yo) => ({ data: fila(datos, rol, yo), error: null });
const ARCHIVADO = { archivado_en: '2026-11-13T10:00:00Z' };
const FINALIZADO = { estado: 'finalizado' };
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

  it('deja editar a un miembro que no es el creador', async () => {
    const cliente = clienteFalso([
      encontrado({}, 'miembro'),
      actualizado,
      encontrado({ nombre: 'X' }, 'miembro'),
    ]);

    const resultado = await viajeService.editar(cliente, USUARIO, VIAJE_ID, { nombre: 'X' });

    assert.equal(resultado.estado, 'ok');
    assert.equal(resultado.viaje.rol, 'miembro');
    assert.equal(resultado.viaje.nombre, 'X');
  });

  it('no deja editar si el usuario no es miembro del viaje', async () => {
    const cliente = clienteFalso([{ data: null, error: null }]);

    assert.deepEqual(await viajeService.editar(cliente, USUARIO, VIAJE_ID, { nombre: 'X' }), { estado: 'no_existe' });
  });

  it('no deja editar un viaje finalizado', async () => {
    const cliente = clienteFalso([encontrado(FINALIZADO)]);

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

describe('viajeService.finalizar', () => {
  it('finaliza un viaje activo guardando el momento del cierre', async () => {
    const cliente = clienteFalso([encontrado(), actualizado, encontrado({ estado: 'finalizado' })]);

    const resultado = await viajeService.finalizar(cliente, USUARIO, VIAJE_ID);

    assert.equal(resultado.estado, 'ok');
    assert.equal(resultado.viaje.estado, 'finalizado');
    const [, cambios] = operacion(cliente.consultas[1], 'update');
    assert.equal(cambios.estado, 'finalizado');
    assert.ok(!Number.isNaN(Date.parse(cambios.finalizado_en)));
  });

  it('no finaliza un viaje ya finalizado, lo tenga archivado o no el usuario', async () => {
    for (const yo of [{}, ARCHIVADO]) {
      const cliente = clienteFalso([encontrado(FINALIZADO, 'creador', yo)]);
      assert.deepEqual(await viajeService.finalizar(cliente, USUARIO, VIAJE_ID), { estado: 'ya_finalizado' });
    }
  });

  it('también lo finaliza un miembro que no es el creador', async () => {
    const cliente = clienteFalso([encontrado({}, 'miembro'), actualizado, encontrado({ estado: 'finalizado' }, 'miembro')]);

    const resultado = await viajeService.finalizar(cliente, USUARIO, VIAJE_ID);

    assert.equal(resultado.estado, 'ok');
    assert.equal(resultado.viaje.estado, 'finalizado');
  });

  it('indica que el viaje no existe', async () => {
    const cliente = clienteFalso([{ data: null, error: null }]);

    assert.deepEqual(await viajeService.finalizar(cliente, USUARIO, VIAJE_ID), { estado: 'no_existe' });
  });

  it('devuelve el error si falla la base de datos', async () => {
    const cliente = clienteFalso([{ data: null, error: { code: 'PGRST000' } }]);

    const resultado = await viajeService.finalizar(cliente, USUARIO, VIAJE_ID);

    assert.deepEqual(resultado.error, { code: 'PGRST000' });
  });
});

describe('viajeService.obtener y listar (archivado por usuario)', () => {
  it('marca el viaje como archivado solo según la fila del propio usuario', async () => {
    const archivado = await viajeService.obtener(clienteFalso([encontrado(FINALIZADO, 'miembro', ARCHIVADO)]), USUARIO, VIAJE_ID);
    assert.equal(archivado.viaje.archivado, true);

    const sinArchivar = await viajeService.obtener(clienteFalso([encontrado(FINALIZADO)]), USUARIO, VIAJE_ID);
    assert.equal(sinArchivar.viaje.archivado, false);
  });

  it('no devuelve archivado_en ni eliminado_en', async () => {
    const { viaje } = await viajeService.obtener(clienteFalso([encontrado(FINALIZADO, 'creador', ARCHIVADO)]), USUARIO, VIAJE_ID);

    assert.equal('archivado_en' in viaje, false);
    assert.equal('eliminado_en' in viaje, false);
    assert.equal(viaje.miembros.length, 2);
  });

  it('da el viaje por inexistente si el usuario ya lo ha eliminado', async () => {
    const cliente = clienteFalso([encontrado(FINALIZADO, 'creador', { ...ARCHIVADO, eliminado_en: '2026-11-13T11:00:00Z' })]);

    assert.deepEqual(await viajeService.obtener(cliente, USUARIO, VIAJE_ID), { viaje: null });
  });

  it('un miembro que ha eliminado el viaje no afecta a lo que ven los demás', async () => {
    const datos = fila(FINALIZADO);
    datos.miembros_viaje[1].eliminado_en = '2026-11-13T11:00:00Z';

    const { viaje } = await viajeService.obtener(clienteFalso([{ data: datos, error: null }]), USUARIO, VIAJE_ID);

    assert.equal(viaje.miembros.length, 2);
  });

  it('lista por defecto solo los viajes no archivados y sin los eliminados', async () => {
    const otro = fila({ id: 'b', ...FINALIZADO });
    const archivado = fila({ id: 'c', ...FINALIZADO }, 'creador', ARCHIVADO);
    const eliminado = fila({ id: 'd', ...FINALIZADO }, 'creador', { ...ARCHIVADO, eliminado_en: '2026-11-13T11:00:00Z' });
    const cliente = clienteFalso([{ data: [fila(), otro, archivado, eliminado], error: null }]);

    const { viajes } = await viajeService.listar(cliente, USUARIO);

    assert.deepEqual(viajes.map((v) => v.id), [VIAJE_ID, 'b']);
  });

  it('con archivados: true lista solo los que el usuario ha archivado', async () => {
    const archivado = fila({ id: 'c', ...FINALIZADO }, 'miembro', ARCHIVADO);
    const eliminado = fila({ id: 'd', ...FINALIZADO }, 'creador', { ...ARCHIVADO, eliminado_en: '2026-11-13T11:00:00Z' });
    const cliente = clienteFalso([{ data: [fila(), archivado, eliminado], error: null }]);

    const { viajes } = await viajeService.listar(cliente, USUARIO, { archivados: true });

    assert.deepEqual(viajes.map((v) => v.id), ['c']);
  });

  it('filtra por estado en la consulta y propaga el error de Supabase', async () => {
    const cliente = clienteFalso([{ data: [], error: null }]);
    await viajeService.listar(cliente, USUARIO, { estado: 'finalizado' });
    assert.deepEqual(operacion(cliente.consultas[0], 'eq'), ['eq', 'estado', 'finalizado']);

    const conError = clienteFalso([{ data: null, error: { code: 'PGRST000' } }]);
    assert.deepEqual(await viajeService.listar(conError, USUARIO), { error: { code: 'PGRST000' } });
  });
});

describe('viajeService.archivar', () => {
  it('archiva para el usuario un viaje finalizado con la función SQL y devuelve el viaje', async () => {
    const cliente = clienteFalso([encontrado(FINALIZADO), { data: true, error: null }, encontrado(FINALIZADO, 'creador', ARCHIVADO)]);

    const resultado = await viajeService.archivar(cliente, USUARIO, VIAJE_ID);

    assert.equal(resultado.estado, 'ok');
    assert.equal(resultado.viaje.archivado, true);
    assert.equal(resultado.viaje.estado, 'finalizado');
    assert.deepEqual(cliente.llamadasRpc, [['archivar_viaje', { p_viaje_id: VIAJE_ID }]]);
  });

  it('también lo puede archivar un miembro que no es el creador', async () => {
    const cliente = clienteFalso([
      encontrado(FINALIZADO, 'miembro'),
      { data: true, error: null },
      encontrado(FINALIZADO, 'miembro', ARCHIVADO),
    ]);

    const resultado = await viajeService.archivar(cliente, USUARIO, VIAJE_ID);

    assert.equal(resultado.estado, 'ok');
    assert.equal(resultado.viaje.rol, 'miembro');
  });

  it('no archiva un viaje activo', async () => {
    const cliente = clienteFalso([encontrado()]);

    assert.deepEqual(await viajeService.archivar(cliente, USUARIO, VIAJE_ID), { estado: 'no_finalizado' });
    assert.equal(cliente.llamadasRpc.length, 0);
  });

  it('no vuelve a archivar un viaje que el usuario ya tiene archivado', async () => {
    const cliente = clienteFalso([encontrado(FINALIZADO, 'creador', ARCHIVADO)]);

    assert.deepEqual(await viajeService.archivar(cliente, USUARIO, VIAJE_ID), { estado: 'ya_archivado' });
    assert.equal(cliente.llamadasRpc.length, 0);
  });

  it('responde no_existe si el viaje no existe, no es miembro o lo ha eliminado', async () => {
    assert.deepEqual(await viajeService.archivar(clienteFalso([{ data: null, error: null }]), USUARIO, VIAJE_ID), {
      estado: 'no_existe',
    });
    const eliminado = clienteFalso([encontrado(FINALIZADO, 'creador', { ...ARCHIVADO, eliminado_en: '2026-11-13T11:00:00Z' })]);
    assert.deepEqual(await viajeService.archivar(eliminado, USUARIO, VIAJE_ID), { estado: 'no_existe' });
  });

  it('devuelve el error si falla la consulta, la función SQL o si no archiva nada', async () => {
    const consulta = clienteFalso([{ data: null, error: { code: 'PGRST000' } }]);
    assert.deepEqual((await viajeService.archivar(consulta, USUARIO, VIAJE_ID)).error, { code: 'PGRST000' });

    const funcion = clienteFalso([encontrado(FINALIZADO), { data: null, error: { code: 'PGRST001' } }]);
    assert.deepEqual((await viajeService.archivar(funcion, USUARIO, VIAJE_ID)).error, { code: 'PGRST001' });

    const sinCambios = clienteFalso([encontrado(FINALIZADO), { data: false, error: null }]);
    assert.ok((await viajeService.archivar(sinCambios, USUARIO, VIAJE_ID)).error);
  });

  it('devuelve el error si no puede leer el viaje después de archivarlo', async () => {
    const cliente = clienteFalso([encontrado(FINALIZADO), { data: true, error: null }, { data: null, error: { code: 'PGRST002' } }]);

    assert.deepEqual((await viajeService.archivar(cliente, USUARIO, VIAJE_ID)).error, { code: 'PGRST002' });
  });
});

describe('viajeService.desarchivar', () => {
  it('desarchiva para el usuario con la función SQL y el viaje sigue finalizado', async () => {
    const cliente = clienteFalso([
      encontrado(FINALIZADO, 'creador', ARCHIVADO),
      { data: true, error: null },
      encontrado(FINALIZADO),
    ]);

    const resultado = await viajeService.desarchivar(cliente, USUARIO, VIAJE_ID);

    assert.equal(resultado.estado, 'ok');
    assert.equal(resultado.viaje.archivado, false);
    assert.equal(resultado.viaje.estado, 'finalizado');
    assert.deepEqual(cliente.llamadasRpc, [['desarchivar_viaje_propio', { p_viaje_id: VIAJE_ID }]]);
  });

  it('también lo puede desarchivar un miembro que no es el creador', async () => {
    const cliente = clienteFalso([
      encontrado(FINALIZADO, 'miembro', ARCHIVADO),
      { data: true, error: null },
      encontrado(FINALIZADO, 'miembro'),
    ]);

    assert.equal((await viajeService.desarchivar(cliente, USUARIO, VIAJE_ID)).estado, 'ok');
  });

  it('no desarchiva un viaje que el usuario no tiene archivado', async () => {
    const cliente = clienteFalso([encontrado(FINALIZADO)]);

    assert.deepEqual(await viajeService.desarchivar(cliente, USUARIO, VIAJE_ID), { estado: 'no_estaba_archivado' });
    assert.equal(cliente.llamadasRpc.length, 0);
  });

  it('responde no_existe si el viaje no existe o no es miembro', async () => {
    const cliente = clienteFalso([{ data: null, error: null }]);

    assert.deepEqual(await viajeService.desarchivar(cliente, USUARIO, VIAJE_ID), { estado: 'no_existe' });
  });

  it('devuelve el error si falla la consulta o la función SQL', async () => {
    const consulta = clienteFalso([{ data: null, error: { code: 'PGRST000' } }]);
    assert.deepEqual((await viajeService.desarchivar(consulta, USUARIO, VIAJE_ID)).error, { code: 'PGRST000' });

    const funcion = clienteFalso([encontrado(FINALIZADO, 'creador', ARCHIVADO), { data: null, error: { code: 'PGRST001' } }]);
    assert.deepEqual((await viajeService.desarchivar(funcion, USUARIO, VIAJE_ID)).error, { code: 'PGRST001' });
  });

  it('trata como error que la función no desarchive nada', async () => {
    const cliente = clienteFalso([encontrado(FINALIZADO, 'creador', ARCHIVADO), { data: false, error: null }]);

    assert.ok((await viajeService.desarchivar(cliente, USUARIO, VIAJE_ID)).error);
  });
});

describe('viajeService.eliminar', () => {
  const archivado = () => encontrado(FINALIZADO, 'creador', ARCHIVADO);
  const ultimo = (documentos = [], fotos = []) => ({ data: { estado: 'ok', ultimo: true, documentos, fotos }, error: null });
  const noUltimo = { data: { estado: 'ok', ultimo: false }, error: null };
  const rutas = (n, prefijo) => Array.from({ length: n }, (_, i) => `${VIAJE_ID}/${prefijo}${i}`);

  it('si no es el último miembro lo elimina solo para él, sin tocar Storage ni borrar el viaje', async () => {
    const cliente = clienteFalso([archivado(), noUltimo]);

    assert.deepEqual(await viajeService.eliminar(cliente, USUARIO, VIAJE_ID), { estado: 'ok' });
    assert.deepEqual(cliente.orden, ['rpc:eliminar_viaje']);
    assert.deepEqual(cliente.llamadasRpc, [['eliminar_viaje', { p_viaje_id: VIAJE_ID }]]);
    assert.equal(cliente.llamadasStorage.length, 0);
  });

  it('también lo puede eliminar un miembro que no es el creador', async () => {
    const cliente = clienteFalso([encontrado(FINALIZADO, 'miembro', ARCHIVADO), noUltimo]);

    assert.deepEqual(await viajeService.eliminar(cliente, USUARIO, VIAJE_ID), { estado: 'ok' });
  });

  it('si es el último borra primero los documentos y las fotos y después el viaje', async () => {
    const documentos = [`${VIAJE_ID}/a.pdf`];
    const fotos = [`${VIAJE_ID}/f1.jpg`, `${VIAJE_ID}/f2.jpg`];
    const cliente = clienteFalso([archivado(), ultimo(documentos, fotos), { data: true, error: null }]);

    assert.deepEqual(await viajeService.eliminar(cliente, USUARIO, VIAJE_ID), { estado: 'ok' });
    assert.deepEqual(cliente.llamadasStorage, [
      ['documentos', documentos],
      ['fotos', fotos],
    ]);
    assert.deepEqual(cliente.orden, ['rpc:eliminar_viaje', 'storage:documentos', 'storage:fotos', 'rpc:borrar_viaje']);
    assert.deepEqual(cliente.llamadasRpc[1], ['borrar_viaje', { p_viaje_id: VIAJE_ID }]);
  });

  it('si es el último borra también la portada del viaje', async () => {
    const portadas = [`${VIAJE_ID}/p.jpg`];
    const respuesta = { data: { estado: 'ok', ultimo: true, documentos: [], fotos: [], portadas }, error: null };
    const cliente = clienteFalso([archivado(), respuesta, { data: true, error: null }]);

    assert.deepEqual(await viajeService.eliminar(cliente, USUARIO, VIAJE_ID), { estado: 'ok' });
    assert.deepEqual(cliente.llamadasStorage, [['portadas', portadas]]);
    assert.deepEqual(cliente.orden, ['rpc:eliminar_viaje', 'storage:portadas', 'rpc:borrar_viaje']);
  });

  it('con listas de rutas vacías no llama a Storage y borra el viaje', async () => {
    const cliente = clienteFalso([archivado(), ultimo([], []), { data: true, error: null }]);

    assert.deepEqual(await viajeService.eliminar(cliente, USUARIO, VIAJE_ID), { estado: 'ok' });
    assert.equal(cliente.llamadasStorage.length, 0);
    assert.deepEqual(cliente.orden, ['rpc:eliminar_viaje', 'rpc:borrar_viaje']);
  });

  it('borra los archivos en lotes de 100', async () => {
    const documentos = rutas(250, 'd');
    const cliente = clienteFalso([archivado(), ultimo(documentos, []), { data: true, error: null }]);

    assert.deepEqual(await viajeService.eliminar(cliente, USUARIO, VIAJE_ID), { estado: 'ok' });
    assert.deepEqual(cliente.llamadasStorage.map(([bucket, lote]) => [bucket, lote.length]), [
      ['documentos', 100],
      ['documentos', 100],
      ['documentos', 50],
    ]);
    assert.deepEqual(cliente.llamadasStorage.flatMap(([, lote]) => lote), documentos);
  });

  it('si Storage falla devuelve el error y no borra el viaje', async () => {
    const cliente = clienteFalso([archivado(), ultimo(rutas(1, 'd'), rutas(1, 'f'))], [{ data: null, error: { message: 'fallo' } }]);

    assert.deepEqual((await viajeService.eliminar(cliente, USUARIO, VIAJE_ID)).error, { message: 'fallo' });
    assert.deepEqual(cliente.orden, ['rpc:eliminar_viaje', 'storage:documentos']);
  });

  it('si falla al borrar las fotos tampoco borra el viaje', async () => {
    const cliente = clienteFalso(
      [archivado(), ultimo(rutas(1, 'd'), rutas(1, 'f'))],
      [{ data: [], error: null }, { data: null, error: { message: 'fallo' } }],
    );

    assert.ok((await viajeService.eliminar(cliente, USUARIO, VIAJE_ID)).error);
    assert.equal(cliente.llamadasRpc.length, 1);
  });

  it('si Storage no borra nada pero borrar_viaje devuelve false, devuelve error', async () => {
    // Storage no da error cuando una política le impide borrar: lo detecta borrar_viaje al ver que quedan archivos
    const cliente = clienteFalso([archivado(), ultimo(rutas(1, 'd'), []), { data: false, error: null }]);

    assert.ok((await viajeService.eliminar(cliente, USUARIO, VIAJE_ID)).error);
  });

  it('si falla borrar_viaje devuelve el error', async () => {
    const cliente = clienteFalso([archivado(), ultimo([], []), { data: null, error: { code: 'PGRST000' } }]);

    assert.deepEqual((await viajeService.eliminar(cliente, USUARIO, VIAJE_ID)).error, { code: 'PGRST000' });
  });

  it('no elimina un viaje que el usuario no tiene archivado', async () => {
    const cliente = clienteFalso([encontrado(FINALIZADO)]);

    assert.deepEqual(await viajeService.eliminar(cliente, USUARIO, VIAJE_ID), { estado: 'no_archivado' });
    assert.equal(cliente.llamadasRpc.length, 0);
  });

  it('responde no_existe si el viaje no existe o no es miembro', async () => {
    const cliente = clienteFalso([{ data: null, error: null }]);

    assert.deepEqual(await viajeService.eliminar(cliente, USUARIO, VIAJE_ID), { estado: 'no_existe' });
  });

  it('devuelve el error si falla la consulta, si eliminar_viaje falla o si responde no_permitido', async () => {
    const consulta = clienteFalso([{ data: null, error: { code: 'PGRST000' } }]);
    assert.deepEqual((await viajeService.eliminar(consulta, USUARIO, VIAJE_ID)).error, { code: 'PGRST000' });

    const funcion = clienteFalso([archivado(), { data: null, error: { code: 'PGRST001' } }]);
    assert.deepEqual((await viajeService.eliminar(funcion, USUARIO, VIAJE_ID)).error, { code: 'PGRST001' });

    const noPermitido = clienteFalso([archivado(), { data: { estado: 'no_permitido' }, error: null }]);
    assert.ok((await viajeService.eliminar(noPermitido, USUARIO, VIAJE_ID)).error);
    assert.equal(noPermitido.llamadasStorage.length, 0);

    const vacia = clienteFalso([archivado(), { data: null, error: null }]);
    assert.ok((await viajeService.eliminar(vacia, USUARIO, VIAJE_ID)).error);
  });
});

describe('viajeService.abandonar', () => {
  it('llama a abandonar_viaje con el viaje y devuelve ok', async () => {
    const cliente = clienteFalso([{ data: { estado: 'ok' }, error: null }]);

    assert.deepEqual(await viajeService.abandonar(cliente, VIAJE_ID), { estado: 'ok' });
    assert.deepEqual(cliente.llamadasRpc, [['abandonar_viaje', { p_viaje_id: VIAJE_ID }]]);
  });

  it('devuelve el saldo cuando no está a cero', async () => {
    const cliente = clienteFalso([{ data: { estado: 'saldo_pendiente', saldo: -12.5 }, error: null }]);

    assert.deepEqual(await viajeService.abandonar(cliente, VIAJE_ID), { estado: 'saldo_pendiente', saldo: -12.5 });
  });

  it('pasa tal cual los motivos de la función SQL: no_miembro y no_activo', async () => {
    for (const estado of ['no_miembro', 'no_activo']) {
      const cliente = clienteFalso([{ data: { estado }, error: null }]);
      assert.deepEqual(await viajeService.abandonar(cliente, VIAJE_ID), { estado });
    }
  });

  it('devuelve el error si falla la función o si no responde nada útil', async () => {
    const falla = clienteFalso([{ data: null, error: { code: 'PGRST000' } }]);
    assert.deepEqual((await viajeService.abandonar(falla, VIAJE_ID)).error, { code: 'PGRST000' });

    const vacia = clienteFalso([{ data: null, error: null }]);
    assert.ok((await viajeService.abandonar(vacia, VIAJE_ID)).error);
  });
});

// Cliente falso con Storage para las portadas: upload, createSignedUrls y remove
const clienteConPortadas = (respuestas, { subida = { error: null }, borrado = 'ok' } = {}) => {
  const cliente = clienteFalso(respuestas);
  const storage = { subidas: [], firmas: [], borrados: [] };
  cliente.almacen = storage;
  cliente.storage = {
    from: (bucket) => ({
      upload: async (ruta, contenido, opciones) => {
        storage.subidas.push({ bucket, ruta, contenido, opciones });
        cliente.orden.push('storage:upload');
        return subida;
      },
      createSignedUrls: async (rutas, segundos) => {
        storage.firmas.push({ bucket, rutas, segundos });
        return { data: rutas.map((ruta) => ({ path: ruta, signedUrl: `https://storage.test/${ruta}?token=abc`, error: null })), error: null };
      },
      remove: async (rutas) => {
        storage.borrados.push({ bucket, rutas });
        cliente.orden.push('storage:remove');
        if (borrado === 'falla') throw new Error('fallo de Storage');
        return { data: [], error: null };
      },
    }),
  };
  return cliente;
};

const RUTA_ANTERIOR = `${VIAJE_ID}/anterior.jpg`;
const archivoPortada = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), tipoMime: 'image/jpeg' };
const rutaGuardada = (ruta) => ({ data: { portada_ruta: ruta }, error: null });
const funcionOk = { data: true, error: null };

describe('viajeService.subirPortada', () => {
  it('la sube a la carpeta del viaje, la apunta con cambiar_portada y devuelve el viaje con su URL firmada', async () => {
    const cliente = clienteConPortadas([encontrado(), rutaGuardada(null), funcionOk, encontrado({ portada_ruta: 'x' })]);

    const resultado = await viajeService.subirPortada(cliente, USUARIO, VIAJE_ID, archivoPortada);

    assert.equal(resultado.estado, 'ok');
    const [subida] = cliente.almacen.subidas;
    assert.equal(subida.bucket, 'portadas');
    assert.match(subida.ruta, new RegExp(`^${VIAJE_ID}/[0-9a-f-]{36}\\.jpg$`));
    assert.deepEqual(subida.opciones, { contentType: 'image/jpeg', upsert: false });
    assert.deepEqual(cliente.llamadasRpc, [['cambiar_portada', { p_viaje_id: VIAJE_ID, p_ruta: subida.ruta }]]);
    assert.equal(cliente.almacen.borrados.length, 0);
    assert.equal(resultado.viaje.portada_url, 'https://storage.test/x?token=abc');
    assert.equal('portada_ruta' in resultado.viaje, false);
  });

  it('también la puede subir un miembro que no es el creador', async () => {
    const cliente = clienteConPortadas([encontrado({}, 'miembro'), rutaGuardada(null), funcionOk, encontrado({}, 'miembro')]);

    const resultado = await viajeService.subirPortada(cliente, USUARIO, VIAJE_ID, archivoPortada);

    assert.equal(resultado.estado, 'ok');
    assert.equal(resultado.viaje.rol, 'miembro');
  });

  it('guarda un PNG con extensión png', async () => {
    const cliente = clienteConPortadas([encontrado(), rutaGuardada(null), funcionOk, encontrado()]);

    await viajeService.subirPortada(cliente, USUARIO, VIAJE_ID, { ...archivoPortada, tipoMime: 'image/png' });

    assert.match(cliente.almacen.subidas[0].ruta, /\.png$/);
  });

  it('al cambiar la portada borra el archivo anterior, después de apuntar el nuevo', async () => {
    const cliente = clienteConPortadas([encontrado(), rutaGuardada(RUTA_ANTERIOR), funcionOk, encontrado()]);

    await viajeService.subirPortada(cliente, USUARIO, VIAJE_ID, archivoPortada);

    assert.deepEqual(cliente.almacen.borrados, [{ bucket: 'portadas', rutas: [RUTA_ANTERIOR] }]);
    assert.deepEqual(cliente.orden, ['storage:upload', 'rpc:cambiar_portada', 'storage:remove']);
  });

  it('si no puede borrar el archivo anterior, la portada nueva se guarda igualmente', async () => {
    const cliente = clienteConPortadas([encontrado(), rutaGuardada(RUTA_ANTERIOR), funcionOk, encontrado()], { borrado: 'falla' });

    assert.equal((await viajeService.subirPortada(cliente, USUARIO, VIAJE_ID, archivoPortada)).estado, 'ok');
  });

  it('responde no_existe si el viaje no existe o no es miembro, sin subir nada', async () => {
    const cliente = clienteConPortadas([{ data: null, error: null }]);

    assert.deepEqual(await viajeService.subirPortada(cliente, USUARIO, VIAJE_ID, archivoPortada), { estado: 'no_existe' });
    assert.equal(cliente.almacen.subidas.length, 0);
  });

  it('responde no_activo si el viaje está finalizado, sin subir nada', async () => {
    const cliente = clienteConPortadas([encontrado(FINALIZADO)]);

    assert.deepEqual(await viajeService.subirPortada(cliente, USUARIO, VIAJE_ID, archivoPortada), { estado: 'no_activo' });
    assert.equal(cliente.almacen.subidas.length, 0);
  });

  it('devuelve el error si falla la consulta o la subida, sin llamar a cambiar_portada', async () => {
    const consulta = clienteConPortadas([{ data: null, error: { code: 'PGRST000' } }]);
    assert.deepEqual((await viajeService.subirPortada(consulta, USUARIO, VIAJE_ID, archivoPortada)).error, { code: 'PGRST000' });

    const subida = clienteConPortadas([encontrado()], { subida: { error: { message: 'fallo' } } });
    assert.deepEqual((await viajeService.subirPortada(subida, USUARIO, VIAJE_ID, archivoPortada)).error, { message: 'fallo' });
    assert.equal(subida.llamadasRpc.length, 0);
  });

  it('si falla cambiar_portada borra el archivo subido y conserva el anterior', async () => {
    const cliente = clienteConPortadas([encontrado(), rutaGuardada(RUTA_ANTERIOR), { data: null, error: { code: 'PGRST001' } }]);

    const resultado = await viajeService.subirPortada(cliente, USUARIO, VIAJE_ID, archivoPortada);

    assert.deepEqual(resultado.error, { code: 'PGRST001' });
    assert.deepEqual(cliente.almacen.borrados, [{ bucket: 'portadas', rutas: [cliente.almacen.subidas[0].ruta] }]);
  });

  it('trata como error que la función no cambie nada y borra el archivo subido', async () => {
    const cliente = clienteConPortadas([encontrado(), rutaGuardada(null), { data: false, error: null }]);

    assert.ok((await viajeService.subirPortada(cliente, USUARIO, VIAJE_ID, archivoPortada)).error);
    assert.equal(cliente.almacen.borrados.length, 1);
  });
});

describe('viajeService.quitarPortada', () => {
  it('la quita con cambiar_portada(null), borra su archivo y devuelve el viaje sin portada', async () => {
    const cliente = clienteConPortadas([encontrado(), rutaGuardada(RUTA_ANTERIOR), funcionOk, encontrado()]);

    const resultado = await viajeService.quitarPortada(cliente, USUARIO, VIAJE_ID);

    assert.equal(resultado.estado, 'ok');
    assert.equal(resultado.viaje.portada_url, null);
    assert.deepEqual(cliente.llamadasRpc, [['cambiar_portada', { p_viaje_id: VIAJE_ID, p_ruta: null }]]);
    assert.deepEqual(cliente.almacen.borrados, [{ bucket: 'portadas', rutas: [RUTA_ANTERIOR] }]);
  });

  it('también la puede quitar un miembro que no es el creador', async () => {
    const cliente = clienteConPortadas([encontrado({}, 'miembro'), rutaGuardada(RUTA_ANTERIOR), funcionOk, encontrado({}, 'miembro')]);

    assert.equal((await viajeService.quitarPortada(cliente, USUARIO, VIAJE_ID)).estado, 'ok');
  });

  it('si el viaje no tiene portada no cambia nada ni toca Storage', async () => {
    const cliente = clienteConPortadas([encontrado(), rutaGuardada(null), encontrado()]);

    const resultado = await viajeService.quitarPortada(cliente, USUARIO, VIAJE_ID);

    assert.equal(resultado.estado, 'ok');
    assert.equal(cliente.llamadasRpc.length, 0);
    assert.equal(cliente.almacen.borrados.length, 0);
  });

  it('responde no_existe o no_activo sin tocar nada', async () => {
    const inexistente = clienteConPortadas([{ data: null, error: null }]);
    assert.deepEqual(await viajeService.quitarPortada(inexistente, USUARIO, VIAJE_ID), { estado: 'no_existe' });

    const finalizado = clienteConPortadas([encontrado(FINALIZADO)]);
    assert.deepEqual(await viajeService.quitarPortada(finalizado, USUARIO, VIAJE_ID), { estado: 'no_activo' });
    assert.equal(finalizado.llamadasRpc.length, 0);
  });

  it('si falla cambiar_portada devuelve el error y no borra el archivo', async () => {
    const cliente = clienteConPortadas([encontrado(), rutaGuardada(RUTA_ANTERIOR), { data: null, error: { code: 'PGRST001' } }]);

    assert.deepEqual((await viajeService.quitarPortada(cliente, USUARIO, VIAJE_ID)).error, { code: 'PGRST001' });
    assert.equal(cliente.almacen.borrados.length, 0);
  });
});

describe('viajeService: portada_url en obtener, listar y crear', () => {
  it('obtener devuelve la URL firmada de una hora y no la ruta del archivo', async () => {
    const cliente = clienteConPortadas([encontrado({ portada_ruta: RUTA_ANTERIOR })]);

    const { viaje } = await viajeService.obtener(cliente, USUARIO, VIAJE_ID);

    assert.equal(viaje.portada_url, `https://storage.test/${RUTA_ANTERIOR}?token=abc`);
    assert.equal('portada_ruta' in viaje, false);
    assert.deepEqual(cliente.almacen.firmas, [{ bucket: 'portadas', rutas: [RUTA_ANTERIOR], segundos: 3600 }]);
  });

  it('un viaje sin portada tiene portada_url null y no pide firmas a Storage', async () => {
    const cliente = clienteConPortadas([encontrado()]);

    const { viaje } = await viajeService.obtener(cliente, USUARIO, VIAJE_ID);

    assert.equal(viaje.portada_url, null);
    assert.equal(cliente.almacen.firmas.length, 0);
  });

  it('listar firma todas las portadas con una sola petición a Storage', async () => {
    const otra = `b/otra.png`;
    const cliente = clienteConPortadas([
      {
        data: [fila({ portada_ruta: RUTA_ANTERIOR }), fila({ id: 'b', portada_ruta: otra }), fila({ id: 'c' })],
        error: null,
      },
    ]);

    const { viajes } = await viajeService.listar(cliente, USUARIO);

    assert.deepEqual(viajes.map((v) => v.portada_url), [
      `https://storage.test/${RUTA_ANTERIOR}?token=abc`,
      `https://storage.test/${otra}?token=abc`,
      null,
    ]);
    assert.equal(cliente.almacen.firmas.length, 1);
    assert.deepEqual(cliente.almacen.firmas[0].rutas, [RUTA_ANTERIOR, otra]);
  });

  it('si Storage no puede firmar una portada, el viaje se ve sin ella en lugar de fallar', async () => {
    const cliente = clienteConPortadas([encontrado({ portada_ruta: RUTA_ANTERIOR })]);
    cliente.storage.from = () => ({
      createSignedUrls: async (rutas) => ({ data: rutas.map((path) => ({ path, signedUrl: null, error: 'Object not found' })), error: null }),
    });

    const { viaje } = await viajeService.obtener(cliente, USUARIO, VIAJE_ID);

    assert.equal(viaje.portada_url, null);
  });

  it('un viaje recién creado no tiene portada', async () => {
    const creado = { id: VIAJE_ID, nombre: 'Roma 2027', destino: 'Roma', estado: 'activo' };
    const cliente = clienteFalso([{ data: { estado: 'ok', viaje: creado }, error: null }]);

    const resultado = await viajeService.crear(cliente, { nombre: 'Roma 2027' });

    assert.equal(resultado.viaje.portada_url, null);
  });
});
