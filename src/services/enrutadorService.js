const URL_POR_DEFECTO = 'https://routing.openstreetmap.de/routed-foot/route/v1/driving';
const USER_AGENT_POR_DEFECTO = 'TravelWrap/1.0 (proyecto de Gestión de Proyecto Software, Universidad de Zaragoza)';
const INTERVALO_ENTRE_LLAMADAS_MS = 1000;
const INTERVALO_POR_USUARIO_MS = 1000;
const MAX_PENDIENTES = 5;
const TIEMPO_MAXIMO_MS = 8000;
const VIDA_CACHE_MS = 10 * 60 * 1000;
const MAX_ENTRADAS_CACHE = 100;
const MAX_USUARIOS_RECORDADOS = 500;
const MAX_PUNTOS_GEOMETRIA = 2000;

const esperar = (milisegundos) => new Promise((resolver) => setTimeout(resolver, milisegundos));

const redondear = (numero, decimales) => {
  const factor = 10 ** decimales;
  return Math.round(numero * factor) / factor;
};

const coordenadaValida = (par) =>
  Array.isArray(par) &&
  par.length >= 2 &&
  Number.isFinite(par[0]) &&
  Number.isFinite(par[1]) &&
  Math.abs(par[0]) <= 180 &&
  Math.abs(par[1]) <= 90;

const reducirGeometria = (coordenadas) => {
  if (coordenadas.length <= MAX_PUNTOS_GEOMETRIA) return coordenadas;
  const salto = Math.ceil(coordenadas.length / MAX_PUNTOS_GEOMETRIA);
  const reducida = coordenadas.filter((_, indice) => indice % salto === 0);
  const ultima = coordenadas[coordenadas.length - 1];
  if (reducida[reducida.length - 1] !== ultima) reducida.push(ultima);
  return reducida;
};

const aRuta = (respuesta) => {
  const trayecto = respuesta?.routes?.[0];
  const coordenadas = trayecto?.geometry?.coordinates;
  if (
    !trayecto ||
    !Number.isFinite(trayecto.distance) ||
    !Number.isFinite(trayecto.duration) ||
    !Array.isArray(coordenadas) ||
    coordenadas.length < 2 ||
    !coordenadas.every(coordenadaValida)
  ) {
    return null;
  }

  const geometria = [];
  for (const [longitud, latitud] of reducirGeometria(coordenadas)) {
    const punto = [redondear(latitud, 5), redondear(longitud, 5)];
    const anterior = geometria.at(-1);
    if (anterior?.[0] !== punto[0] || anterior?.[1] !== punto[1]) geometria.push(punto);
  }
  return {
    distancia_m: Math.round(trayecto.distance),
    duracion_s: Math.round(trayecto.duration),
    geometria,
  };
};

const crearEnrutador = ({
  peticion = (...argumentos) => fetch(...argumentos),
  ahora = () => Date.now(),
  pausa = esperar,
  url = process.env.RUTAS_URL || URL_POR_DEFECTO,
  userAgent = process.env.RUTAS_USER_AGENT || process.env.NOMINATIM_USER_AGENT || USER_AGENT_POR_DEFECTO,
  tiempoMaximoMs = TIEMPO_MAXIMO_MS,
} = {}) => {
  const cache = new Map();
  const ultimaPeticionDelUsuario = new Map();
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
    const anterior = ultimaPeticionDelUsuario.get(usuarioId);
    if (anterior !== undefined && instante - anterior < INTERVALO_POR_USUARIO_MS) return true;

    if (ultimaPeticionDelUsuario.size >= MAX_USUARIOS_RECORDADOS) {
      for (const [id, momento] of ultimaPeticionDelUsuario) {
        if (instante - momento >= INTERVALO_POR_USUARIO_MS) ultimaPeticionDelUsuario.delete(id);
      }
    }
    ultimaPeticionDelUsuario.set(usuarioId, instante);
    return false;
  };

  const guardarEnCache = (clave, ruta) => {
    if (cache.size >= MAX_ENTRADAS_CACHE) cache.delete(cache.keys().next().value);
    cache.set(clave, { ruta, caduca: ahora() + VIDA_CACHE_MS });
  };

  const pedirLaRuta = async (clave) => {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), tiempoMaximoMs);

    try {
      const respuesta = await peticion(`${url}/${clave}?overview=full&geometries=geojson&steps=false`, {
        headers: { 'User-Agent': userAgent },
        signal: controlador.signal,
      });
      if (respuesta.status === 429) return { estado: 'ocupado' };
      if (respuesta.status === 400) {
        const cuerpo = await respuesta.json().catch(() => null);
        if (cuerpo?.code === 'NoRoute' || cuerpo?.code === 'NoSegment') return { estado: 'sin_ruta' };
      }
      if (!respuesta.ok) return { error: { code: `http_${respuesta.status}` } };

      const cuerpo = await respuesta.json();
      if (cuerpo?.code === 'NoRoute' || cuerpo?.code === 'NoSegment') return { estado: 'sin_ruta' };
      const ruta = cuerpo?.code === 'Ok' ? aRuta(cuerpo) : null;
      if (!ruta) return { error: { code: 'respuesta_no_valida' } };
      return { estado: 'ok', ruta };
    } catch (error) {
      return { error: { code: error?.name === 'AbortError' ? 'tiempo_agotado' : 'sin_conexion' } };
    } finally {
      clearTimeout(temporizador);
    }
  };

  const trazar = async (puntos, usuarioId) => {
    const clave = puntos.map((punto) => `${redondear(punto.longitud, 6)},${redondear(punto.latitud, 6)}`).join(';');

    const guardado = cache.get(clave);
    if (guardado && guardado.caduca > ahora()) return { estado: 'ok', ruta: guardado.ruta };

    if (demasiadoRapido(usuarioId)) return { estado: 'demasiado_rapido' };
    if (pendientes >= MAX_PENDIENTES) return { estado: 'ocupado' };

    pendientes += 1;
    try {
      await esperarTurno();
      const resultado = await pedirLaRuta(clave);
      if (resultado.estado === 'ok') guardarEnCache(clave, resultado.ruta);
      return resultado;
    } finally {
      pendientes -= 1;
    }
  };

  return { trazar };
};

module.exports = { ...crearEnrutador(), crearEnrutador };
