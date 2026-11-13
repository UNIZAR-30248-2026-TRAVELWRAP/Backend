const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const fotoService = require('../src/services/fotoService');
const viajeService = require('../src/services/viajeService');

const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const USUARIO_ID = 'df77cba6-4be5-4cbc-814b-1e228dd73dcc';
const DATOS = { nombre: 'coliseo.jpg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), tipoMime: 'image/jpeg' };

const clienteFalso = ({
  respuesta = { data: null, error: null },
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

    const insert = consultas[0].operaciones.find(([metodo]) => metodo === 'insert')[1];
    assert.equal(consultas[0].tabla, 'fotos');
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
    assert.equal(consultas.length, 0);
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

describe('fotoService.listar', () => {
  const filas = [
    { id: 'f2', nombre: 'trevi.jpg', ruta: `${VIAJE_ID}/b.jpg`, creado_en: '2027-05-13T10:00:00Z' },
    { id: 'f1', nombre: 'coliseo.jpg', ruta: `${VIAJE_ID}/a.jpg`, creado_en: '2027-05-12T10:00:00Z' },
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
    assert.deepEqual(consultas[0].operaciones.find(([m]) => m === 'eq'), ['eq', 'viaje_id', VIAJE_ID]);
    assert.deepEqual(consultas[0].operaciones.find(([m]) => m === 'order'), ['order', 'creado_en', { ascending: false }]);
    assert.deepEqual(storage.firmadas, [
      { bucket: 'fotos', rutas: [`${VIAJE_ID}/b.jpg`, `${VIAJE_ID}/a.jpg`], segundos: 3600 },
    ]);
  });

  it('sin fotos devuelve una lista vacía sin pedir URLs', async () => {
    viajeActivo();
    const { cliente, storage } = clienteFalso({ respuesta: { data: [], error: null } });
    assert.deepEqual(await fotoService.listar(cliente, USUARIO_ID, VIAJE_ID), { estado: 'ok', fotos: [] });
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
