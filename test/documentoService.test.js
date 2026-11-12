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
const clienteFalso = ({
  respuesta = { data: null, error: null },
  subida = { error: null },
  remove,
  enlace = { data: { signedUrl: 'https://storage.test/firmada?token=abc' }, error: null },
} = {}) => {
  const consultas = [];
  const storage = { subidas: [], borrados: [], enlaces: [] };
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
        createSignedUrl: async (ruta, segundos, opciones) => {
          storage.enlaces.push({ bucket, ruta, segundos, opciones });
          return enlace;
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

describe('documentoService.obtenerUrl', () => {
  const DOCUMENTO_ID = '0b9c0d1e-2f3a-4b5c-8d6e-7f8a9b0c1d2e';
  const RUTA = `${VIAJE_ID}/${DOCUMENTO_ID}.pdf`;
  const fila = { ruta: RUTA, nombre: 'Billete de tren.pdf', tipo_mime: 'application/pdf' };

  it('firma la ruta del documento durante 300 s y devuelve el enlace, el nombre y el tipo', async () => {
    viajeActivo();
    const { cliente, storage } = clienteFalso({ respuesta: { data: fila, error: null } });

    const resultado = await documentoService.obtenerUrl(cliente, USUARIO_ID, VIAJE_ID, DOCUMENTO_ID);

    assert.equal(resultado.estado, 'ok');
    assert.equal(resultado.url, 'https://storage.test/firmada?token=abc');
    assert.equal(resultado.nombre, fila.nombre);
    assert.equal(resultado.tipo_mime, 'application/pdf');
    assert.deepEqual(storage.enlaces, [{ bucket: 'documentos', ruta: RUTA, segundos: 300, opciones: undefined }]);
    const faltan = new Date(resultado.expira_en).getTime() - Date.now();
    assert.ok(faltan > 295_000 && faltan <= 300_000);
  });

  it('con descargar pide el enlace con download igual al nombre del documento', async () => {
    viajeActivo();
    const { cliente, storage } = clienteFalso({ respuesta: { data: fila, error: null } });
    await documentoService.obtenerUrl(cliente, USUARIO_ID, VIAJE_ID, DOCUMENTO_ID, { descargar: true });
    assert.deepEqual(storage.enlaces[0].opciones, { download: 'Billete de tren.pdf' });
  });

  it('busca el documento por id y por viaje, y pide solo ruta, nombre y tipo', async () => {
    viajeActivo();
    const { cliente, consultas } = clienteFalso({ respuesta: { data: fila, error: null } });
    await documentoService.obtenerUrl(cliente, USUARIO_ID, VIAJE_ID, DOCUMENTO_ID);
    const { operaciones } = consultas[0];
    assert.deepEqual(operaciones.find(([metodo]) => metodo === 'select'), ['select', 'ruta, nombre, tipo_mime']);
    assert.ok(operaciones.some(([metodo, columna, valor]) => metodo === 'eq' && columna === 'id' && valor === DOCUMENTO_ID));
    assert.ok(operaciones.some(([metodo, columna, valor]) => metodo === 'eq' && columna === 'viaje_id' && valor === VIAJE_ID));
  });

  it('la respuesta no incluye la ruta del archivo', async () => {
    viajeActivo();
    const { cliente } = clienteFalso({ respuesta: { data: fila, error: null } });
    const resultado = await documentoService.obtenerUrl(cliente, USUARIO_ID, VIAJE_ID, DOCUMENTO_ID);
    assert.ok(!('ruta' in resultado));
  });

  it('devuelve documento_no_existe si el documento es de otro viaje (no hay fila), sin firmar nada', async () => {
    viajeActivo();
    const { cliente, storage } = clienteFalso({ respuesta: { data: null, error: null } });
    const resultado = await documentoService.obtenerUrl(cliente, USUARIO_ID, VIAJE_ID, DOCUMENTO_ID);
    assert.deepEqual(resultado, { estado: 'documento_no_existe' });
    assert.equal(storage.enlaces.length, 0);
  });

  it('funciona con el viaje archivado o finalizado, porque solo lee', async () => {
    mock.method(viajeService, 'obtener', async () => ({ viaje: { id: VIAJE_ID, estado: 'archivado' } }));
    const { cliente } = clienteFalso({ respuesta: { data: fila, error: null } });
    const resultado = await documentoService.obtenerUrl(cliente, USUARIO_ID, VIAJE_ID, DOCUMENTO_ID);
    assert.equal(resultado.estado, 'ok');
  });

  it('devuelve no_existe si el viaje no existe o no es del usuario', async () => {
    mock.method(viajeService, 'obtener', async () => ({ viaje: null }));
    const { cliente, consultas } = clienteFalso();
    assert.deepEqual(await documentoService.obtenerUrl(cliente, USUARIO_ID, VIAJE_ID, DOCUMENTO_ID), { estado: 'no_existe' });
    assert.equal(consultas.length, 0);
  });

  it('propaga el error de la consulta previa del viaje', async () => {
    const error = { code: 'XX000' };
    mock.method(viajeService, 'obtener', async () => ({ error }));
    const { cliente } = clienteFalso();
    assert.deepEqual(await documentoService.obtenerUrl(cliente, USUARIO_ID, VIAJE_ID, DOCUMENTO_ID), { error });
  });

  it('devuelve el error de Supabase si falla la búsqueda del documento', async () => {
    viajeActivo();
    const error = { code: 'XX000' };
    const { cliente } = clienteFalso({ respuesta: { data: null, error } });
    assert.deepEqual(await documentoService.obtenerUrl(cliente, USUARIO_ID, VIAJE_ID, DOCUMENTO_ID), { error });
  });

  it('devuelve documento_no_existe si el archivo ya no está en Storage', async () => {
    viajeActivo();
    const enlace = { data: null, error: { message: 'Object not found', statusCode: '404' } };
    const { cliente } = clienteFalso({ respuesta: { data: fila, error: null }, enlace });
    assert.deepEqual(await documentoService.obtenerUrl(cliente, USUARIO_ID, VIAJE_ID, DOCUMENTO_ID), {
      estado: 'documento_no_existe',
    });
  });

  it('devuelve el error de Storage si falla la firma por otro motivo', async () => {
    viajeActivo();
    const error = { message: 'fallo interno', statusCode: '500' };
    const { cliente } = clienteFalso({ respuesta: { data: fila, error: null }, enlace: { data: null, error } });
    assert.deepEqual(await documentoService.obtenerUrl(cliente, USUARIO_ID, VIAJE_ID, DOCUMENTO_ID), { error });
  });
});

describe('documentoService.eliminar', () => {
  const DOCUMENTO_ID = '0b9c0d1e-2f3a-4b5c-8d6e-7f8a9b0c1d2e';
  const RUTA = `${VIAJE_ID}/${DOCUMENTO_ID}.pdf`;
  const borrada = { data: [{ ruta: RUTA }], error: null };

  it('borra la fila por id y por viaje, y después el archivo de esa ruta', async () => {
    viajeActivo();
    const { cliente, storage, consultas } = clienteFalso({ respuesta: borrada });

    const resultado = await documentoService.eliminar(cliente, USUARIO_ID, VIAJE_ID, DOCUMENTO_ID);

    assert.deepEqual(resultado, { estado: 'ok' });
    const { tabla, operaciones } = consultas[0];
    assert.equal(tabla, 'documentos');
    assert.ok(operaciones.some(([metodo]) => metodo === 'delete'));
    assert.ok(operaciones.some(([metodo, columna, valor]) => metodo === 'eq' && columna === 'id' && valor === DOCUMENTO_ID));
    assert.ok(operaciones.some(([metodo, columna, valor]) => metodo === 'eq' && columna === 'viaje_id' && valor === VIAJE_ID));
    assert.deepEqual(operaciones.find(([metodo]) => metodo === 'select'), ['select', 'ruta']);
    assert.deepEqual(storage.borrados, [{ bucket: 'documentos', rutas: [RUTA] }]);
  });

  it('borra el archivo después de la fila, no antes', async () => {
    viajeActivo();
    const orden = [];
    const { cliente } = clienteFalso({
      respuesta: borrada,
      remove: async () => {
        orden.push('archivo');
        return { error: null };
      },
    });
    const from = cliente.from;
    cliente.from = (tabla) => {
      orden.push('fila');
      return from(tabla);
    };
    await documentoService.eliminar(cliente, USUARIO_ID, VIAJE_ID, DOCUMENTO_ID);
    assert.deepEqual(orden, ['fila', 'archivo']);
  });

  it('devuelve documento_no_existe si no se borra ninguna fila, sin llamar a remove', async () => {
    viajeActivo();
    const { cliente, storage } = clienteFalso({ respuesta: { data: [], error: null } });
    const resultado = await documentoService.eliminar(cliente, USUARIO_ID, VIAJE_ID, DOCUMENTO_ID);
    assert.deepEqual(resultado, { estado: 'documento_no_existe' });
    assert.equal(storage.borrados.length, 0);
  });

  it('devuelve no_activo con el viaje archivado o finalizado, sin borrar nada', async () => {
    for (const estado of ['archivado', 'finalizado']) {
      mock.method(viajeService, 'obtener', async () => ({ viaje: { id: VIAJE_ID, estado } }));
      const { cliente, storage, consultas } = clienteFalso({ respuesta: borrada });
      assert.deepEqual(await documentoService.eliminar(cliente, USUARIO_ID, VIAJE_ID, DOCUMENTO_ID), { estado: 'no_activo' });
      assert.equal(consultas.length, 0);
      assert.equal(storage.borrados.length, 0);
      mock.restoreAll();
    }
  });

  it('devuelve no_existe si el viaje no existe o el usuario no es miembro', async () => {
    mock.method(viajeService, 'obtener', async () => ({ viaje: null }));
    const { cliente, storage, consultas } = clienteFalso({ respuesta: borrada });
    assert.deepEqual(await documentoService.eliminar(cliente, USUARIO_ID, VIAJE_ID, DOCUMENTO_ID), { estado: 'no_existe' });
    assert.equal(consultas.length, 0);
    assert.equal(storage.borrados.length, 0);
  });

  it('devuelve el error si falla el borrado de la fila, sin llamar a remove', async () => {
    viajeActivo();
    const error = { code: 'XX000' };
    const { cliente, storage } = clienteFalso({ respuesta: { data: null, error } });
    assert.deepEqual(await documentoService.eliminar(cliente, USUARIO_ID, VIAJE_ID, DOCUMENTO_ID), { error });
    assert.equal(storage.borrados.length, 0);
  });

  it('sigue devolviendo ok si falla el borrado del archivo (error devuelto o excepción)', async () => {
    viajeActivo();
    for (const remove of [
      async () => ({ error: { message: 'fallo' } }),
      async () => {
        throw new Error('sin red');
      },
    ]) {
      const { cliente } = clienteFalso({ respuesta: borrada, remove });
      assert.deepEqual(await documentoService.eliminar(cliente, USUARIO_ID, VIAJE_ID, DOCUMENTO_ID), { estado: 'ok' });
    }
  });

  it('propaga el error de la consulta previa del viaje', async () => {
    const error = { code: 'XX000' };
    mock.method(viajeService, 'obtener', async () => ({ error }));
    const { cliente, consultas } = clienteFalso();
    assert.deepEqual(await documentoService.eliminar(cliente, USUARIO_ID, VIAJE_ID, DOCUMENTO_ID), { error });
    assert.equal(consultas.length, 0);
  });
});
