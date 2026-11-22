const viajeService = require('./viajeService');
const fotoEscaneoService = require('./fotoEscaneoService');

const CAMPOS_GASTO =
  'id, viaje_id, concepto, importe, categoria, pagado_por, fecha, creado_por, creado_en, actualizado_en, foto_ruta, ' +
  'repartos:repartos_gasto (usuario_id, importe)';

// Postgres devuelve los numeric como texto para no perder precisión; en la API van como número.
// La ruta de la foto no sale de la API: se indica solo si el gasto tiene foto (la imagen se pide aparte)
const formatear = (gasto) => {
  const { foto_ruta, ...resto } = gasto;
  return {
    ...resto,
    tiene_foto: foto_ruta !== null && foto_ruta !== undefined,
    importe: Number(gasto.importe),
    repartos: (gasto.repartos ?? []).map((r) => ({ usuario_id: r.usuario_id, importe: Number(r.importe) })),
  };
};

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
// También se puede consultar en viajes finalizados: solo lee
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

const aCentimos = (importe) => Math.round(Number(importe) * 100);

// Saldo de cada miembro: lo que ha pagado menos su parte de los gastos. Positivo, le deben y negativo, debe.
// Se calcula en céntimos a partir de los gastos y sus repartos, así que siempre está al día y la suma de todos
// los saldos es 0. Salen primero los miembros actuales, en el orden del viaje, y después quien ya lo ha abandonado
// pero sigue teniendo gastos (sin nombre, porque ya no aparece entre los miembros)
// Devuelve { error } | { estado: no_existe | ok (con saldos) }
const balance = async (cliente, usuarioId, viajeId) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };

  const { data, error } = await cliente
    .from('gastos')
    .select('importe, pagado_por, repartos:repartos_gasto (usuario_id, importe)')
    .eq('viaje_id', viajeId);
  if (error) return { error };

  const cuentas = new Map(previo.viaje.miembros.map((m) => [m.usuario_id, { nombre: m.nombre, pagado: 0, parte: 0 }]));
  const cuentaDe = (id) => {
    if (!cuentas.has(id)) cuentas.set(id, { nombre: null, pagado: 0, parte: 0 });
    return cuentas.get(id);
  };
  for (const gasto of data ?? []) {
    cuentaDe(gasto.pagado_por).pagado += aCentimos(gasto.importe);
    for (const reparto of gasto.repartos ?? []) cuentaDe(reparto.usuario_id).parte += aCentimos(reparto.importe);
  }

  // Deudas saldadas: cuentan como un pago de quien debe y como una parte de quien recibe, así que el saldo se
  // recalcula sin que haya un gasto de por medio
  const { data: saldadas, error: errorSaldadas } = await cliente
    .from('deudas_saldadas')
    .select('de_usuario_id, a_usuario_id, importe')
    .eq('viaje_id', viajeId);
  if (errorSaldadas) return { error: errorSaldadas };
  for (const deuda of saldadas ?? []) {
    cuentaDe(deuda.de_usuario_id).pagado += aCentimos(deuda.importe);
    cuentaDe(deuda.a_usuario_id).parte += aCentimos(deuda.importe);
  }

  const saldos = [...cuentas].map(([id, { nombre, pagado, parte }]) => ({
    usuario_id: id,
    nombre,
    pagado: pagado / 100,
    parte: parte / 100,
    saldo: (pagado - parte) / 100,
  }));
  return {
    estado: 'ok',
    saldos,
    saldadas: (saldadas ?? []).map((deuda) => ({
      de: deuda.de_usuario_id,
      a: deuda.a_usuario_id,
      importe: Number(deuda.importe),
    })),
  };
};

// Transferencias para dejar todos los saldos a 0, en céntimos. Primero se emparejan los saldos iguales de signo
// contrario (una sola transferencia salda a los dos) y después se va emparejando la mayor deuda con el mayor saldo
// a favor: en cada paso queda saldado al menos uno de los dos, así que salen como mucho n - 1 transferencias.
// A igualdad de importe se respeta el orden del balance, para que el resultado sea siempre el mismo
const planDeTransferencias = (saldos) => {
  const pendientes = saldos
    .map(({ usuario_id, nombre, saldo }, orden) => ({ usuario_id, nombre, centimos: aCentimos(saldo), orden }))
    .filter((p) => p.centimos !== 0);
  const transferencias = [];
  const transferir = (deudor, acreedor, centimos) => {
    transferencias.push({
      de: deudor.usuario_id,
      de_nombre: deudor.nombre,
      a: acreedor.usuario_id,
      a_nombre: acreedor.nombre,
      importe: centimos / 100,
    });
    deudor.centimos += centimos;
    acreedor.centimos -= centimos;
  };

  const deudores = pendientes.filter((p) => p.centimos < 0);
  const acreedores = pendientes.filter((p) => p.centimos > 0);
  for (const deudor of deudores) {
    const igual = acreedores.find((a) => a.centimos === -deudor.centimos);
    if (igual) transferir(deudor, igual, igual.centimos);
  }

  const porImporte = (a, b) => Math.abs(b.centimos) - Math.abs(a.centimos) || a.orden - b.orden;
  for (;;) {
    const deudor = deudores.filter((d) => d.centimos < 0).sort(porImporte)[0];
    const acreedor = acreedores.filter((a) => a.centimos > 0).sort(porImporte)[0];
    if (!deudor || !acreedor) break;
    transferir(deudor, acreedor, Math.min(-deudor.centimos, acreedor.centimos));
  }
  return transferencias;
};

// Plan mínimo de transferencias para saldar las cuentas del viaje, a partir del balance
// Devuelve { error } | { estado: no_existe | ok (con transferencias) }
// Además, lista las deudas marcadas como saldadas (con el importe marcado), para poder deshacer la marca
const liquidacion = async (cliente, usuarioId, viajeId) => {
  const resultado = await balance(cliente, usuarioId, viajeId);
  if (resultado.error || resultado.estado !== 'ok') return resultado;

  const nombres = new Map(resultado.saldos.map((s) => [s.usuario_id, s.nombre]));
  const saldadas = resultado.saldadas.map((deuda) => ({
    de: deuda.de,
    de_nombre: nombres.get(deuda.de) ?? null,
    a: deuda.a,
    a_nombre: nombres.get(deuda.a) ?? null,
    importe: deuda.importe,
  }));
  return { estado: 'ok', transferencias: planDeTransferencias(resultado.saldos), saldadas };
};

// Detalle de un gasto del viaje: cada reparto con el nombre de su miembro. Quien ya abandonó el viaje sale sin
// nombre y con abandonado: true
// Devuelve { error } | { estado: no_existe | no_encontrado | ok (con gasto) }
const detalle = async (cliente, usuarioId, viajeId, gastoId) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };

  const encontrado = await obtener(cliente, viajeId, gastoId);
  if (encontrado.error) return { error: encontrado.error };
  if (encontrado.estado !== 'ok') return { estado: 'no_encontrado' };

  const nombres = new Map(previo.viaje.miembros.map((m) => [m.usuario_id, m.nombre]));
  const repartos = encontrado.gasto.repartos.map((reparto) => ({
    usuario_id: reparto.usuario_id,
    nombre: nombres.get(reparto.usuario_id) ?? null,
    abandonado: !nombres.has(reparto.usuario_id),
    importe: reparto.importe,
  }));
  return { estado: 'ok', gasto: { ...encontrado.gasto, repartos } };
};

// Corrige un gasto y reparte de nuevo sus partes (función editar_gasto). Igual que crear, después lee el gasto
// Devuelve { error } | { estado: no_existe | no_activo | no_encontrado | sin_permiso | no_miembro | ok (con gasto) }
const editar = async (cliente, viajeId, gastoId, datos) => {
  const { data, error } = await cliente.rpc('editar_gasto', {
    p_gasto_id: gastoId,
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

  const editado = await obtener(cliente, viajeId, gastoId);
  if (!editado.error && editado.estado !== 'ok') return { error: { code: 'sin_filas' } };
  return editado;
};

// Borra el gasto y, en cascada, sus repartos. Quien no puede borrarlo (no lo registró ni es el creador) no
// ve el gasto para la política de borrado, así que la respuesta es la misma que si no existiera
// Devuelve { error } | { estado: no_existe | no_activo | no_encontrado | ok }
const eliminar = async (cliente, usuarioId, viajeId, gastoId) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };
  if (previo.viaje.estado !== 'activo') return { estado: 'no_activo' };

  const { data, error } = await cliente
    .from('gastos')
    .delete()
    .eq('id', gastoId)
    .eq('viaje_id', viajeId)
    .select('id');
  if (error) return { error };
  if (!data || data.length === 0) return { estado: 'no_encontrado' };
  return { estado: 'ok' };
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

  // La foto del ticket se enlaza después de crear el gasto (la comprobación de su ruta la hace el controlador)
  if (datos.foto_ruta) {
    const { error: errorFoto } = await cliente.from('gastos').update({ foto_ruta: datos.foto_ruta }).eq('id', data.gasto_id);
    if (errorFoto) return { error: errorFoto };
  }

  const creado = await obtener(cliente, viajeId, data.gasto_id);
  if (!creado.error && creado.estado !== 'ok') return { error: { code: 'sin_filas' } };
  return creado;
};

// Comprueba que el viaje existe, que el usuario es miembro y que está activo (solo entonces se pueden saldar deudas)
// Devuelve { error } | { estado: no_existe | no_activo | ok }
const comprobarViajeActivo = async (cliente, usuarioId, viajeId) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };
  if (previo.viaje.estado !== 'activo') return { estado: 'no_activo' };
  return { estado: 'ok' };
};

// Marca como saldada la transferencia de deudorId a quien usa la app, por el importe que todavía debe. Solo lo puede
// hacer quien recibe el dinero. Si ya había una deuda saldada de ese deudor, se suma. Como el importe tiene que ser
// el que se debe ahora, una liquidación desactualizada responde no_coincide y no se marca nada.
// Devuelve { error } | { estado: no_existe | no_activo | no_coincide | ok }
const marcarSaldada = async (cliente, usuarioId, viajeId, deudorId, importe) => {
  const activo = await comprobarViajeActivo(cliente, usuarioId, viajeId);
  if (activo.estado !== 'ok') return activo;

  const resultado = await balance(cliente, usuarioId, viajeId);
  if (resultado.error || resultado.estado !== 'ok') return resultado;

  const transferencia = planDeTransferencias(resultado.saldos).find((t) => t.de === deudorId && t.a === usuarioId);
  if (!transferencia || aCentimos(transferencia.importe) !== aCentimos(importe)) return { estado: 'no_coincide' };

  const filtro = (consulta) =>
    consulta.eq('viaje_id', viajeId).eq('de_usuario_id', deudorId).eq('a_usuario_id', usuarioId);
  const { data: existente, error: errorLectura } = await filtro(
    cliente.from('deudas_saldadas').select('importe'),
  ).maybeSingle();
  if (errorLectura) return { error: errorLectura };

  const error = existente
    ? (await filtro(cliente.from('deudas_saldadas').update({ importe: (aCentimos(existente.importe) + aCentimos(importe)) / 100 }))).error
    : (await cliente.from('deudas_saldadas').insert({
        viaje_id: viajeId,
        de_usuario_id: deudorId,
        a_usuario_id: usuarioId,
        importe,
      })).error;
  return error ? { error } : { estado: 'ok' };
};

// Deshace la marca de saldado de deudorId. Solo quien la marcó (quien recibe el dinero) puede deshacerla
// Devuelve { error } | { estado: no_existe | no_activo | sin_deuda | ok }
const desmarcarSaldada = async (cliente, usuarioId, viajeId, deudorId) => {
  const activo = await comprobarViajeActivo(cliente, usuarioId, viajeId);
  if (activo.estado !== 'ok') return activo;

  const { data, error } = await cliente
    .from('deudas_saldadas')
    .delete()
    .eq('viaje_id', viajeId)
    .eq('de_usuario_id', deudorId)
    .eq('a_usuario_id', usuarioId)
    .select('viaje_id');
  if (error) return { error };
  return data && data.length > 0 ? { estado: 'ok' } : { estado: 'sin_deuda' };
};

// Enlace temporal para ver la foto del ticket de un gasto. Sirve también en viajes finalizados
// Devuelve { error } | { estado: no_existe | no_encontrado | sin_foto | ok (con url y expira_en) }
const obtenerFoto = async (cliente, usuarioId, viajeId, gastoId) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };

  const { data, error } = await cliente
    .from('gastos')
    .select('foto_ruta')
    .eq('id', gastoId)
    .eq('viaje_id', viajeId)
    .maybeSingle();
  if (error) return { error };
  if (!data) return { estado: 'no_encontrado' };
  if (!data.foto_ruta) return { estado: 'sin_foto' };

  const enlace = await fotoEscaneoService.urlFirmada(cliente, data.foto_ruta);
  if (enlace.error) return { error: enlace.error };
  return { estado: 'ok', url: enlace.url, expira_en: enlace.expira_en };
};

module.exports = {
  obtener,
  obtenerFoto,
  listar,
  balance,
  planDeTransferencias,
  liquidacion,
  detalle,
  crear,
  editar,
  eliminar,
  marcarSaldada,
  desmarcarSaldada,
};
