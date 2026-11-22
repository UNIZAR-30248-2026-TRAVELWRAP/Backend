const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const puntoInteresService = require('../src/services/puntoInteresService');
const puntoInteresController = require('../src/controllers/puntoInteresController');

const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const PUNTO_ID = '223e4567-e89b-12d3-a456-426614174000';
const USUARIO = { id: 'df77cba6-4be5-4cbc-814b-1e228dd73dcc' };

const crearRes = () => ({
  codigo: null,
  cuerpo: undefined,
  terminada: false,
  status(codigo) {
    this.codigo = codigo;
    return this;
  },
  json(cuerpo) {
    this.cuerpo = cuerpo;
    return this;
  },
  end() {
    this.terminada = true;
    return this;
  },
});

const llamar = async (accion, { viajeId = VIAJE_ID, puntoId = PUNTO_ID, body } = {}) => {
  const req = { params: { viajeId, puntoId }, body, usuario: USUARIO, supabase: {} };
  const res = crearRes();
  await puntoInteresController[accion](req, res);
  return res;
};

const simular = (metodo, implementacion) => mock.method(puntoInteresService, metodo, implementacion);

const CUERPO = { nombre: '  Fontana di Trevi ', nota: ' Ir temprano ', categoria: 'cultura', latitud: 41.9009, longitud: 12.4833 };

afterEach(() => mock.restoreAll());

describe('GET /viajes/:viajeId/puntos-de-interes', () => {
  it('devuelve la lista con 200', async () => {
    simular('listar', async () => ({ estado: 'ok', puntos_interes: [{ id: 'p1' }] }));

    const res = await llamar('listar');

    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { puntos_interes: [{ id: 'p1' }] });
  });

  it('rechaza un identificador de viaje que no es un UUID', async () => {
    const listar = simular('listar', async () => ({}));

    const res = await llamar('listar', { viajeId: 'roma' });

    assert.equal(res.codigo, 400);
    assert.equal(res.cuerpo.error.codigo, 'datos_invalidos');
    assert.equal(listar.mock.callCount(), 0);
  });

  it('responde 404 si el viaje no existe o no es miembro', async () => {
    simular('listar', async () => ({ estado: 'no_existe' }));

    const res = await llamar('listar');

    assert.equal(res.codigo, 404);
    assert.equal(res.cuerpo.error.codigo, 'viaje_no_encontrado');
  });

  it('responde 502 si falla la base de datos y 500 si el servicio lanza', async () => {
    simular('listar', async () => ({ error: { code: 'X' } }));
    assert.equal((await llamar('listar')).codigo, 502);
    mock.restoreAll();
    simular('listar', async () => {
      throw new Error('fallo');
    });
    const res = await llamar('listar');
    assert.equal(res.codigo, 500);
    assert.equal(res.cuerpo.error.codigo, 'error_interno');
  });
});

describe('POST /viajes/:viajeId/puntos-de-interes', () => {
  it('envía los datos limpios al servicio y responde 201 con el punto', async () => {
    const crear = simular('crear', async () => ({ estado: 'ok', punto: { id: PUNTO_ID } }));

    const res = await llamar('crear', { body: CUERPO });

    assert.equal(res.codigo, 201);
    assert.deepEqual(res.cuerpo, { id: PUNTO_ID });
    const [, usuarioId, viajeId, datos] = crear.mock.calls[0].arguments;
    assert.equal(usuarioId, USUARIO.id);
    assert.equal(viajeId, VIAJE_ID);
    assert.deepEqual(datos, {
      nombre: 'Fontana di Trevi',
      nota: 'Ir temprano',
      categoria: 'cultura',
      latitud: 41.9009,
      longitud: 12.4833,
      lugar_externo_id: null,
      direccion: null,
    });
  });

  it('guarda la dirección elegida con el buscador, limpia de espacios', async () => {
    const crear = simular('crear', async () => ({ estado: 'ok', punto: {} }));

    await llamar('crear', { body: { ...CUERPO, direccion: '  Piazza del Colosseo, Roma ' } });

    assert.equal(crear.mock.calls[0].arguments[3].direccion, 'Piazza del Colosseo, Roma');
  });

  it('la nota, la categoría y el lugar son opcionales', async () => {
    const crear = simular('crear', async () => ({ estado: 'ok', punto: {} }));

    const res = await llamar('crear', { body: { nombre: 'Mirador', latitud: 1, longitud: 2 } });

    assert.equal(res.codigo, 201);
    const [, , , datos] = crear.mock.calls[0].arguments;
    assert.equal(datos.nota, null);
    assert.equal(datos.categoria, null);
    assert.equal(datos.lugar_externo_id, null);
    assert.equal(datos.direccion, null);
  });

  const invalidos = [
    ['sin nombre', { ...CUERPO, nombre: '   ' }, 'El nombre es obligatorio y tiene un máximo de 120 caracteres'],
    ['nombre demasiado largo', { ...CUERPO, nombre: 'a'.repeat(121) }, 'El nombre es obligatorio y tiene un máximo de 120 caracteres'],
    ['nota demasiado larga', { ...CUERPO, nota: 'a'.repeat(301) }, 'La nota debe ser un texto de 300 caracteres como máximo'],
    ['nota que no es texto', { ...CUERPO, nota: 5 }, 'La nota debe ser un texto de 300 caracteres como máximo'],
    ['categoría desconocida', { ...CUERPO, categoria: 'museo' }, 'La categoría debe ser comida, cultura, transporte, alojamiento u otro'],
    ['sin latitud', { ...CUERPO, latitud: undefined }, 'La latitud es obligatoria y debe ser un número entre -90 y 90'],
    ['latitud fuera de rango', { ...CUERPO, latitud: 91 }, 'La latitud es obligatoria y debe ser un número entre -90 y 90'],
    ['longitud como texto', { ...CUERPO, longitud: '12' }, 'La longitud es obligatoria y debe ser un número entre -180 y 180'],
    ['longitud fuera de rango', { ...CUERPO, longitud: -181 }, 'La longitud es obligatoria y debe ser un número entre -180 y 180'],
    ['dirección demasiado larga', { ...CUERPO, direccion: 'a'.repeat(301) }, 'La dirección debe ser un texto de 300 caracteres como máximo'],
    ['lugar externo demasiado largo', { ...CUERPO, lugar_externo_id: 'a'.repeat(101) }, 'El identificador del lugar debe ser un texto de 100 caracteres como máximo'],
  ];

  for (const [nombre, body, mensaje] of invalidos) {
    it(`rechaza con 400 un punto ${nombre}`, async () => {
      const crear = simular('crear', async () => ({}));

      const res = await llamar('crear', { body });

      assert.equal(res.codigo, 400);
      assert.equal(res.cuerpo.error.codigo, 'datos_invalidos');
      assert.equal(res.cuerpo.error.mensaje, mensaje);
      assert.equal(crear.mock.callCount(), 0);
    });
  }

  it('rechaza un cuerpo vacío y un identificador de viaje que no es un UUID', async () => {
    simular('crear', async () => ({}));

    assert.equal((await llamar('crear', { body: undefined })).codigo, 400);
    assert.equal((await llamar('crear', { viajeId: 'roma', body: CUERPO })).cuerpo.error.mensaje, 'El identificador del viaje no es válido');
  });

  it('responde 404 si el viaje no existe y 409 si no está activo', async () => {
    simular('crear', async () => ({ estado: 'no_existe' }));
    const noExiste = await llamar('crear', { body: CUERPO });
    assert.equal(noExiste.codigo, 404);
    assert.equal(noExiste.cuerpo.error.codigo, 'viaje_no_encontrado');
    mock.restoreAll();
    simular('crear', async () => ({ estado: 'no_activo' }));
    const noActivo = await llamar('crear', { body: CUERPO });
    assert.equal(noActivo.codigo, 409);
    assert.equal(noActivo.cuerpo.error.codigo, 'viaje_no_activo');
  });

  it('responde 400 ante un check de la base de datos, 502 ante otro fallo y 500 si lanza', async () => {
    simular('crear', async () => ({ error: { code: '23514' } }));
    assert.equal((await llamar('crear', { body: CUERPO })).codigo, 400);
    mock.restoreAll();
    simular('crear', async () => ({ error: { code: 'X' } }));
    assert.equal((await llamar('crear', { body: CUERPO })).codigo, 502);
    mock.restoreAll();
    simular('crear', async () => {
      throw new Error('fallo');
    });
    assert.equal((await llamar('crear', { body: CUERPO })).codigo, 500);
  });
});

describe('DELETE /viajes/:viajeId/puntos-de-interes/:puntoId', () => {
  it('responde 204 al borrar', async () => {
    const eliminar = simular('eliminar', async () => ({ estado: 'ok' }));

    const res = await llamar('eliminar');

    assert.equal(res.codigo, 204);
    assert.equal(res.terminada, true);
    assert.deepEqual(eliminar.mock.calls[0].arguments.slice(1), [USUARIO.id, VIAJE_ID, PUNTO_ID]);
  });

  it('rechaza identificadores que no son UUID', async () => {
    const eliminar = simular('eliminar', async () => ({}));

    const a = await llamar('eliminar', { puntoId: 'p1' });
    const b = await llamar('eliminar', { viajeId: 'roma' });

    assert.equal(a.codigo, 400);
    assert.equal(b.codigo, 400);
    assert.equal(eliminar.mock.callCount(), 0);
  });

  it('responde 404 si el punto no existe y 409 si el viaje no está activo', async () => {
    simular('eliminar', async () => ({ estado: 'no_encontrado' }));
    const sinPunto = await llamar('eliminar');
    assert.equal(sinPunto.codigo, 404);
    assert.equal(sinPunto.cuerpo.error.codigo, 'punto_no_encontrado');
    mock.restoreAll();
    simular('eliminar', async () => ({ estado: 'no_activo' }));
    assert.equal((await llamar('eliminar')).codigo, 409);
  });

  it('responde 502 si falla la base de datos y 500 si lanza', async () => {
    simular('eliminar', async () => ({ error: { code: 'X' } }));
    assert.equal((await llamar('eliminar')).codigo, 502);
    mock.restoreAll();
    simular('eliminar', async () => {
      throw new Error('fallo');
    });
    assert.equal((await llamar('eliminar')).codigo, 500);
  });
});
