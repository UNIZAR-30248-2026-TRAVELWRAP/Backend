const MS_POR_DIA = 86400000;

const aCentimos = (importe) => Math.round(Number(importe) * 100);

const contarDias = (fechaInicio, fechaFin, fechasActividades = []) => {
  if (fechaInicio && fechaFin) {
    const dias = Math.round((Date.parse(`${fechaFin}T00:00:00Z`) - Date.parse(`${fechaInicio}T00:00:00Z`)) / MS_POR_DIA) + 1;
    return Math.max(dias, 0);
  }
  return new Set(fechasActividades).size;
};

const resumirGastos = (gastos) => {
  const total = gastos.reduce((suma, gasto) => suma + aCentimos(gasto.importe), 0) / 100;
  const mayor = gastos.reduce(
    (actual, gasto) => (actual === null || aCentimos(gasto.importe) > aCentimos(actual.importe) ? gasto : actual),
    null,
  );
  return {
    gasto_total: total,
    gasto_mayor: mayor === null ? null : { concepto: mayor.concepto, importe: Number(mayor.importe) },
  };
};

const actividadMasVotada = (opciones, votos) => {
  const recuento = new Map();
  for (const voto of votos) recuento.set(voto.opcion_id, (recuento.get(voto.opcion_id) ?? 0) + 1);

  const candidatas = opciones
    .map((opcion) => ({ titulo: opcion.texto, votos: recuento.get(opcion.id) ?? 0, orden: opcion.orden ?? 0 }))
    .filter((opcion) => opcion.votos > 0)
    .sort((a, b) => b.votos - a.votos || a.orden - b.orden || a.titulo.localeCompare(b.titulo));

  return candidatas.length === 0 ? null : { titulo: candidatas[0].titulo, votos: candidatas[0].votos };
};

module.exports = { contarDias, resumirGastos, actividadMasVotada };
