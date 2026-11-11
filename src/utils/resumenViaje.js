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

const contarPor = (filas, campo) => {
  const recuento = new Map();
  for (const fila of filas) {
    if (fila[campo]) recuento.set(fila[campo], (recuento.get(fila[campo]) ?? 0) + 1);
  }
  return recuento;
};

const almaDelGrupo = (miembros, gastos, actividades, fotos) => {
  const pagos = contarPor(gastos, 'pagado_por');
  const pagado = new Map();
  for (const gasto of gastos) {
    pagado.set(gasto.pagado_por, (pagado.get(gasto.pagado_por) ?? 0) + aCentimos(gasto.importe));
  }

  const elegido = miembros
    .filter((miembro) => pagos.has(miembro.usuario_id))
    .reduce((mejor, miembro) => {
      if (mejor === null) return miembro;
      const dif = pagos.get(miembro.usuario_id) - pagos.get(mejor.usuario_id);
      const difImporte = pagado.get(miembro.usuario_id) - pagado.get(mejor.usuario_id);
      return dif > 0 || (dif === 0 && difImporte > 0) ? miembro : mejor;
    }, null);
  if (elegido === null) return null;

  return {
    usuario_id: elegido.usuario_id,
    nombre: elegido.nombre,
    pagos: pagos.get(elegido.usuario_id),
    planes_propuestos: contarPor(actividades, 'creado_por').get(elegido.usuario_id) ?? 0,
    fotos_subidas: contarPor(fotos, 'subido_por').get(elegido.usuario_id) ?? 0,
  };
};

module.exports = { contarDias, resumirGastos, actividadMasVotada, almaDelGrupo };
