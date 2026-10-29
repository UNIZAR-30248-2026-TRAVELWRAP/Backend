const viajeService = require('./viajeService');

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

// Suma de los importes, en céntimos para no arrastrar errores de coma flotante (0,1 + 0,2 = 0,3)
const sumar = (gastos) => gastos.reduce((total, gasto) => total + Math.round(gasto.importe * 100), 0) / 100;

// Historial de gastos del viaje, del más reciente al más antiguo, con el total gastado.
// También se puede consultar en viajes archivados o finalizados: solo lee
// Devuelve { error } | { estado: no_existe | ok (con gastos y total) }
const listar = async (cliente, usuarioId, viajeId) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };

  const { data, error } = await cliente
    .from('gastos')
    .select(CAMPOS_GASTO)
    .eq('viaje_id', viajeId)
    .order('fecha', { ascending: false })
    .order('creado_en', { ascending: false });
  if (error) return { error };

  const gastos = (data ?? []).map(formatear);
  return { estado: 'ok', gastos, total: sumar(gastos) };
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

module.exports = { obtener, listar, crear };
