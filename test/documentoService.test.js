// Pruebas del servicio de documentos: ruta en el bucket, rollback si falla el registro y orden del listado.
// Supabase (base de datos y Storage) se sustituye por un cliente falso
const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const documentoService = require('../src/services/documentoService');
const viajeService = require('../src/services/viajeService');

const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const USUARIO_ID = 'df77cba6-4be5-4cbc-814b-1e228dd73dcc';
const DATOS = { nombre: 'Billete de tren.pdf', buffer: Buffer.from('%PDF-1.4'), tipoMime: 'application/pdf' };

// Cliente falso: la consulta encadenada de la tabla devuelve la respuesta indicada y Storage guarda sus llamadas
const clienteFalso = ({ respuesta = { data: null, error: null }, subida = { error: null }, remove } = {}) => {
  const consultas = [];
  const storage = { subidas: [], borrados: [] };
  const from = (tabla) => {
    const consulta = { tabla, operaciones: [] };
    consultas.push(consulta);
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
  const cliente = {
    from,
    storage: {
      from: (bucket) => ({
        upload: async (ruta, contenido, opciones) => {
          storage.subidas.push({ bucket, ruta, contenido, opciones });
          return subida;
        },
        remove:
          remove ??
          (async (rutas) => {
            storage.borrados.push({ bucket, rutas });
            return { error: null };
          }),
      }),
    },
  };
  return { cliente, storage, consultas };
};

const viajeActivo = () =>
  mock.method(viajeService, 'obtener', async () => ({ viaje: { id: VIAJE_ID, estado: 'activo' } }));

afterEach(() => mock.restoreAll());

describe('documentoService.subir', () => {
  it('guarda el archivo en viajeId/ con un nombre aleatorio que no contiene el original', async () => {
    viajeActivo();
    const fila = { id: 'd1', nombre: DATOS.nombre };
    const { cliente, storage, consultas } = clienteFalso({ respuesta: { data: fila, error: null } });

    const resultado = await documentoService.subir(cliente, USUARIO_ID, VIAJE_ID, DATOS);

    assert.equal(resultado.estado, 'ok');
    assert.deepEqual(resultado.documento, fila);
    const [subida] = storage.subidas;
    assert.equal(subida.bucket, 'documentos');
    assert.ok(subida.ruta.startsWith(`${VIAJE_ID}/`));
    assert.match(subida.ruta, /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/);
    assert.ok(!subida.ruta.includes('Billete'));
    assert.deepEqual(subida.opciones, { contentType: 'application/pdf', upsert: false });

    // La fila registra esa misma ruta, el tamaño real y quién lo sube
    const insert = consultas[0].operaciones.find(([metodo]) => metodo === 'insert')[1];
    assert.equal(insert.ruta, subida.ruta);
    assert.equal(insert.nombre, DATOS.nombre);
    assert.equal(insert.tamano_bytes, DATOS.buffer.length);
    assert.equal(insert.subido_por, USUARIO_ID);
    assert.equal(insert.tipo_mime, 'application/pdf');
  });

  it('usa una ruta distinta en cada subida y la extensión según el tipo', async () => {
    viajeActivo();
    const { cliente, storage } = clienteFalso({ respuesta: { data: {}, error: null } });
    await documentoService.subir(cliente, USUARIO_ID, VIAJE_ID, DATOS);
    await documentoService.subir(cliente, USUARIO_ID, VIAJE_ID, { ...DATOS, tipoMime: 'image/jpeg' });
    await documentoService.subir(cliente, USUARIO_ID, VIAJE_ID, { ...DATOS, tipoMime: 'image/png' });
    const rutas = storage.subidas.map((s) => s.ruta);
    assert.equal(new Set(rutas).size, 3);
    assert.deepEqual(
      rutas.map((r) => r.split('.').pop()),
      ['pdf', 'jpg', 'png'],
    );
  });

  it('si falla el insert, borra el archivo subido con storage.remove', async () => {
    viajeActivo();
    const error = { code: 'XX000' };
    const { cliente, storage } = clienteFalso({ respuesta: { data: null, error } });

    const resultado = await documentoService.subir(cliente, USUARIO_ID, VIAJE_ID, DATOS);

    assert.deepEqual(resultado, { error });
    assert.equal(storage.borrados.length, 1);
    assert.deepEqual(storage.borrados[0].rutas, [storage.subidas[0].ruta]);
  });

  it('si además falla el borrado, devuelve igualmente el error del insert', async () => {
    viajeActivo();
    const error = { code: 'XX000' };
    const { cliente } = clienteFalso({
      respuesta: { data: null, error },
      remove: () => Promise.reject(new Error('sin red')),
    });
    assert.deepEqual(await documentoService.subir(cliente, USUARIO_ID, VIAJE_ID, DATOS), { error });
  });

  it('si falla la subida a Storage, devuelve el error y no registra el documento', async () => {
    viajeActivo();
    const error = { message: 'bucket' };
    const { cliente, consultas } = clienteFalso({ subida: { error } });
    assert.deepEqual(await documentoService.subir(cliente, USUARIO_ID, VIAJE_ID, DATOS), { error });
    assert.equal(consultas.length, 0);
  });

  it('devuelve no_existe si el viaje no existe, sin subir nada', async () => {
    mock.method(viajeService, 'obtener', async () => ({ viaje: null }));
    const { cliente, storage } = clienteFalso();
    assert.deepEqual(await documentoService.subir(cliente, USUARIO_ID, VIAJE_ID, DATOS), { estado: 'no_existe' });
    assert.equal(storage.subidas.length, 0);
  });

  it('devuelve no_activo si el viaje está archivado o finalizado, sin subir nada', async () => {
    mock.method(viajeService, 'obtener', async () => ({ viaje: { estado: 'archivado' } }));
    const { cliente, storage } = clienteFalso();
    assert.deepEqual(await documentoService.subir(cliente, USUARIO_ID, VIAJE_ID, DATOS), { estado: 'no_activo' });
    assert.equal(storage.subidas.length, 0);
  });

  it('propaga el error de la consulta previa del viaje', async () => {
    const error = { code: 'XX000' };
    mock.method(viajeService, 'obtener', async () => ({ error }));
    const { cliente } = clienteFalso();
    assert.deepEqual(await documentoService.subir(cliente, USUARIO_ID, VIAJE_ID, DATOS), { error });
  });
});

describe('documentoService.listar', () => {
  it('pide los documentos del viaje ordenados del más reciente al más antiguo', async () => {
    viajeActivo();
    const filas = [{ id: 'd2' }, { id: 'd1' }];
    const { cliente, consultas } = clienteFalso({ respuesta: { data: filas, error: null } });

    const resultado = await documentoService.listar(cliente, USUARIO_ID, VIAJE_ID);

    assert.deepEqual(resultado, { estado: 'ok', documentos: filas });
    const { tabla, operaciones } = consultas[0];
    assert.equal(tabla, 'documentos');
    assert.deepEqual(
      operaciones.find(([m]) => m === 'eq'),
      ['eq', 'viaje_id', VIAJE_ID],
    );
    assert.deepEqual(
      operaciones.find(([m]) => m === 'order'),
      ['order', 'creado_en', { ascending: false }],
    );
  });

  it('no incluye la ruta del archivo en los campos que consulta', async () => {
    viajeActivo();
    const { cliente, consultas } = clienteFalso({ respuesta: { data: [], error: null } });
    await documentoService.listar(cliente, USUARIO_ID, VIAJE_ID);
    const campos = consultas[0].operaciones.find(([m]) => m === 'select')[1];
    assert.ok(!campos.split(/,\s*/).includes('ruta'));
  });

  it('devuelve una lista vacía si no hay documentos (data null)', async () => {
    viajeActivo();
    const { cliente } = clienteFalso({ respuesta: { data: null, error: null } });
    assert.deepEqual(await documentoService.listar(cliente, USUARIO_ID, VIAJE_ID), { estado: 'ok', documentos: [] });
  });

  it('lista también los documentos de un viaje archivado', async () => {
    mock.method(viajeService, 'obtener', async () => ({ viaje: { estado: 'archivado' } }));
    const { cliente } = clienteFalso({ respuesta: { data: [{ id: 'd1' }], error: null } });
    assert.equal((await documentoService.listar(cliente, USUARIO_ID, VIAJE_ID)).estado, 'ok');
  });

  it('devuelve no_existe si el viaje no existe', async () => {
    mock.method(viajeService, 'obtener', async () => ({ viaje: null }));
    const { cliente } = clienteFalso();
    assert.deepEqual(await documentoService.listar(cliente, USUARIO_ID, VIAJE_ID), { estado: 'no_existe' });
  });

  it('devuelve el error de Supabase si falla la consulta', async () => {
    viajeActivo();
    const error = { code: 'XX000' };
    const { cliente } = clienteFalso({ respuesta: { data: null, error } });
    assert.deepEqual(await documentoService.listar(cliente, USUARIO_ID, VIAJE_ID), { error });
  });

  it('propaga el error de la consulta previa del viaje', async () => {
    const error = { code: 'XX000' };
    mock.method(viajeService, 'obtener', async () => ({ error }));
    const { cliente } = clienteFalso();
    assert.deepEqual(await documentoService.listar(cliente, USUARIO_ID, VIAJE_ID), { error });
  });
});
