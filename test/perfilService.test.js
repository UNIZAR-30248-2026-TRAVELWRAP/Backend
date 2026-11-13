// Pruebas del servicio del perfil: nombre, ruta de las fotos en el bucket, rollback si falla el guardado y
// borrado de la foto anterior solo si es nuestra. Supabase (base de datos y Storage) se sustituye por un cliente falso
const { afterEach, beforeEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const perfilService = require('../src/services/perfilService');

const USUARIO_ID = 'df77cba6-4be5-4cbc-814b-1e228dd73dcc';
const OTRO_ID = '123e4567-e89b-12d3-a456-426614174000';
const SUPABASE_URL = 'https://proyecto.supabase.co';
const PREFIJO = `${SUPABASE_URL}/storage/v1/object/public/avatares/`;
const FOTO_ANTERIOR = `${PREFIJO}${USUARIO_ID}/anterior.jpg`;
const FOTO_GOOGLE = 'https://lh3.googleusercontent.com/a/foto=s96-c';
const DATOS = { buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]), tipoMime: 'image/png' };

const PERFIL = { nombre: 'Berta', email: 'berta@travelwrap.app', avatar_url: null, creado_en: '2026-10-07T18:00:00Z' };

// Cliente falso: cada consulta a la tabla devuelve, por orden, una de las respuestas indicadas
// y Storage guarda sus llamadas
const clienteFalso = ({ respuestas = [], subida = { error: null }, remove } = {}) => {
  const consultas = [];
  const storage = { subidas: [], borrados: [], urls: [] };
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
  const cliente = {
    from,
    storage: {
      from: (bucket) => ({
        upload: async (ruta, contenido, opciones) => {
          storage.subidas.push({ bucket, ruta, contenido, opciones });
          return subida;
        },
        getPublicUrl: (ruta) => {
          storage.urls.push({ bucket, ruta });
          return { data: { publicUrl: `${PREFIJO}${ruta}` } };
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

const operacion = (consulta, metodo) => consulta.operaciones.find(([m]) => m === metodo);

let urlOriginal;
beforeEach(() => {
  urlOriginal = process.env.SUPABASE_URL;
  process.env.SUPABASE_URL = SUPABASE_URL;
});
afterEach(() => {
  mock.restoreAll();
  if (urlOriginal === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = urlOriginal;
});

describe('perfilService.rutaDeAvatar', () => {
  it('saca la ruta del archivo de una URL pública de nuestro bucket', () => {
    assert.equal(perfilService.rutaDeAvatar(FOTO_ANTERIOR), `${USUARIO_ID}/anterior.jpg`);
  });

  it('ignora la parte de consulta de la URL y decodifica la ruta', () => {
    assert.equal(perfilService.rutaDeAvatar(`${PREFIJO}${USUARIO_ID}/a%20b.png?t=1`), `${USUARIO_ID}/a b.png`);
  });

  it('devuelve null con la foto de Google, con otro bucket, vacía o sin texto', () => {
    assert.equal(perfilService.rutaDeAvatar(FOTO_GOOGLE), null);
    assert.equal(perfilService.rutaDeAvatar(`${SUPABASE_URL}/storage/v1/object/public/documentos/a.png`), null);
    assert.equal(perfilService.rutaDeAvatar(PREFIJO), null);
    assert.equal(perfilService.rutaDeAvatar(null), null);
    assert.equal(perfilService.rutaDeAvatar(undefined), null);
  });

  it('devuelve null si la ruta no se puede decodificar', () => {
    assert.equal(perfilService.rutaDeAvatar(`${PREFIJO}${USUARIO_ID}/%E0%A4%A.png`), null);
  });
});

describe('perfilService.actualizarNombre', () => {
  it('actualiza solo el perfil del usuario y devuelve el usuario con la forma de la sesión', async () => {
    const { cliente, consultas } = clienteFalso({ respuestas: [{ data: { ...PERFIL, nombre: 'Nuevo' }, error: null }] });

    const resultado = await perfilService.actualizarNombre(cliente, USUARIO_ID, 'Nuevo');

    assert.equal(resultado.estado, 'ok');
    assert.deepEqual(resultado.usuario, { id: USUARIO_ID, ...PERFIL, nombre: 'Nuevo' });
    assert.equal(consultas[0].tabla, 'perfiles');
    assert.deepEqual(operacion(consultas[0], 'update'), ['update', { nombre: 'Nuevo' }]);
    assert.deepEqual(operacion(consultas[0], 'eq'), ['eq', 'id', USUARIO_ID]);
  });

  it('devuelve no_existe si el usuario no tiene perfil', async () => {
    const { cliente } = clienteFalso({ respuestas: [{ data: null, error: null }] });
    assert.deepEqual(await perfilService.actualizarNombre(cliente, USUARIO_ID, 'Nuevo'), { estado: 'no_existe' });
  });

  it('devuelve el error de la base de datos', async () => {
    const error = { code: '23514' };
    const { cliente } = clienteFalso({ respuestas: [{ data: null, error }] });
    assert.deepEqual(await perfilService.actualizarNombre(cliente, USUARIO_ID, 'Nuevo'), { error });
  });
});

describe('perfilService.cambiarAvatar', () => {
  const todoBien = (avatarAnterior) => [
    { data: { avatar_url: avatarAnterior }, error: null },
    { data: { ...PERFIL, avatar_url: 'se-sustituye' }, error: null },
  ];

  it('sube la foto a <usuarioId>/<uuid>.png con upsert false y guarda la URL pública en el perfil', async () => {
    const { cliente, storage, consultas } = clienteFalso({ respuestas: todoBien(null) });

    const resultado = await perfilService.cambiarAvatar(cliente, USUARIO_ID, DATOS);

    assert.equal(resultado.estado, 'ok');
    assert.equal(resultado.usuario.id, USUARIO_ID);
    const [subida] = storage.subidas;
    assert.equal(subida.bucket, 'avatares');
    assert.match(subida.ruta, new RegExp(`^${USUARIO_ID}/[0-9a-f-]{36}\\.png$`));
    assert.equal(subida.contenido, DATOS.buffer);
    assert.deepEqual(subida.opciones, { contentType: 'image/png', upsert: false });
    assert.deepEqual(operacion(consultas[1], 'update'), ['update', { avatar_url: `${PREFIJO}${subida.ruta}` }]);
    assert.deepEqual(operacion(consultas[1], 'eq'), ['eq', 'id', USUARIO_ID]);
  });

  it('la ruta empieza siempre por el id recibido y usa .jpg para JPEG', async () => {
    const { cliente, storage } = clienteFalso({ respuestas: todoBien(null) });
    await perfilService.cambiarAvatar(cliente, OTRO_ID, { ...DATOS, tipoMime: 'image/jpeg' });
    assert.match(storage.subidas[0].ruta, new RegExp(`^${OTRO_ID}/[0-9a-f-]{36}\\.jpg$`));
  });

  it('usa una ruta distinta en cada subida', async () => {
    const a = clienteFalso({ respuestas: todoBien(null) });
    const b = clienteFalso({ respuestas: todoBien(null) });
    await perfilService.cambiarAvatar(a.cliente, USUARIO_ID, DATOS);
    await perfilService.cambiarAvatar(b.cliente, USUARIO_ID, DATOS);
    assert.notEqual(a.storage.subidas[0].ruta, b.storage.subidas[0].ruta);
  });

  it('borra la foto anterior si era de nuestro bucket', async () => {
    const { cliente, storage } = clienteFalso({ respuestas: todoBien(FOTO_ANTERIOR) });
    await perfilService.cambiarAvatar(cliente, USUARIO_ID, DATOS);
    assert.deepEqual(storage.borrados, [{ bucket: 'avatares', rutas: [`${USUARIO_ID}/anterior.jpg`] }]);
  });

  it('no llama a remove si la foto anterior es la de Google ni si no había', async () => {
    const google = clienteFalso({ respuestas: todoBien(FOTO_GOOGLE) });
    const ninguna = clienteFalso({ respuestas: todoBien(null) });
    await perfilService.cambiarAvatar(google.cliente, USUARIO_ID, DATOS);
    await perfilService.cambiarAvatar(ninguna.cliente, USUARIO_ID, DATOS);
    assert.equal(google.storage.borrados.length, 0);
    assert.equal(ninguna.storage.borrados.length, 0);
  });

  it('si falla el borrado de la foto anterior, el cambio sigue siendo correcto', async () => {
    const { cliente } = clienteFalso({
      respuestas: todoBien(FOTO_ANTERIOR),
      remove: () => Promise.reject(new Error('sin red')),
    });
    const resultado = await perfilService.cambiarAvatar(cliente, USUARIO_ID, DATOS);
    assert.equal(resultado.estado, 'ok');
  });

  it('si falla el update, borra la foto nueva (no la anterior) y devuelve el error', async () => {
    const error = { code: 'XX000' };
    const { cliente, storage } = clienteFalso({
      respuestas: [{ data: { avatar_url: FOTO_ANTERIOR }, error: null }, { data: null, error }],
    });

    const resultado = await perfilService.cambiarAvatar(cliente, USUARIO_ID, DATOS);

    assert.deepEqual(resultado, { error });
    assert.deepEqual(storage.borrados, [{ bucket: 'avatares', rutas: [storage.subidas[0].ruta] }]);
  });

  it('si el update no encuentra el perfil, borra la foto nueva y devuelve no_existe', async () => {
    const { cliente, storage } = clienteFalso({
      respuestas: [{ data: { avatar_url: null }, error: null }, { data: null, error: null }],
    });
    assert.deepEqual(await perfilService.cambiarAvatar(cliente, USUARIO_ID, DATOS), { estado: 'no_existe' });
    assert.deepEqual(storage.borrados, [{ bucket: 'avatares', rutas: [storage.subidas[0].ruta] }]);
  });

  it('si además falla el borrado de la foto nueva, devuelve igualmente el error del update', async () => {
    const error = { code: 'XX000' };
    const { cliente } = clienteFalso({
      respuestas: [{ data: { avatar_url: null }, error: null }, { data: null, error }],
      remove: () => Promise.reject(new Error('sin red')),
    });
    assert.deepEqual(await perfilService.cambiarAvatar(cliente, USUARIO_ID, DATOS), { error });
  });

  it('si falla la subida a Storage, devuelve el error y no toca el perfil', async () => {
    const error = { message: 'bucket' };
    const { cliente, consultas } = clienteFalso({
      respuestas: [{ data: { avatar_url: null }, error: null }],
      subida: { error },
    });
    assert.deepEqual(await perfilService.cambiarAvatar(cliente, USUARIO_ID, DATOS), { error });
    assert.equal(consultas.length, 1);
  });

  it('devuelve no_existe, sin subir nada, si el usuario no tiene perfil', async () => {
    const { cliente, storage } = clienteFalso({ respuestas: [{ data: null, error: null }] });
    assert.deepEqual(await perfilService.cambiarAvatar(cliente, USUARIO_ID, DATOS), { estado: 'no_existe' });
    assert.equal(storage.subidas.length, 0);
  });

  it('devuelve el error al leer el perfil, sin subir nada', async () => {
    const error = { code: 'XX000' };
    const { cliente, storage } = clienteFalso({ respuestas: [{ data: null, error }] });
    assert.deepEqual(await perfilService.cambiarAvatar(cliente, USUARIO_ID, DATOS), { error });
    assert.equal(storage.subidas.length, 0);
  });
});

describe('perfilService.quitarAvatar', () => {
  it('deja avatar_url en null y borra la foto anterior si era nuestra', async () => {
    const { cliente, storage, consultas } = clienteFalso({
      respuestas: [{ data: { avatar_url: FOTO_ANTERIOR }, error: null }, { data: PERFIL, error: null }],
    });

    const resultado = await perfilService.quitarAvatar(cliente, USUARIO_ID);

    assert.equal(resultado.estado, 'ok');
    assert.equal(resultado.usuario.avatar_url, null);
    assert.deepEqual(operacion(consultas[1], 'update'), ['update', { avatar_url: null }]);
    assert.deepEqual(operacion(consultas[1], 'eq'), ['eq', 'id', USUARIO_ID]);
    assert.deepEqual(storage.borrados, [{ bucket: 'avatares', rutas: [`${USUARIO_ID}/anterior.jpg`] }]);
  });

  it('con la foto de Google solo pone null: no llama a remove', async () => {
    const { cliente, storage } = clienteFalso({
      respuestas: [{ data: { avatar_url: FOTO_GOOGLE }, error: null }, { data: PERFIL, error: null }],
    });
    const resultado = await perfilService.quitarAvatar(cliente, USUARIO_ID);
    assert.equal(resultado.estado, 'ok');
    assert.equal(storage.borrados.length, 0);
  });

  it('si falla el borrado del archivo, la respuesta sigue siendo correcta', async () => {
    const { cliente } = clienteFalso({
      respuestas: [{ data: { avatar_url: FOTO_ANTERIOR }, error: null }, { data: PERFIL, error: null }],
      remove: () => Promise.reject(new Error('sin red')),
    });
    assert.equal((await perfilService.quitarAvatar(cliente, USUARIO_ID)).estado, 'ok');
  });

  it('si falla el update, no borra el archivo y devuelve el error', async () => {
    const error = { code: 'XX000' };
    const { cliente, storage } = clienteFalso({
      respuestas: [{ data: { avatar_url: FOTO_ANTERIOR }, error: null }, { data: null, error }],
    });
    assert.deepEqual(await perfilService.quitarAvatar(cliente, USUARIO_ID), { error });
    assert.equal(storage.borrados.length, 0);
  });

  it('devuelve no_existe si el usuario no tiene perfil (al leer o al actualizar)', async () => {
    const alLeer = clienteFalso({ respuestas: [{ data: null, error: null }] });
    const alActualizar = clienteFalso({
      respuestas: [{ data: { avatar_url: null }, error: null }, { data: null, error: null }],
    });
    assert.deepEqual(await perfilService.quitarAvatar(alLeer.cliente, USUARIO_ID), { estado: 'no_existe' });
    assert.deepEqual(await perfilService.quitarAvatar(alActualizar.cliente, USUARIO_ID), { estado: 'no_existe' });
  });

  it('devuelve el error al leer el perfil', async () => {
    const error = { code: 'XX000' };
    const { cliente } = clienteFalso({ respuestas: [{ data: null, error }] });
    assert.deepEqual(await perfilService.quitarAvatar(cliente, USUARIO_ID), { error });
  });
});
