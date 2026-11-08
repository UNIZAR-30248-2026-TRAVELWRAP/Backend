const claveDeHora = (actividad) => (actividad.hora_inicio ? actividad.hora_inicio.slice(0, 5) : '');

const textoMenor = (a, b) => {
  if (a < b) return -1;
  return a > b ? 1 : 0;
};

const ordenValido = (actividad) => (Number.isFinite(actividad.orden) ? actividad.orden : 0);

const desempate = (a, b) => textoMenor(a.creado_en ?? '', b.creado_en ?? '') || textoMenor(a.id, b.id);

const porHora = (a, b) =>
  textoMenor(claveDeHora(a), claveDeHora(b)) || ordenValido(a) - ordenValido(b) || desempate(a, b);

const porOrden = (a, b) => ordenValido(a) - ordenValido(b) || desempate(a, b);

const posicionColocada = (actividad) => -ordenValido(actividad) - 1;

const porPosicionColocada = (a, b) => posicionColocada(a) - posicionColocada(b) || desempate(a, b);

const ordenarDia = (delDia) => {
  const conHora = delDia.filter((actividad) => claveDeHora(actividad) !== '').sort(porHora);
  const sinHora = delDia.filter((actividad) => claveDeHora(actividad) === '');
  const colocadas = sinHora.filter((actividad) => ordenValido(actividad) < 0).sort(porPosicionColocada);
  const alFinal = sinHora.filter((actividad) => ordenValido(actividad) >= 0).sort(porOrden);

  const resultado = [...conHora];
  let ultima = -1;
  for (const actividad of colocadas) {
    const posicion = Math.min(Math.max(posicionColocada(actividad), ultima + 1), resultado.length);
    resultado.splice(posicion, 0, actividad);
    ultima = posicion;
  }
  return [...resultado, ...alFinal];
};

const ordenarAgenda = (actividades) => {
  const porDia = new Map();
  for (const actividad of actividades) {
    if (porDia.has(actividad.fecha)) porDia.get(actividad.fecha).push(actividad);
    else porDia.set(actividad.fecha, [actividad]);
  }
  return [...porDia.keys()].sort().flatMap((fecha) => ordenarDia(porDia.get(fecha)));
};

const valoresDeOrden = (lista) => {
  let ultimaConHora = -1;
  lista.forEach((actividad, indice) => {
    if (claveDeHora(actividad) !== '') ultimaConHora = indice;
  });
  return new Map(
    lista.map((actividad, indice) => [
      actividad.id,
      claveDeHora(actividad) === '' && indice < ultimaConHora ? -(indice + 1) : indice,
    ]),
  );
};

const horasEnOrden = (lista) => {
  const horas = lista.map(claveDeHora).filter((clave) => clave !== '');
  return horas.every((clave, indice) => indice === 0 || horas[indice - 1] <= clave);
};

const siguienteOrden = (ultimoOrden) => Math.max(ultimoOrden, -1) + 1;

module.exports = { claveDeHora, ordenarDia, ordenarAgenda, valoresDeOrden, horasEnOrden, siguienteOrden };
