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
      orden: ultima.data ? ultima.data.orden + 1 : 0,
      creado_por: usuarioId,
    })
    .select(CAMPOS_ACTIVIDAD)
    .single();
  if (error) return { error };

  return { estado: 'ok', actividad: data };
};

module.exports = { listar, crear };
