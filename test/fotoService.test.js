const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const fotoService = require('../src/services/fotoService');
const viajeService = require('../src/services/viajeService');

const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const USUARIO_ID = 'df77cba6-4be5-4cbc-814b-1e228dd73dcc';
const DATOS = { nombre: 'coliseo.jpg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), tipoMime: 'image/jpeg' };

const clienteFalso = ({
  respuesta = { data: null, error: null },
  ocupado = { data: [], error: null },
  subida = { error: null },
  firmadas = { data: [], error: null },
  firmada = { data: { signedUrl: 'https://storage/firmada' }, error: null },
  remove,
} = {}) => {
  const consultas = [];
  const storage = { subidas: [], borrados: [], firmadas: [], firmada: [] };
  const from = (tabla) => {
    const consulta = { tabla, operaciones: [] };
    consultas.push(consulta);
    const encadenable = new Proxy(
      {},
      {
        get: (_, metodo) => {
          if (metodo === 'then') {
            const sumaDeBytes = consulta.operaciones.some(([m, columna]) => m === 'select' && columna === 'tamano_bytes');
            return (resolver, rechazar) => Promise.resolve(sumaDeBytes ? ocupado : respuesta).then(resolver, rechazar);
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
        createSignedUrls: async (rutas, segundos) => {
          storage.firmadas.push({ bucket, rutas, segundos });
          return typeof firmadas === 'function' ? firmadas(rutas) : firmadas;
        },
        createSignedUrl: async (ruta, segundos) => {
          storage.firmada.push({ bucket, ruta, segundos });
          return firmada;
        },
      }),
    },
  };
  return { cliente, storage, consultas };
};

const viajeActivo = () =>
  mock.method(viajeService, 'obtener', async () => ({ viaje: { id: VIAJE_ID, estado: 'activo' } }));

afterEach(() => mock.restoreAll());

describe('fotoService.subir', () => {
  it('guarda la foto en viajeId/ con un nombre aleatorio y devuelve la fila con una URL firmada', async () => {
    viajeActivo();
    const fila = { id: 'f1', nombre: DATOS.nombre };
    const { cliente, storage, consultas } = clienteFalso({ respuesta: { data: fila, error: null } });

    const resultado = await fotoService.subir(cliente, USUARIO_ID, VIAJE_ID, DATOS);

    assert.equal(resultado.estado, 'ok');
    assert.deepEqual(resultado.foto, { ...fila, url: 'https://storage/firmada' });
    const [subida] = storage.subidas;
    assert.equal(subida.bucket, 'fotos');
    assert.match(subida.ruta, new RegExp(`^${VIAJE_ID}/[0-9a-f-]{36}\\.jpg$`));
    assert.ok(!subida.ruta.includes('coliseo'));
    assert.deepEqual(subida.opciones, { contentType: 'image/jpeg', upsert: false });
    assert.deepEqual(storage.firmada, [{ bucket: 'fotos', ruta: subida.ruta, segundos: 3600 }]);

    const registro = consultas.find((consulta) => consulta.operaciones.some(([metodo]) => metodo === 'insert'));
    const insert = registro.operaciones.find(([metodo]) => metodo === 'insert')[1];
    assert.equal(registro.tabla, 'fotos');
    assert.equal(insert.ruta, subida.ruta);
    assert.equal(insert.nombre, DATOS.nombre);
    assert.equal(insert.tamano_bytes, DATOS.buffer.length);
    assert.equal(insert.subido_por, USUARIO_ID);
    assert.equal(insert.tipo_mime, 'image/jpeg');
  });

  it('usa una ruta distinta en cada subida y la extensión según el tipo', async () => {
    viajeActivo();
    const { cliente, storage } = clienteFalso({ respuesta: { data: {}, error: null } });
    await fotoService.subir(cliente, USUARIO_ID, VIAJE_ID, DATOS);
    await fotoService.subir(cliente, USUARIO_ID, VIAJE_ID, { ...DATOS, tipoMime: 'image/png' });
    await fotoService.subir(cliente, USUARIO_ID, VIAJE_ID, { ...DATOS, tipoMime: 'image/webp' });
    const rutas = storage.subidas.map((s) => s.ruta);
    assert.equal(new Set(rutas).size, 3);
    assert.deepEqual(
      rutas.map((r) => r.split('.').pop()),
      ['jpg', 'png', 'webp'],
    );
  });

  it('si no se puede firmar la URL devuelve la foto con url null', async () => {
    viajeActivo();
    const { cliente } = clienteFalso({
      respuesta: { data: { id: 'f1' }, error: null },
      firmada: { data: null, error: { message: 'x' } },
    });
    const resultado = await fotoService.subir(cliente, USUARIO_ID, VIAJE_ID, DATOS);
    assert.deepEqual(resultado.foto, { id: 'f1', url: null });
  });

  it('si falla el insert, borra la foto subida con storage.remove', async () => {
    viajeActivo();
    const error = { code: 'XX000' };
    const { cliente, storage } = clienteFalso({ respuesta: { data: null, error } });

    const resultado = await fotoService.subir(cliente, USUARIO_ID, VIAJE_ID, DATOS);

    assert.deepEqual(resultado, { error });
    assert.deepEqual(storage.borrados[0].rutas, [storage.subidas[0].ruta]);
  });

  it('si además falla el borrado, devuelve igualmente el error del insert', async () => {
    viajeActivo();
    const error = { code: 'XX000' };
    const { cliente } = clienteFalso({
      respuesta: { data: null, error },
      remove: () => Promise.reject(new Error('sin red')),
    });
    assert.deepEqual(await fotoService.subir(cliente, USUARIO_ID, VIAJE_ID, DATOS), { error });
  });

  it('si falla la subida a Storage, devuelve el error y no registra la foto', async () => {
    viajeActivo();
    const error = { message: 'bucket' };
    const { cliente, consultas } = clienteFalso({ subida: { error } });
    assert.deepEqual(await fotoService.subir(cliente, USUARIO_ID, VIAJE_ID, DATOS), { error });
    assert.ok(!consultas.some((consulta) => consulta.operaciones.some(([metodo]) => metodo === 'insert')));
  });

  it('devuelve no_existe si el viaje no existe, sin subir nada', async () => {
    mock.method(viajeService, 'obtener', async () => ({ viaje: null }));
    const { cliente, storage } = clienteFalso();
    assert.deepEqual(await fotoService.subir(cliente, USUARIO_ID, VIAJE_ID, DATOS), { estado: 'no_existe' });
    assert.equal(storage.subidas.length, 0);
  });

  it('devuelve no_activo si el viaje está finalizado, sin subir nada', async () => {
    mock.method(viajeService, 'obtener', async () => ({ viaje: { estado: 'finalizado' } }));
    const { cliente, storage } = clienteFalso();
    assert.deepEqual(await fotoService.subir(cliente, USUARIO_ID, VIAJE_ID, DATOS), { estado: 'no_activo' });
    assert.equal(storage.subidas.length, 0);
  });

  it('devuelve el error si no se puede comprobar el viaje', async () => {
    const error = { code: 'XX000' };
    mock.method(viajeService, 'obtener', async () => ({ error }));
    const { cliente } = clienteFalso();
    assert.deepEqual(await fotoService.subir(cliente, USUARIO_ID, VIAJE_ID, DATOS), { error });
  });
});

describe('fotoService.subir (límite de almacenamiento y vídeos)', () => {
  const grande = (bytes) => Buffer.alloc(bytes, 1);

  it('rechaza con almacenamiento_lleno si la foto no cabe en lo que queda, sin subir nada', async () => {
    viajeActivo();
    const { cliente, storage } = clienteFalso({ ocupado: { data: [{ tamano_bytes: 150_000_000 }, { tamano_bytes: 49_999_999 }], error: null } });

    const resultado = await fotoService.subir(cliente, USUARIO_ID, VIAJE_ID, DATOS);

    assert.deepEqual(resultado, { estado: 'almacenamiento_lleno', usado_bytes: 199_999_999, limite_bytes: 200_000_000 });
    assert.equal(storage.subidas.length, 0);
  });

  it('acepta el archivo que llena el almacenamiento justo hasta el límite', async () => {
    viajeActivo();
    const fila = { id: 'f1', nombre: 'a.mp4', tipo_mime: 'video/mp4' };
    const { cliente } = clienteFalso({
      ocupado: { data: [{ tamano_bytes: 150_000_000 }], error: null },
      respuesta: { data: fila, error: null },
    });

    const resultado = await fotoService.subir(cliente, USUARIO_ID, VIAJE_ID, { nombre: 'a.mp4', buffer: grande(50_000_000), tipoMime: 'video/mp4' });

    assert.equal(resultado.estado, 'ok');
  });

  it('devuelve el error si no se puede calcular el espacio usado, sin subir nada', async () => {
    viajeActivo();
    const error = { code: 'XX000' };
    const { cliente, storage } = clienteFalso({ ocupado: { data: null, error } });

    assert.deepEqual(await fotoService.subir(cliente, USUARIO_ID, VIAJE_ID, DATOS), { error });
    assert.equal(storage.subidas.length, 0);
  });

  it('guarda los vídeos con su extensión según el tipo', async () => {
    viajeActivo();
    const { cliente, storage } = clienteFalso({ respuesta: { data: { id: 'v' }, error: null } });
    for (const tipoMime of ['video/mp4', 'video/webm', 'video/quicktime']) {
      await fotoService.subir(cliente, USUARIO_ID, VIAJE_ID, { nombre: 'v', buffer: grande(10), tipoMime });
    }

    assert.deepEqual(
      storage.subidas.map((s) => s.ruta.split('.').pop()),
      ['mp4', 'webm', 'mov'],
    );
    assert.deepEqual(
      storage.subidas.map((s) => s.opciones.contentType),
      ['video/mp4', 'video/webm', 'video/quicktime'],
    );
  });
});

describe('fotoService.eliminar', () => {
  const FOTO_ID = '5b1f0c2e-8a7d-4c3b-9e6f-2d4a1b3c5e7f';

  it('borra la fila de este viaje y después el archivo de Storage', async () => {
    viajeActivo();
    const { cliente, storage, consultas } = clienteFalso({ respuesta: { data: [{ ruta: `${VIAJE_ID}/a.jpg` }], error: null } });

    assert.deepEqual(await fotoService.eliminar(cliente, USUARIO_ID, VIAJE_ID, FOTO_ID), { estado: 'ok' });

    const operaciones = consultas[0].operaciones;
    assert.ok(operaciones.some(([m]) => m === 'delete'));
    assert.deepEqual(operaciones.filter(([m]) => m === 'eq'), [['eq', 'id', FOTO_ID], ['eq', 'viaje_id', VIAJE_ID]]);
    assert.deepEqual(storage.borrados, [{ bucket: 'fotos', rutas: [`${VIAJE_ID}/a.jpg`] }]);
  });

  it('si falla el borrado del archivo, la foto ya no existe para los miembros y se devuelve ok', async () => {
    viajeActivo();
    const { cliente } = clienteFalso({
      respuesta: { data: [{ ruta: `${VIAJE_ID}/a.jpg` }], error: null },
      remove: async () => {
        throw new Error('storage caído');
      },
    });

    assert.deepEqual(await fotoService.eliminar(cliente, USUARIO_ID, VIAJE_ID, FOTO_ID), { estado: 'ok' });
  });

  it('devuelve foto_no_existe si no se borra ninguna fila (otro viaje, otro id o la política lo impide)', async () => {
    viajeActivo();
    const { cliente, storage } = clienteFalso({ respuesta: { data: [], error: null } });

    assert.deepEqual(await fotoService.eliminar(cliente, USUARIO_ID, VIAJE_ID, FOTO_ID), { estado: 'foto_no_existe' });
    assert.equal(storage.borrados.length, 0);
  });

  it('devuelve no_existe y no_activo sin borrar nada', async () => {
    const { cliente, consultas } = clienteFalso();
    mock.method(viajeService, 'obtener', async () => ({ viaje: null }));
    assert.deepEqual(await fotoService.eliminar(cliente, USUARIO_ID, VIAJE_ID, FOTO_ID), { estado: 'no_existe' });
    mock.restoreAll();
    mock.method(viajeService, 'obtener', async () => ({ viaje: { id: VIAJE_ID, estado: 'finalizado' } }));
    assert.deepEqual(await fotoService.eliminar(cliente, USUARIO_ID, VIAJE_ID, FOTO_ID), { estado: 'no_activo' });
    assert.equal(consultas.length, 0);
  });

  it('devuelve el error si falla la comprobación del viaje o el borrado de la fila', async () => {
    const error = { code: 'XX000' };
    mock.method(viajeService, 'obtener', async () => ({ error }));
    assert.deepEqual(await fotoService.eliminar(clienteFalso().cliente, USUARIO_ID, VIAJE_ID, FOTO_ID), { error });
    mock.restoreAll();
    viajeActivo();
    const { cliente } = clienteFalso({ respuesta: { data: null, error } });
    assert.deepEqual(await fotoService.eliminar(cliente, USUARIO_ID, VIAJE_ID, FOTO_ID), { error });
  });
});

describe('fotoService.listar', () => {
  const filas = [
    { id: 'f2', nombre: 'trevi.jpg', ruta: `${VIAJE_ID}/b.jpg`, tamano_bytes: 300_000, creado_en: '2027-05-13T10:00:00Z' },
    { id: 'f1', nombre: 'coliseo.jpg', ruta: `${VIAJE_ID}/a.jpg`, tamano_bytes: 1_200_000, creado_en: '2027-05-12T10:00:00Z' },
  ];

  it('pide las fotos del viaje de la más reciente a la más antigua y las devuelve con su URL, sin la ruta', async () => {
    viajeActivo();
    const { cliente, storage, consultas } = clienteFalso({
      respuesta: { data: filas, error: null },
      firmadas: {
        data: [
          { path: `${VIAJE_ID}/b.jpg`, signedUrl: 'https://storage/b' },
          { path: `${VIAJE_ID}/a.jpg`, signedUrl: 'https://storage/a' },
        ],
        error: null,
      },
    });

    const resultado = await fotoService.listar(cliente, USUARIO_ID, VIAJE_ID);

    assert.equal(resultado.estado, 'ok');
    assert.deepEqual(
      resultado.fotos.map((foto) => [foto.id, foto.url]),
      [
        ['f2', 'https://storage/b'],
        ['f1', 'https://storage/a'],
      ],
    );
    assert.ok(resultado.fotos.every((foto) => !('ruta' in foto)));
    assert.deepEqual(resultado.almacenamiento, { usado_bytes: 1_500_000, limite_bytes: 200_000_000 });
    assert.deepEqual(consultas[0].operaciones.find(([m]) => m === 'eq'), ['eq', 'viaje_id', VIAJE_ID]);
    assert.deepEqual(consultas[0].operaciones.find(([m]) => m === 'order'), ['order', 'creado_en', { ascending: false }]);
    assert.deepEqual(storage.firmadas, [
      { bucket: 'fotos', rutas: [`${VIAJE_ID}/b.jpg`, `${VIAJE_ID}/a.jpg`], segundos: 3600 },
    ]);
  });

  it('sin fotos devuelve una lista vacía sin pedir URLs', async () => {
    viajeActivo();
    const { cliente, storage } = clienteFalso({ respuesta: { data: [], error: null } });
    assert.deepEqual(await fotoService.listar(cliente, USUARIO_ID, VIAJE_ID), {
      estado: 'ok',
      fotos: [],
      almacenamiento: { usado_bytes: 0, limite_bytes: 200_000_000 },
    });
    assert.equal(storage.firmadas.length, 0);
  });

  it('una foto cuya URL no se ha podido firmar sale con url null', async () => {
    viajeActivo();
    const { cliente } = clienteFalso({
      respuesta: { data: filas, error: null },
      firmadas: { data: [{ path: `${VIAJE_ID}/b.jpg`, signedUrl: 'https://storage/b' }, { path: `${VIAJE_ID}/a.jpg`, error: 'x' }], error: null },
    });
    const resultado = await fotoService.listar(cliente, USUARIO_ID, VIAJE_ID);
    assert.deepEqual(
      resultado.fotos.map((foto) => foto.url),
      ['https://storage/b', null],
    );
  });

  it('también funciona con un viaje finalizado', async () => {
    mock.method(viajeService, 'obtener', async () => ({ viaje: { id: VIAJE_ID, estado: 'finalizado' } }));
    const { cliente } = clienteFalso({ respuesta: { data: [], error: null } });
    assert.equal((await fotoService.listar(cliente, USUARIO_ID, VIAJE_ID)).estado, 'ok');
  });

  it('devuelve no_existe si el viaje no existe', async () => {
    mock.method(viajeService, 'obtener', async () => ({ viaje: null }));
    const { cliente } = clienteFalso();
    assert.deepEqual(await fotoService.listar(cliente, USUARIO_ID, VIAJE_ID), { estado: 'no_existe' });
  });

  it('devuelve el error si falla la consulta o la firma de URLs', async () => {
    viajeActivo();
    const error = { code: 'XX000' };
    assert.deepEqual(
      await fotoService.listar(clienteFalso({ respuesta: { data: null, error } }).cliente, USUARIO_ID, VIAJE_ID),
      { error },
    );
    const errorFirma = { message: 'firma' };
    const { cliente } = clienteFalso({ respuesta: { data: filas, error: null }, firmadas: { data: null, error: errorFirma } });
    assert.deepEqual(await fotoService.listar(cliente, USUARIO_ID, VIAJE_ID), { error: errorFirma });
  });

  it('devuelve el error si no se puede comprobar el viaje', async () => {
    const error = { code: 'XX000' };
    mock.method(viajeService, 'obtener', async () => ({ error }));
    const { cliente } = clienteFalso();
    assert.deepEqual(await fotoService.listar(cliente, USUARIO_ID, VIAJE_ID), { error });
  });
});
