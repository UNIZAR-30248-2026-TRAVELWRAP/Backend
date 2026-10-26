const URL_NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT_POR_DEFECTO = 'TravelWrap/1.0 (proyecto de Gestión de Proyecto Software, Universidad de Zaragoza)';
const INTERVALO_ENTRE_LLAMADAS_MS = 1000;
const INTERVALO_POR_USUARIO_MS = 1000;
const MAX_PENDIENTES = 5;
const TIEMPO_MAXIMO_MS = 5000;
const MAX_RESULTADOS = 5;
const MAX_NOMBRE = 200;
const VIDA_CACHE_MS = 10 * 60 * 1000;
const MAX_ENTRADAS_CACHE = 200;
const MAX_USUARIOS_RECORDADOS = 500;

const esperar = (milisegundos) => new Promise((resolver) => setTimeout(resolver, milisegundos));

const acortar = (texto) => (texto.length > MAX_NOMBRE ? `${texto.slice(0, MAX_NOMBRE - 1).trimEnd()}…` : texto);

const redondear = (numero) => Math.round(numero * 1e6) / 1e6;

const limpiar = (valor) => (typeof valor === 'string' ? valor.trim() : '');

const LOCALIDADES = ['city', 'town', 'village', 'municipality', 'hamlet', 'county'];

const describir = (lugar, completo) => {
  const direccion = lugar.address && typeof lugar.address === 'object' ? lugar.address : null;
  const partes = completo.split(',').map((parte) => parte.trim()).filter(Boolean);

  if (!direccion) {
    return {
      titulo: partes[0] ?? completo,
      detalle: partes.slice(1).slice(-2).join(', ') || null,
      nombre: completo,
    };
  }

  const calle = [limpiar(direccion.road), limpiar(direccion.house_number)].filter(Boolean).join(' ');
  const titulo = limpiar(lugar.name) || calle || partes[0] || completo;
  const localidad = LOCALIDADES.map((clave) => limpiar(direccion[clave])).find(Boolean) ?? '';
  const otraLocalidad = localidad && localidad !== titulo ? localidad : '';
  const zona = otraLocalidad || limpiar(direccion.state);

  return {
    titulo,
    detalle: [zona, limpiar(direccion.country)].filter((parte) => parte && parte !== titulo).join(', ') || null,
    nombre: [titulo, otraLocalidad].filter(Boolean).join(', '),
  };
};

const aDireccion = (lugar) => {
  const latitud = Number(lugar?.lat);
  const longitud = Number(lugar?.lon);
  const completo = typeof lugar?.display_name === 'string' ? lugar.display_name.trim() : '';
  const coordenadasValidas =
    Number.isFinite(latitud) && Number.isFinite(longitud) && Math.abs(latitud) <= 90 && Math.abs(longitud) <= 180;
  if (completo === '' || !coordenadasValidas) return null;

  const { titulo, detalle, nombre } = describir(lugar, completo);
  return {
    nombre: acortar(nombre),
    titulo: acortar(titulo),
    detalle: detalle === null ? null : acortar(detalle),
    latitud: redondear(latitud),
    longitud: redondear(longitud),
    lugar_externo_id: lugar.osm_type && lugar.osm_id ? `${lugar.osm_type}/${lugar.osm_id}` : null,
  };
};

const sinRepetidas = (direcciones) => {
  const vistas = new Set();
  return direcciones.filter((direccion) => {
    const clave = `${direccion.nombre}|${direccion.detalle}`.toLowerCase();
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
};

const crearGeocodificador = ({
  peticion = (...argumentos) => fetch(...argumentos),
  ahora = () => Date.now(),
  pausa = esperar,
  userAgent = process.env.NOMINATIM_USER_AGENT || USER_AGENT_POR_DEFECTO,
  tiempoMaximoMs = TIEMPO_MAXIMO_MS,
} = {}) => {
  const cache = new Map();
  const ultimaBusquedaDelUsuario = new Map();
  let cola = Promise.resolve();
  let ultimaLlamada = Number.NEGATIVE_INFINITY;
  let pendientes = 0;

  const esperarTurno = () => {
    const turno = cola.then(async () => {
      const espera = ultimaLlamada + INTERVALO_ENTRE_LLAMADAS_MS - ahora();
      if (espera > 0) await pausa(espera);
      ultimaLlamada = ahora();
    });
    cola = turno;
    return turno;
  };

  const demasiadoRapido = (usuarioId) => {
    const instante = ahora();
    const anterior = ultimaBusquedaDelUsuario.get(usuarioId);
    if (anterior !== undefined && instante - anterior < INTERVALO_POR_USUARIO_MS) return true;

    if (ultimaBusquedaDelUsuario.size >= MAX_USUARIOS_RECORDADOS) {
      for (const [id, momento] of ultimaBusquedaDelUsuario) {
        if (instante - momento >= INTERVALO_POR_USUARIO_MS) ultimaBusquedaDelUsuario.delete(id);
      }
    }
    ultimaBusquedaDelUsuario.set(usuarioId, instante);
    return false;
  };

  const guardarEnCache = (clave, direcciones) => {
    if (cache.size >= MAX_ENTRADAS_CACHE) cache.delete(cache.keys().next().value);
    cache.set(clave, { direcciones, caduca: ahora() + VIDA_CACHE_MS });
  };

  const pedirANominatim = async (consulta) => {
    const parametros = new URLSearchParams({
      q: consulta,
      format: 'jsonv2',
      limit: String(MAX_RESULTADOS),
      addressdetails: '1',
    });
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), tiempoMaximoMs);

    try {
      const respuesta = await peticion(`${URL_NOMINATIM}?${parametros}`, {
        headers: { 'User-Agent': userAgent, 'Accept-Language': 'es' },
        signal: controlador.signal,
      });
      if (respuesta.status === 429) return { estado: 'ocupado' };
      if (!respuesta.ok) return { error: { code: `http_${respuesta.status}` } };

      const lugares = await respuesta.json();
      if (!Array.isArray(lugares)) return { error: { code: 'respuesta_no_valida' } };
      return { estado: 'ok', direcciones: sinRepetidas(lugares.map(aDireccion).filter(Boolean)) };
    } catch (error) {
      return { error: { code: error?.name === 'AbortError' ? 'tiempo_agotado' : 'sin_conexion' } };
    } finally {
      clearTimeout(temporizador);
    }
  };

  const buscar = async (consulta, usuarioId) => {
    const clave = consulta.trim().toLowerCase().replace(/\s+/g, ' ');

    const guardado = cache.get(clave);
    if (guardado && guardado.caduca > ahora()) return { estado: 'ok', direcciones: guardado.direcciones };

    if (demasiadoRapido(usuarioId)) return { estado: 'demasiado_rapido' };
    if (pendientes >= MAX_PENDIENTES) return { estado: 'ocupado' };

    pendientes += 1;
    try {
      await esperarTurno();
      const resultado = await pedirANominatim(clave);
      if (resultado.estado === 'ok') guardarEnCache(clave, resultado.direcciones);
      return resultado;
    } finally {
      pendientes -= 1;
    }
  };

  return { buscar };
};

module.exports = { ...crearGeocodificador(), crearGeocodificador };
