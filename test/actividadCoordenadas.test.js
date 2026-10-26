const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const actividadService = require('../src/services/actividadService');
const actividadController = require('../src/controllers/actividadController');

const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const ACTIVIDAD_ID = '8a1b2c3d-0000-4000-8000-000000000020';
const USUARIO = { id: 'df77cba6-4be5-4cbc-814b-1e228dd73dcc' };
const MENSAJE_JUNTAS = 'La latitud y la longitud se envían juntas o ninguna';

const crearRes = () => ({
  codigo: null,
  cuerpo: undefined,
  status(codigo) {
    this.codigo = codigo;
    return this;
  },
  json(cuerpo) {
    this.cuerpo = cuerpo;
    return this;
  },
});

const llamar = async (accion, body) => {
  const req = { params: { viajeId: VIAJE_ID, actividadId: ACTIVIDAD_ID }, body, usuario: USUARIO, supabase: {} };
  const res = crearRes();
  await actividadController[accion](req, res);
  return res;
};

const simular = (metodo) => mock.method(actividadService, metodo, async () => ({ estado: 'ok', actividad: {} }));

const BASE = { titulo: 'Coliseo', fecha: '2027-05-12' };

afterEach(() => mock.restoreAll());

describe('POST /viajes/:viajeId/actividades · coordenadas', () => {
  it('guarda la latitud y la longitud redondeadas a seis decimales con el identificador del lugar', async () => {
    const crear = simular('crear');

    const res = await llamar('crear', {
      ...BASE,
      latitud: 41.8902142,
      longitud: 12.4922309,
      lugar_externo_id: ' way/24146600 ',
    });

    assert.equal(res.codigo, 201);
    const datos = crear.mock.calls[0].arguments[3];
    assert.equal(datos.latitud, 41.890214);
    assert.equal(datos.longitud, 12.492231);
    assert.equal(datos.lugar_externo_id, 'way/24146600');
  });

  it('acepta latitud y longitud negativas y en los límites', async () => {
    const crear = simular('crear');

    await llamar('crear', { ...BASE, latitud: -90, longitud: -180 });
    await llamar('crear', { ...BASE, latitud: 90, longitud: 180 });

    assert.equal(crear.mock.calls[0].arguments[3].latitud, -90);
    assert.equal(crear.mock.calls[1].arguments[3].longitud, 180);
  });

  it('sin coordenadas las deja en null', async () => {
    const crear = simular('crear');

    await llamar('crear', BASE);
    await llamar('crear', { ...BASE, latitud: null, longitud: null, lugar_externo_id: '' });

    for (const llamada of crear.mock.calls) {
      assert.deepEqual(
        [llamada.arguments[3].latitud, llamada.arguments[3].longitud, llamada.arguments[3].lugar_externo_id],
        [null, null, null],
      );
    }
  });

  const invalidos = [
    ['solo la latitud', { latitud: 41.89 }, MENSAJE_JUNTAS],
    ['solo la longitud', { longitud: 12.49 }, MENSAJE_JUNTAS],
    ['una coordenada y la otra null', { latitud: 41.89, longitud: null }, MENSAJE_JUNTAS],
    ['latitud fuera de rango', { latitud: 91, longitud: 12 }, 'La latitud debe ser un número entre -90 y 90'],
    ['latitud muy negativa', { latitud: -90.000001, longitud: 12 }, 'La latitud debe ser un número entre -90 y 90'],
    ['longitud fuera de rango', { latitud: 41, longitud: 181 }, 'La longitud debe ser un número entre -180 y 180'],
    ['latitud como texto', { latitud: '41.89', longitud: 12 }, 'La latitud debe ser un número entre -90 y 90'],
    ['longitud como texto', { latitud: 41, longitud: '12.49' }, 'La longitud debe ser un número entre -180 y 180'],
    ['identificador demasiado largo', { lugar_externo_id: 'a'.repeat(101) }, 'El identificador del lugar debe ser un texto de 100 caracteres como máximo'],
    ['identificador como número', { lugar_externo_id: 5 }, 'El identificador del lugar debe ser un texto de 100 caracteres como máximo'],
  ];
  for (const [caso, extra, mensaje] of invalidos) {
    it(`rechaza con 400 ${caso} sin llamar al servicio`, async () => {
      const crear = simular('crear');

      const res = await llamar('crear', { ...BASE, ...extra });

      assert.equal(res.codigo, 400);
      assert.deepEqual(res.cuerpo, { error: { codigo: 'datos_invalidos', mensaje } });
      assert.equal(crear.mock.callCount(), 0);
    });
  }
});

describe('PATCH /viajes/:viajeId/actividades/:actividadId · coordenadas', () => {
  it('cambia el lugar junto con sus coordenadas', async () => {
    const editar = simular('editar');

    const res = await llamar('editar', {
      ubicacion_nombre: 'Colosseo, Roma',
      latitud: 41.8902142,
      longitud: 12.4922309,
      lugar_externo_id: 'way/1',
    });

    assert.equal(res.codigo, 200);
    assert.deepEqual(editar.mock.calls[0].arguments[4], {
      ubicacion_nombre: 'Colosseo, Roma',
      latitud: 41.890214,
      longitud: 12.492231,
      lugar_externo_id: 'way/1',
    });
  });

  it('quita las coordenadas enviando las dos como null', async () => {
    const editar = simular('editar');

    const res = await llamar('editar', { latitud: null, longitud: null, lugar_externo_id: null });

    assert.equal(res.codigo, 200);
    assert.deepEqual(editar.mock.calls[0].arguments[4], { latitud: null, longitud: null, lugar_externo_id: null });
  });

  it('permite cambiar solo el identificador del lugar', async () => {
    const editar = simular('editar');

    await llamar('editar', { lugar_externo_id: 'node/9' });

    assert.deepEqual(editar.mock.calls[0].arguments[4], { lugar_externo_id: 'node/9' });
  });

  const invalidos = [
    ['solo la latitud', { latitud: 41.89 }, MENSAJE_JUNTAS],
    ['solo la longitud', { longitud: 12.49 }, MENSAJE_JUNTAS],
    ['una coordenada y la otra null', { latitud: null, longitud: 12.49 }, MENSAJE_JUNTAS],
    ['la otra coordenada null', { latitud: 41.89, longitud: null }, MENSAJE_JUNTAS],
    ['latitud fuera de rango', { latitud: -91, longitud: 12 }, 'La latitud debe ser un número entre -90 y 90'],
    ['longitud fuera de rango', { latitud: 41, longitud: -181 }, 'La longitud debe ser un número entre -180 y 180'],
    ['identificador como número', { lugar_externo_id: 7 }, 'El identificador del lugar debe ser un texto de 100 caracteres como máximo'],
  ];
  for (const [caso, body, mensaje] of invalidos) {
    it(`rechaza con 400 ${caso} sin llamar al servicio`, async () => {
      const editar = simular('editar');

      const res = await llamar('editar', body);

      assert.equal(res.codigo, 400);
      assert.deepEqual(res.cuerpo, { error: { codigo: 'datos_invalidos', mensaje } });
      assert.equal(editar.mock.callCount(), 0);
    });
  }
});
