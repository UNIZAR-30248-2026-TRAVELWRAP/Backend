const CAMPOS_GASTO =
  'id, viaje_id, concepto, importe, categoria, pagado_por, fecha, creado_por, creado_en, actualizado_en, ' +
  'repartos:repartos_gasto (usuario_id, importe)';

// Postgres devuelve los numeric como texto para no perder precisión; en la API van como número
const formatear = (gasto) => ({
  ...gasto,
  importe: Number(gasto.importe),
  repartos: (gasto.repartos ?? []).map((r) => ({ usuario_id: r.usuario_id, importe: Number(r.importe) })),
});

// Gasto del viaje con la parte de cada participante
// Devuelve { error } | { estado: no_encontrado | ok (con gasto) }
const obtener = async (cliente, viajeId, gastoId) => {
  const { data, error } = await cliente
    .from('gastos')
    .select(CAMPOS_GASTO)
    .eq('id', gastoId)
    .eq('viaje_id', viajeId)
    .maybeSingle();
  if (error) return { error };
  if (!data) return { estado: 'no_encontrado' };
  return { estado: 'ok', gasto: formatear(data) };
};

// Registra el gasto y su reparto a partes iguales en una sola operación (función crear_gasto)
// Devuelve { error } | { estado: no_existe | no_activo | no_miembro | ok (con gasto) }
const crear = async (cliente, viajeId, datos) => {
  const { data, error } = await cliente.rpc('crear_gasto', {
    p_viaje_id: viajeId,
    p_concepto: datos.concepto,
    p_importe: datos.importe,
    p_categoria: datos.categoria,
    p_pagado_por: datos.pagado_por,
    p_fecha: datos.fecha,
    p_participantes: datos.participantes,
  });
  if (error || !data) return { error: error ?? { code: 'respuesta_vacia' } };
  if (data.estado !== 'ok') return { estado: data.estado };

  const creado = await obtener(cliente, viajeId, data.gasto_id);
  if (!creado.error && creado.estado !== 'ok') return { error: { code: 'sin_filas' } };
  return creado;
};

module.exports = { obtener, crear };
