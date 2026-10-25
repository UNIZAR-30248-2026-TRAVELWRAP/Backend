const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const actividadService = require('../src/services/actividadService');
const actividadController = require('../src/controllers/actividadController');

const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';
const ACTIVIDAD_ID = '8a1b2c3d-0000-4000-8000-000000000020';
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

const llamar = async (accion, { viajeId = VIAJE_ID, actividadId = ACTIVIDAD_ID, body } = {}) => {
  const req = { params: { viajeId, actividadId }, body, usuario: USUARIO, supabase: {} };
  const res = crearRes();
  await actividadController[accion](req, res);
  return res;
};

const simular = (metodo, implementacion) => mock.method(actividadService, metodo, implementacion);

afterEach(() => mock.restoreAll());

describe('PATCH /viajes/:viajeId/actividades/:actividadId (editar)', () => {
  it('envía al servicio solo los campos editables, ya limpios, y devuelve la actividad', async () => {
    const editar = simular('editar', async () => ({ estado: 'ok', actividad: { id: ACTIVIDAD_ID, titulo: 'Coliseo' } }));

    const res = await llamar('editar', {
      body: { titulo: '  Coliseo ', hora_fin: '12:30', ubicacion_nombre: ' Piazza ', orden: 9, viaje_id: 'otro', creado_por: 'x' },
    });

    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { id: ACTIVIDAD_ID, titulo: 'Coliseo' });
    const [, usuarioId, viajeId, actividadId, cambios] = editar.mock.calls[0].arguments;
    assert.equal(usuarioId, USUARIO.id);
    assert.equal(viajeId, VIAJE_ID);
    assert.equal(actividadId, ACTIVIDAD_ID);
    assert.deepEqual(cambios, { titulo: 'Coliseo', hora_fin: '12:30', ubicacion_nombre: 'Piazza' });
  });

  it('permite vaciar la hora, la ubicación y la categoría con null o texto vacío', async () => {
    const editar = simular('editar', async () => ({ estado: 'ok', actividad: {} }));

    const res = await llamar('editar', {
      body: { hora_inicio: null, hora_fin: '', ubicacion_nombre: '   ', categoria: null },
    });

    assert.equal(res.codigo, 200);
    assert.deepEqual(editar.mock.calls[0].arguments[4], {
      hora_inicio: null,
      hora_fin: null,
      ubicacion_nombre: null,
      categoria: null,
    });
  });

  it('acepta cambiar solo la fecha o solo la categoría', async () => {
    const editar = simular('editar', async () => ({ estado: 'ok', actividad: {} }));

    await llamar('editar', { body: { fecha: '2027-05-13' } });
    await llamar('editar', { body: { categoria: 'comida' } });

    assert.deepEqual(editar.mock.calls[0].arguments[4], { fecha: '2027-05-13' });
    assert.deepEqual(editar.mock.calls[1].arguments[4], { categoria: 'comida' });
  });

  const invalidos = [
    ['sin cuerpo', undefined, 'Indica al menos un dato de la actividad que cambiar'],
    ['cuerpo vacío', {}, 'Indica al menos un dato de la actividad que cambiar'],
    ['solo campos que no se pueden editar', { orden: 3, viaje_id: 'x' }, 'Indica al menos un dato de la actividad que cambiar'],
    ['título vacío', { titulo: '   ' }, 'El título es obligatorio y tiene un máximo de 200 caracteres'],
    ['título null', { titulo: null }, 'El título es obligatorio y tiene un máximo de 200 caracteres'],
    ['título demasiado largo', { titulo: 'a'.repeat(201) }, 'El título es obligatorio y tiene un máximo de 200 caracteres'],
    ['fecha null', { fecha: null }, 'La fecha es obligatoria y debe tener el formato AAAA-MM-DD'],
    ['fecha inexistente', { fecha: '2027-02-30' }, 'La fecha es obligatoria y debe tener el formato AAAA-MM-DD'],
    ['hora mal formada', { hora_inicio: '25:00' }, 'La hora debe tener el formato HH:MM'],
    ['hora de fin mal formada', { hora_fin: '9:5' }, 'La hora de fin debe tener el formato HH:MM'],
    ['categoría desconocida', { categoria: 'playa' }, 'La categoría debe ser comida, cultura, transporte, alojamiento u otro'],
    ['ubicación como número', { ubicacion_nombre: 5 }, 'La ubicación debe ser un texto de 200 caracteres como máximo'],
  ];
  for (const [caso, body, mensaje] of invalidos) {
    it(`rechaza con 400 ${caso} sin llamar al servicio`, async () => {
      const editar = simular('editar', async () => ({ estado: 'ok' }));

      const res = await llamar('editar', { body });

      assert.equal(res.codigo, 400);
      assert.deepEqual(res.cuerpo, { error: { codigo: 'datos_invalidos', mensaje } });
      assert.equal(editar.mock.callCount(), 0);
    });
  }

  it('rechaza un identificador de viaje o de actividad que no es un UUID', async () => {
    const editar = simular('editar', async () => ({ estado: 'ok' }));

    const viajeMalo = await llamar('editar', { viajeId: 'roma-2027', body: { titulo: 'X' } });
    const actividadMala = await llamar('editar', { actividadId: 'coliseo', body: { titulo: 'X' } });

    for (const res of [viajeMalo, actividadMala]) {
      assert.equal(res.codigo, 400);
      assert.equal(res.cuerpo.error.mensaje, 'El identificador del viaje o de la actividad no es válido');
    }
    assert.equal(editar.mock.callCount(), 0);
  });

  const motivos = [
    ['no_existe', 404, 'viaje_no_encontrado'],
    ['no_encontrada', 404, 'actividad_no_encontrada'],
    ['no_activo', 409, 'viaje_no_activo'],
    ['hora_fin_sin_inicio', 400, 'datos_invalidos'],
    ['horas_invertidas', 400, 'datos_invalidos'],
  ];
  for (const [estado, codigoHttp, codigo] of motivos) {
    it(`responde ${codigoHttp} ${codigo} si el servicio dice ${estado}`, async () => {
      simular('editar', async () => ({ estado }));

      const res = await llamar('editar', { body: { titulo: 'X' } });

      assert.equal(res.codigo, codigoHttp);
      assert.equal(res.cuerpo.error.codigo, codigo);
    });
  }

  it('responde 400 si la base de datos incumple un check', async () => {
    simular('editar', async () => ({ error: { code: '23514' } }));

    const res = await llamar('editar', { body: { titulo: 'X' } });

    assert.equal(res.codigo, 400);
    assert.equal(res.cuerpo.error.codigo, 'datos_invalidos');
  });

  it('responde 502 si falla la base de datos y 500 si el servicio lanza una excepción', async () => {
    simular('editar', async () => ({ error: { code: 'XX000' } }));
    const fallo = await llamar('editar', { body: { titulo: 'X' } });
    mock.restoreAll();
    simular('editar', async () => {
      throw new Error('caída');
    });
    const excepcion = await llamar('editar', { body: { titulo: 'X' } });

    assert.equal(fallo.codigo, 502);
    assert.equal(fallo.cuerpo.error.codigo, 'error_actividad');
    assert.equal(excepcion.codigo, 500);
    assert.equal(excepcion.cuerpo.error.codigo, 'error_interno');
  });
});

describe('DELETE /viajes/:viajeId/actividades/:actividadId (eliminar)', () => {
  it('elimina la actividad y responde 204 sin cuerpo', async () => {
    const eliminar = simular('eliminar', async () => ({ estado: 'ok' }));

    const res = await llamar('eliminar');

    assert.equal(res.codigo, 204);
    assert.equal(res.terminada, true);
    assert.equal(res.cuerpo, undefined);
    const [, usuarioId, viajeId, actividadId] = eliminar.mock.calls[0].arguments;
    assert.equal(usuarioId, USUARIO.id);
    assert.equal(viajeId, VIAJE_ID);
    assert.equal(actividadId, ACTIVIDAD_ID);
  });

  it('rechaza un identificador de viaje o de actividad que no es un UUID', async () => {
    const eliminar = simular('eliminar', async () => ({ estado: 'ok' }));

    const viajeMalo = await llamar('eliminar', { viajeId: 'roma-2027' });
    const actividadMala = await llamar('eliminar', { actividadId: 'coliseo' });

    for (const res of [viajeMalo, actividadMala]) {
      assert.equal(res.codigo, 400);
      assert.equal(res.cuerpo.error.mensaje, 'El identificador del viaje o de la actividad no es válido');
    }
    assert.equal(eliminar.mock.callCount(), 0);
  });

  const motivos = [
    ['no_existe', 404, 'viaje_no_encontrado'],
    ['no_encontrada', 404, 'actividad_no_encontrada'],
    ['no_activo', 409, 'viaje_no_activo'],
  ];
  for (const [estado, codigoHttp, codigo] of motivos) {
    it(`responde ${codigoHttp} ${codigo} si el servicio dice ${estado}`, async () => {
      simular('eliminar', async () => ({ estado }));

      const res = await llamar('eliminar');

      assert.equal(res.codigo, codigoHttp);
      assert.equal(res.cuerpo.error.codigo, codigo);
    });
  }

  it('responde 502 si falla la base de datos y 500 si el servicio lanza una excepción', async () => {
    simular('eliminar', async () => ({ error: { code: 'XX000' } }));
    const fallo = await llamar('eliminar');
    mock.restoreAll();
    simular('eliminar', async () => {
      throw new Error('caída');
    });
    const excepcion = await llamar('eliminar');

    assert.equal(fallo.codigo, 502);
    assert.equal(fallo.cuerpo.error.codigo, 'error_actividad');
    assert.equal(excepcion.codigo, 500);
    assert.equal(excepcion.cuerpo.error.codigo, 'error_interno');
  });
});
