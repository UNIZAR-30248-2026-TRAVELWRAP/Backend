const viajeService = require('./viajeService');

const CAMPOS_ACTIVIDAD =
  'id, viaje_id, titulo, descripcion, fecha, hora_inicio, hora_fin, orden, ubicacion_nombre, latitud, longitud, ' +
  'lugar_externo_id, categoria, creado_por, creado_en, actualizado_en';

const listar = async (cliente, usuarioId, viajeId, fecha) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };

  let consulta = cliente.from('actividades').select(CAMPOS_ACTIVIDAD).eq('viaje_id', viajeId);
  if (fecha) consulta = consulta.eq('fecha', fecha);

  const { data, error } = await consulta
    .order('fecha', { ascending: true })
    .order('hora_inicio', { ascending: true, nullsFirst: false })
    .order('orden', { ascending: true })
    .order('creado_en', { ascending: true });
  if (error) return { error };

  return { estado: 'ok', actividades: data ?? [] };
};

const crear = async (cliente, usuarioId, viajeId, datos) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };
  if (previo.viaje.estado !== 'activo') return { estado: 'no_activo' };

  const ultima = await cliente
    .from('actividades')
    .select('orden')
    .eq('viaje_id', viajeId)
    .eq('fecha', datos.fecha)
    .order('orden', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ultima.error) return { error: ultima.error };

  const { data, error } = await cliente
    .from('actividades')
    .insert({
      viaje_id: viajeId,
      titulo: datos.titulo,
      fecha: datos.fecha,
      hora_inicio: datos.hora_inicio,
      hora_fin: datos.hora_fin,
      ubicacion_nombre: datos.ubicacion_nombre,
      categoria: datos.categoria,
      latitud: datos.latitud,
      longitud: datos.longitud,
      lugar_externo_id: datos.lugar_externo_id,
      orden: ultima.data ? ultima.data.orden + 1 : 0,
      creado_por: usuarioId,
    })
    .select(CAMPOS_ACTIVIDAD)
    .single();
  if (error) return { error };

  return { estado: 'ok', actividad: data };
};

const ultimoOrdenDelDia = async (cliente, viajeId, fecha) => {
  const ultima = await cliente
    .from('actividades')
    .select('orden')
    .eq('viaje_id', viajeId)
    .eq('fecha', fecha)
    .order('orden', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ultima.error) return { error: ultima.error };
  return { orden: ultima.data ? ultima.data.orden : -1 };
};

const actividadDelViaje = async (cliente, viajeId, actividadId) => {
  const { data, error } = await cliente
    .from('actividades')
    .select(CAMPOS_ACTIVIDAD)
    .eq('id', actividadId)
    .eq('viaje_id', viajeId)
    .maybeSingle();
  if (error) return { error };
  if (!data) return { estado: 'no_encontrada' };
  return { estado: 'ok', actividad: data };
};

const viajeEditable = async (cliente, usuarioId, viajeId) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };
  if (previo.viaje.estado !== 'activo') return { estado: 'no_activo' };
  return { estado: 'ok' };
};

const horaCorta = (hora) => (hora === null ? null : hora.slice(0, 5));

const editar = async (cliente, usuarioId, viajeId, actividadId, cambios) => {
  const viaje = await viajeEditable(cliente, usuarioId, viajeId);
  if (viaje.error || viaje.estado !== 'ok') return viaje;

  const actual = await actividadDelViaje(cliente, viajeId, actividadId);
  if (actual.error || actual.estado !== 'ok') return actual;

  const horaInicio = 'hora_inicio' in cambios ? cambios.hora_inicio : horaCorta(actual.actividad.hora_inicio);
  const horaFin = 'hora_fin' in cambios ? cambios.hora_fin : horaCorta(actual.actividad.hora_fin);
  if (horaFin !== null && horaInicio === null) return { estado: 'hora_fin_sin_inicio' };
  if (horaFin !== null && horaFin < horaInicio) return { estado: 'horas_invertidas' };

  const cambiosAplicados = { ...cambios };
  if (cambios.fecha !== undefined && cambios.fecha !== actual.actividad.fecha) {
    const ultima = await ultimoOrdenDelDia(cliente, viajeId, cambios.fecha);
    if (ultima.error) return { error: ultima.error };
    cambiosAplicados.orden = ultima.orden + 1;
  }

  const { data, error } = await cliente
    .from('actividades')
    .update(cambiosAplicados)
    .eq('id', actividadId)
    .eq('viaje_id', viajeId)
    .select(CAMPOS_ACTIVIDAD);
  if (error) return { error };
  if (!data || data.length === 0) return { error: { code: 'sin_filas' } };

  return { estado: 'ok', actividad: data[0] };
};

const eliminar = async (cliente, usuarioId, viajeId, actividadId) => {
  const viaje = await viajeEditable(cliente, usuarioId, viajeId);
  if (viaje.error || viaje.estado !== 'ok') return viaje;

  const actual = await actividadDelViaje(cliente, viajeId, actividadId);
  if (actual.error || actual.estado !== 'ok') return actual;

  const { data, error } = await cliente
    .from('actividades')
    .delete()
    .eq('id', actividadId)
    .eq('viaje_id', viajeId)
    .select('id');
  if (error) return { error };
  if (!data || data.length === 0) return { error: { code: 'sin_filas' } };

  return { estado: 'ok' };
};

module.exports = { listar, crear, editar, eliminar };
