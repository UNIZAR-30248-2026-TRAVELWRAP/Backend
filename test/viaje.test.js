// Pruebas de los endpoints de viajes: controlador y servicio con un cliente de Supabase simulado.
// No tocan la red ni la base de datos real. Se ejecutan con `npm test`.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const viajeController = require('../src/controllers/viajeController');

const USUARIO_ID = 'df77cba6-4be5-4cbc-814b-1e228dd73dcc';
const OTRO_ID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
const VIAJE_ID = '123e4567-e89b-12d3-a456-426614174000';

// Consulta encadenable que se resuelve con el resultado dado, como las del cliente real
const consulta = (resultado, registro = {}) => {
  const q = {
    select: () => q,
    order: () => q,
    eq: (columna, valor) => {
      registro.filtros = { ...registro.filtros, [columna]: valor };
      return q;
    },
    maybeSingle: () => Promise.resolve(resultado),
    then: (alResolver, alRechazar) => Promise.resolve(resultado).then(alResolver, alRechazar),
  };
  return q;
};

const clienteFalso = ({ tabla = { data: [], error: null }, rpc = { data: null, error: null } } = {}) => {
  const registro = { rpc: [] };
  return {
    registro,
    from: () => consulta(tabla, registro),
    rpc: async (nombre, parametros) => {
      registro.rpc.push({ nombre, parametros });
      return rpc;
    },
  };
};

const respuestaFalsa = () => {
  const res = { estado: null, cuerpo: null };
  res.status = (estado) => {
    res.estado = estado;
    return { json: (cuerpo) => { res.cuerpo = cuerpo; } };
  };
  return res;
};

const llamar = async (controlador, { body, query = {}, params = {}, supabase = clienteFalso() } = {}) => {
  const res = respuestaFalsa();
  await controlador({ body, query, params, supabase, usuario: { id: USUARIO_ID } }, res);
  return res;
};

const fila = (id, { destino = 'Roma', estado = 'activo', miembros } = {}) => ({
  id,
  nombre: 'Roma 2027',
  destino,
  descripcion: null,
  fecha_inicio: '2027-05-12',
  fecha_fin: '2027-05-15',
  moneda: 'EUR',
  presupuesto: 850,
  estado,
  creado_en: '2026-10-12T10:00:00Z',
  miembros_viaje: miembros ?? [
    { usuario_id: USUARIO_ID, rol: 'creador', abandonado_en: null, perfiles: { nombre: 'Daniel', avatar_url: null } },
    { usuario_id: OTRO_ID, rol: 'miembro', abandonado_en: null, perfiles: { nombre: 'Berta', avatar_url: null } },
  ],
});

describe('POST /viajes (crear)', () => {
  const valido = { nombre: 'Roma 2027', presupuesto: 850, destino: 'Roma', fecha_inicio: '2027-05-12', fecha_fin: '2027-05-15' };
  const viajeCreado = { id: VIAJE_ID, nombre: 'Roma 2027', destino: 'Roma', estado: 'activo', presupuesto: 850 };

  it('crea el viaje llamando a la función crear_viaje con los datos normalizados', async () => {
    const supabase = clienteFalso({ rpc: { data: { estado: 'ok', viaje: viajeCreado }, error: null } });

    const res = await llamar(viajeController.crear, { body: { ...valido, nombre: '  Roma 2027  ', destino: ' Roma ' }, supabase });

    assert.equal(res.estado, 201);
    assert.equal(res.cuerpo.id, VIAJE_ID);
    assert.equal(res.cuerpo.pendiente_destino, false);
    assert.deepEqual(supabase.registro.rpc, [
      {
        nombre: 'crear_viaje',
        parametros: {
          p_nombre: 'Roma 2027',
          p_destino: 'Roma',
          p_fecha_inicio: '2027-05-12',
          p_fecha_fin: '2027-05-15',
          p_presupuesto: 850,
        },
      },
    ]);
  });

  it('un viaje sin destino (ausente, null o vacío) queda pendiente de destino', async () => {
    for (const destino of [undefined, null, '', '   ']) {
      const supabase = clienteFalso({
        rpc: { data: { estado: 'ok', viaje: { ...viajeCreado, destino: null } }, error: null },
      });

      const res = await llamar(viajeController.crear, { body: { nombre: 'Verano 2027', presupuesto: 0, destino, fecha_inicio: '', fecha_fin: '' }, supabase });

      assert.equal(res.estado, 201, `destino ${JSON.stringify(destino)}`);
      assert.equal(res.cuerpo.destino, null);
      assert.equal(res.cuerpo.pendiente_destino, true);
      assert.equal(supabase.registro.rpc[0].parametros.p_destino, null);
      assert.equal(supabase.registro.rpc[0].parametros.p_fecha_inicio, null);
    }
  });

  it('rechaza con 400 los datos inválidos sin llegar a la base de datos', async () => {
    const invalidos = {
      'sin nombre': { ...valido, nombre: '   ' },
      'nombre demasiado largo': { ...valido, nombre: 'x'.repeat(101) },
      'sin presupuesto': { nombre: 'Roma' },
      'presupuesto negativo': { ...valido, presupuesto: -1 },
      'presupuesto como texto': { ...valido, presupuesto: '850' },
      'presupuesto desorbitado': { ...valido, presupuesto: 1e10 },
      'destino que no es texto': { ...valido, destino: 5 },
      'fecha con formato incorrecto': { ...valido, fecha_inicio: '12/05/2027' },
      'fecha inexistente': { ...valido, fecha_inicio: '2027-02-30' },
      'fin anterior al inicio': { ...valido, fecha_inicio: '2027-05-15', fecha_fin: '2027-05-12' },
    };

    for (const [caso, body] of Object.entries(invalidos)) {
      const supabase = clienteFalso();
      const res = await llamar(viajeController.crear, { body, supabase });

      assert.equal(res.estado, 400, caso);
      assert.equal(res.cuerpo.error.codigo, 'datos_invalidos', caso);
      assert.equal(supabase.registro.rpc.length, 0, `${caso}: no debe llamar a la base de datos`);
    }
    assert.equal((await llamar(viajeController.crear, { body: undefined })).estado, 400);
  });

  it('traduce los fallos de la base de datos', async () => {
    const checkViolado = clienteFalso({ rpc: { data: null, error: { code: '23514' } } });
    assert.equal((await llamar(viajeController.crear, { body: valido, supabase: checkViolado })).estado, 400);

    const caida = clienteFalso({ rpc: { data: null, error: { code: 'PGRST000' } } });
    const res = await llamar(viajeController.crear, { body: valido, supabase: caida });
    assert.equal(res.estado, 502);
    assert.equal(res.cuerpo.error.codigo, 'error_viaje');

    const sinSesion = clienteFalso({ rpc: { data: { estado: 'sin_sesion' }, error: null } });
    assert.equal((await llamar(viajeController.crear, { body: valido, supabase: sinSesion })).estado, 401);
  });
});

describe('GET /viajes (listar)', () => {
  it('devuelve los viajes con rol, miembros y si están pendientes de destino', async () => {
    const supabase = clienteFalso({
      tabla: { data: [fila('a', { destino: 'Roma' }), fila('b', { destino: null })], error: null },
    });

    const res = await llamar(viajeController.listar, { supabase });

    assert.equal(res.estado, 200);
    const [conDestino, pendiente] = res.cuerpo.viajes;
    assert.equal(conDestino.pendiente_destino, false);
    assert.equal(pendiente.pendiente_destino, true);
    assert.equal(conDestino.rol, 'creador');
    assert.deepEqual(conDestino.miembros.map((m) => m.nombre), ['Daniel', 'Berta']);
    assert.equal('miembros_viaje' in conDestino, false);
    assert.equal('token_invitacion' in conDestino, false);
  });

  it('un viaje finalizado sin destino no cuenta como pendiente', async () => {
    const supabase = clienteFalso({ tabla: { data: [fila('a', { destino: null, estado: 'finalizado' })], error: null } });

    const res = await llamar(viajeController.listar, { supabase });

    assert.equal(res.cuerpo.viajes[0].pendiente_destino, false);
  });

  it('no incluye los viajes que el usuario ha abandonado ni los de los que no es miembro', async () => {
    const abandonado = fila('a', {
      miembros: [{ usuario_id: USUARIO_ID, rol: 'miembro', abandonado_en: '2026-10-01T00:00:00Z', perfiles: null }],
    });
    const ajeno = fila('b', {
      miembros: [{ usuario_id: OTRO_ID, rol: 'creador', abandonado_en: null, perfiles: { nombre: 'Berta', avatar_url: null } }],
    });
    const supabase = clienteFalso({ tabla: { data: [abandonado, ajeno, fila('c')], error: null } });

    const res = await llamar(viajeController.listar, { supabase });

    assert.deepEqual(res.cuerpo.viajes.map((v) => v.id), ['c']);
  });

  it('filtra por estado y rechaza un estado desconocido', async () => {
    const supabase = clienteFalso();
    const res = await llamar(viajeController.listar, { query: { estado: 'finalizado' }, supabase });
    assert.equal(res.estado, 200);
    assert.deepEqual(res.cuerpo, { viajes: [] });
    assert.equal(supabase.registro.filtros.estado, 'finalizado');

    const invalido = await llamar(viajeController.listar, { query: { estado: 'otro' } });
    assert.equal(invalido.estado, 400);
  });

  it('responde 502 si falla la consulta', async () => {
    const supabase = clienteFalso({ tabla: { data: null, error: { code: 'PGRST000' } } });
    assert.equal((await llamar(viajeController.listar, { supabase })).estado, 502);
  });
});

describe('GET /viajes/:viajeId (obtener)', () => {
  it('devuelve el detalle del viaje al que pertenece el usuario', async () => {
    const supabase = clienteFalso({ tabla: { data: fila(VIAJE_ID, { destino: null }), error: null } });

    const res = await llamar(viajeController.obtener, { params: { viajeId: VIAJE_ID }, supabase });

    assert.equal(res.estado, 200);
    assert.equal(res.cuerpo.id, VIAJE_ID);
    assert.equal(res.cuerpo.pendiente_destino, true);
    assert.equal(res.cuerpo.miembros.length, 2);
    assert.equal(supabase.registro.filtros.id, VIAJE_ID);
  });

  it('responde 404 si el viaje no existe o el usuario no es miembro activo', async () => {
    const inexistente = clienteFalso({ tabla: { data: null, error: null } });
    assert.equal((await llamar(viajeController.obtener, { params: { viajeId: VIAJE_ID }, supabase: inexistente })).estado, 404);

    const ajeno = fila(VIAJE_ID, {
      miembros: [{ usuario_id: OTRO_ID, rol: 'creador', abandonado_en: null, perfiles: null }],
    });
    const res = await llamar(viajeController.obtener, { params: { viajeId: VIAJE_ID }, supabase: clienteFalso({ tabla: { data: ajeno, error: null } }) });
    assert.equal(res.estado, 404);
    assert.equal(res.cuerpo.error.codigo, 'viaje_no_encontrado');
  });

  it('rechaza con 400 un identificador que no es un UUID', async () => {
    const res = await llamar(viajeController.obtener, { params: { viajeId: 'no-es-un-uuid' } });
    assert.equal(res.estado, 400);
  });
});
