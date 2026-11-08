const actividadService = require('./actividadService');
const enrutadorService = require('./enrutadorService');

const MAX_PUNTOS = 25;
const RADIO_TIERRA_M = 6371008.8;

const aRadianes = (grados) => (grados * Math.PI) / 180;

const distanciaDirecta = (a, b) => {
  const dLat = aRadianes(b.latitud - a.latitud);
  const dLon = aRadianes(b.longitud - a.longitud);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRadianes(a.latitud)) * Math.cos(aRadianes(b.latitud)) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
};

const longitudDelRecorrido = (puntos, orden) => {
  let total = 0;
  for (let i = 1; i < orden.length; i += 1) total += distanciaDirecta(puntos[orden[i - 1]], puntos[orden[i]]);
  return total;
};

const vecinoMasCercano = (puntos) => {
  const orden = [0];
  const pendientes = new Set(puntos.map((_, indice) => indice).slice(1));
  while (pendientes.size > 0) {
    const actual = puntos[orden[orden.length - 1]];
    let mejor = null;
    let mejorDistancia = Number.POSITIVE_INFINITY;
    for (const candidato of pendientes) {
      const distancia = distanciaDirecta(actual, puntos[candidato]);
      if (distancia < mejorDistancia) {
        mejor = candidato;
        mejorDistancia = distancia;
      }
    }
    orden.push(mejor);
    pendientes.delete(mejor);
  }
  return orden;
};

const mejorarConDosOpt = (puntos, ordenInicial) => {
  let orden = [...ordenInicial];
  let longitud = longitudDelRecorrido(puntos, orden);
  let mejora = true;
  while (mejora) {
    mejora = false;
    for (let i = 1; i < orden.length - 1; i += 1) {
      for (let j = i + 1; j < orden.length; j += 1) {
        const candidato = [...orden.slice(0, i), ...orden.slice(i, j + 1).reverse(), ...orden.slice(j + 1)];
        const longitudCandidato = longitudDelRecorrido(puntos, candidato);
        if (longitudCandidato < longitud - 1) {
          orden = candidato;
          longitud = longitudCandidato;
          mejora = true;
        }
      }
    }
  }
  return orden;
};

const ordenMasCorto = (puntos) => {
  const agenda = puntos.map((_, indice) => indice);
  if (puntos.length < 3) return agenda;
  const candidatos = [mejorarConDosOpt(puntos, agenda), mejorarConDosOpt(puntos, vecinoMasCercano(puntos))];
  return candidatos.reduce((mejor, actual) =>
    longitudDelRecorrido(puntos, actual) < longitudDelRecorrido(puntos, mejor) - 1 ? actual : mejor,
  );
};

const aPunto = (actividad) => ({
  id: actividad.id,
  titulo: actividad.titulo,
  latitud: actividad.latitud,
  longitud: actividad.longitud,
});

const calcular = async (cliente, usuarioId, viajeId, fecha) => {
  const listado = await actividadService.listar(cliente, usuarioId, viajeId, fecha);
  if (listado.error) return { error: listado.error };
  if (listado.estado !== 'ok') return { estado: listado.estado };

  const puntos = listado.actividades
    .filter((actividad) => actividad.latitud !== null && actividad.longitud !== null)
    .map(aPunto);
  if (puntos.length > MAX_PUNTOS) return { estado: 'demasiados_puntos' };

  const orden = ordenMasCorto(puntos);
  const ahorro = Math.round(
    longitudDelRecorrido(
      puntos,
      puntos.map((_, indice) => indice),
    ) - longitudDelRecorrido(puntos, orden),
  );
  const respuesta = {
    estado: 'ok',
    puntos,
    orden_sugerido: orden.map((indice) => puntos[indice].id),
    ahorro_m: Math.max(0, ahorro),
    ruta: null,
  };
  if (puntos.length < 2) return respuesta;

  const trazado = await enrutadorService.trazar(puntos, usuarioId);
  if (trazado.error) return { error: trazado.error };
  if (trazado.estado !== 'ok') return { estado: trazado.estado };
  return { ...respuesta, ruta: trazado.ruta };
};

module.exports = { calcular, ordenMasCorto, distanciaDirecta, MAX_PUNTOS };
