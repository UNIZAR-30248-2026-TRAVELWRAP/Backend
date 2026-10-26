const { afterEach, describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const geocodificacionService = require('../src/services/geocodificacionService');
const direccionController = require('../src/controllers/direccionController');

const USUARIO = { id: 'df77cba6-4be5-4cbc-814b-1e228dd73dcc' };

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

const llamar = async (query) => {
  const req = { query, usuario: USUARIO };
  const res = crearRes();
  await direccionController.buscar(req, res);
  return res;
};

const simular = (implementacion) => mock.method(geocodificacionService, 'buscar', implementacion);

afterEach(() => mock.restoreAll());

describe('GET /direcciones (buscar)', () => {
  it('devuelve las direcciones encontradas y busca con el texto limpio y el usuario', async () => {
    const direcciones = [{ nombre: 'Colosseo, Roma', titulo: 'Colosseo', detalle: 'Roma, Italia', latitud: 41.89, longitud: 12.49, lugar_externo_id: 'way/1' }];
    const buscar = simular(async () => ({ estado: 'ok', direcciones }));

    const res = await llamar({ q: '  Colosseo  ' });

    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { direcciones });
    assert.deepEqual(buscar.mock.calls[0].arguments, ['Colosseo', USUARIO.id]);
  });

  it('devuelve una lista vacía cuando no hay coincidencias', async () => {
    simular(async () => ({ estado: 'ok', direcciones: [] }));

    const res = await llamar({ q: 'zzzzzz' });

    assert.equal(res.codigo, 200);
    assert.deepEqual(res.cuerpo, { direcciones: [] });
  });

  const invalidas = [
    ['sin texto', {}],
    ['texto vacío', { q: '' }],
    ['solo espacios', { q: '     ' }],
    ['menos de 3 caracteres', { q: 'ab' }],
    ['más de 200 caracteres', { q: 'a'.repeat(201) }],
    ['texto repetido (varios q)', { q: ['Roma', 'Madrid'] }],
    ['texto como objeto', { q: { a: 'Roma' } }],
  ];
  for (const [caso, query] of invalidas) {
    it(`rechaza con 400 una búsqueda ${caso} sin llamar al servicio`, async () => {
      const buscar = simular(async () => ({ estado: 'ok', direcciones: [] }));

      const res = await llamar(query);

      assert.equal(res.codigo, 400);
      assert.deepEqual(res.cuerpo, {
        error: { codigo: 'datos_invalidos', mensaje: 'La búsqueda debe tener entre 3 y 200 caracteres' },
      });
      assert.equal(buscar.mock.callCount(), 0);
    });
  }

  it('acepta el mínimo y el máximo de caracteres', async () => {
    simular(async () => ({ estado: 'ok', direcciones: [] }));

    assert.equal((await llamar({ q: 'abc' })).codigo, 200);
    assert.equal((await llamar({ q: 'a'.repeat(200) })).codigo, 200);
  });

  const limites = [
    ['demasiado_rapido', 'demasiadas_busquedas'],
    ['ocupado', 'servicio_ocupado'],
  ];
  for (const [estado, codigo] of limites) {
    it(`responde 429 ${codigo} si el servicio dice ${estado}`, async () => {
      simular(async () => ({ estado }));

      const res = await llamar({ q: 'Colosseo' });

      assert.equal(res.codigo, 429);
      assert.equal(res.cuerpo.error.codigo, codigo);
    });
  }

  it('responde 502 si falla OpenStreetMap', async () => {
    simular(async () => ({ error: { code: 'sin_conexion' } }));

    const res = await llamar({ q: 'Colosseo' });

    assert.equal(res.codigo, 502);
    assert.deepEqual(res.cuerpo, {
      error: { codigo: 'error_geocodificacion', mensaje: 'No se ha podido buscar la dirección' },
    });
  });

  it('responde 502 ante un estado desconocido del servicio', async () => {
    simular(async () => ({ estado: 'otro' }));

    const res = await llamar({ q: 'Colosseo' });

    assert.equal(res.codigo, 502);
    assert.equal(res.cuerpo.error.codigo, 'error_geocodificacion');
  });

  it('responde 500 si el servicio lanza una excepción', async () => {
    simular(async () => {
      throw new Error('caída');
    });

    const res = await llamar({ q: 'Colosseo' });

    assert.equal(res.codigo, 500);
    assert.equal(res.cuerpo.error.codigo, 'error_interno');
  });
});
