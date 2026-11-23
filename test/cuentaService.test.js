// Pruebas del servicio de eliminar cuenta (PB-47): orden de los pasos y qué pasa si falla alguno.
// El cliente admin de Supabase (base de datos, Storage y Auth) se sustituye por uno falso
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const cuentaService = require('../src/services/cuentaService');

const USUARIO_ID = 'df77cba6-4be5-4cbc-814b-1e228dd73dcc';
const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';

// Cada llamada se anota en `llamadas`, en orden. `respuestas` cambia lo que devuelve cada paso
const adminFalso = ({ solitarios = [], datos = true, errores = {}, avatares = [] } = {}) => {
  const llamadas = [];
  const admin = {
    llamadas,
    rpc: async (nombre, parametros) => {
      llamadas.push(['rpc', nombre, parametros]);
      if (errores[nombre]) return { data: null, error: errores[nombre] };
      return { data: nombre === 'viajes_en_solitario' ? solitarios : datos, error: null };
    },
    storage: {
      from: (bucket) => ({
        list: async (carpeta) => {
          llamadas.push(['list', bucket, carpeta]);
          return errores.list ? { data: null, error: errores.list } : { data: avatares, error: null };
        },
        remove: async (rutas) => {
          llamadas.push(['remove', bucket, rutas]);
          return { error: errores[`remove_${bucket}`] ?? null };
        },
      }),
    },
    auth: {
      admin: {
        deleteUser: async (id) => {
          llamadas.push(['deleteUser', id]);
          return { error: errores.deleteUser ?? null };
        },
      },
    },
  };
  return admin;
};

const nombres = (admin) => admin.llamadas.map(([tipo, nombre]) => (tipo === 'rpc' ? nombre : tipo));

describe('eliminarCuenta', () => {
  it('sin viajes en solitario borra los datos, las fotos de perfil y el usuario de Auth, por ese orden', async () => {
    const admin = adminFalso({ avatares: [{ name: 'a.jpg' }, { name: 'b.png' }] });

    const resultado = await cuentaService.eliminarCuenta(admin, USUARIO_ID);

    assert.deepEqual(resultado, { estado: 'ok' });
    assert.deepEqual(nombres(admin), ['viajes_en_solitario', 'eliminar_datos_cuenta', 'list', 'remove', 'deleteUser']);
    assert.deepEqual(admin.llamadas[1][2], { p_usuario_id: USUARIO_ID });
    assert.deepEqual(admin.llamadas[3], ['remove', 'avatares', [`${USUARIO_ID}/a.jpg`, `${USUARIO_ID}/b.png`]]);
    assert.deepEqual(admin.llamadas[4], ['deleteUser', USUARIO_ID]);
  });

  it('borra los archivos de los viajes en solitario antes de borrar los datos', async () => {
    const admin = adminFalso({
      solitarios: [{ id: VIAJE_ID, documentos: ['d/1.pdf'], fotos: [], portadas: ['p/1.jpg'] }],
    });

    const resultado = await cuentaService.eliminarCuenta(admin, USUARIO_ID);

    assert.deepEqual(resultado, { estado: 'ok' });
    const borrados = admin.llamadas.filter(([tipo, bucket]) => tipo === 'remove' && bucket !== 'avatares');
    assert.deepEqual(borrados, [
      ['remove', 'documentos', ['d/1.pdf']],
      ['remove', 'portadas', ['p/1.jpg']],
    ]);
    const posicion = (nombre) => nombres(admin).indexOf(nombre);
    assert.ok(posicion('remove') < posicion('eliminar_datos_cuenta'));
  });

  it('devuelve error y no toca nada más si falla la consulta de los viajes en solitario', async () => {
    const admin = adminFalso({ errores: { viajes_en_solitario: { message: 'fallo' } } });

    const resultado = await cuentaService.eliminarCuenta(admin, USUARIO_ID);

    assert.ok(resultado.error);
    assert.deepEqual(nombres(admin), ['viajes_en_solitario']);
  });

  it('devuelve error y no borra el usuario si Storage no borra los archivos de un viaje', async () => {
    const admin = adminFalso({
      solitarios: [{ id: VIAJE_ID, documentos: ['d/1.pdf'], fotos: [], portadas: [] }],
      errores: { remove_documentos: { message: 'fallo' } },
    });

    const resultado = await cuentaService.eliminarCuenta(admin, USUARIO_ID);

    assert.ok(resultado.error);
    assert.ok(!nombres(admin).includes('eliminar_datos_cuenta'));
    assert.ok(!nombres(admin).includes('deleteUser'));
  });

  it('devuelve error y no borra el usuario si eliminar_datos_cuenta falla o no borra nada', async () => {
    const conError = adminFalso({ errores: { eliminar_datos_cuenta: { message: 'fallo' } } });
    assert.ok((await cuentaService.eliminarCuenta(conError, USUARIO_ID)).error);
    assert.ok(!nombres(conError).includes('deleteUser'));

    const sinBorrar = adminFalso({ datos: false });
    assert.ok((await cuentaService.eliminarCuenta(sinBorrar, USUARIO_ID)).error);
    assert.ok(!nombres(sinBorrar).includes('deleteUser'));
  });

  it('devuelve error y no borra el usuario si no se pueden borrar las fotos de perfil', async () => {
    const admin = adminFalso({ errores: { list: { message: 'fallo' } } });

    assert.ok((await cuentaService.eliminarCuenta(admin, USUARIO_ID)).error);
    assert.ok(!nombres(admin).includes('deleteUser'));
  });

  it('devuelve error si Supabase Auth no borra el usuario', async () => {
    const admin = adminFalso({ errores: { deleteUser: { message: 'fallo' } } });

    const resultado = await cuentaService.eliminarCuenta(admin, USUARIO_ID);

    assert.ok(resultado.error);
  });
});
