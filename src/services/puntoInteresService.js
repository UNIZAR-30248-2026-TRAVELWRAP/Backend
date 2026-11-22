const viajeService = require('./viajeService');

const CAMPOS_PUNTO =
  'id, viaje_id, nombre, nota, categoria, latitud, longitud, lugar_externo_id, creado_por, creado_en';

const viajeDelUsuario = async (cliente, usuarioId, viajeId) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };
  return { estado: 'ok', viaje: previo.viaje };
};

const viajeEditable = async (cliente, usuarioId, viajeId) => {
  const previo = await viajeDelUsuario(cliente, usuarioId, viajeId);
  if (previo.estado !== 'ok') return previo;
  if (previo.viaje.estado !== 'activo') return { estado: 'no_activo' };
  return { estado: 'ok' };
};

const listar = async (cliente, usuarioId, viajeId) => {
  const previo = await viajeDelUsuario(cliente, usuarioId, viajeId);
  if (previo.estado !== 'ok') return previo;

  const { data, error } = await cliente
    .from('puntos_interes')
    .select(CAMPOS_PUNTO)
    .eq('viaje_id', viajeId)
    .order('creado_en', { ascending: true });
  if (error) return { error };

  return { estado: 'ok', puntos_interes: data ?? [] };
};

const crear = async (cliente, usuarioId, viajeId, datos) => {
  const previo = await viajeEditable(cliente, usuarioId, viajeId);
  if (previo.estado !== 'ok') return previo;

  const { data, error } = await cliente
    .from('puntos_interes')
    .insert({
      viaje_id: viajeId,
      nombre: datos.nombre,
      nota: datos.nota,
      categoria: datos.categoria,
      latitud: datos.latitud,
      longitud: datos.longitud,
      lugar_externo_id: datos.lugar_externo_id,
      creado_por: usuarioId,
    })
    .select(CAMPOS_PUNTO)
    .single();
  if (error) return { error };

  return { estado: 'ok', punto: data };
};

const eliminar = async (cliente, usuarioId, viajeId, puntoId) => {
  const previo = await viajeEditable(cliente, usuarioId, viajeId);
  if (previo.estado !== 'ok') return previo;

  const existente = await cliente
    .from('puntos_interes')
    .select('id')
    .eq('id', puntoId)
    .eq('viaje_id', viajeId)
    .maybeSingle();
  if (existente.error) return { error: existente.error };
  if (!existente.data) return { estado: 'no_encontrado' };

  const { data, error } = await cliente
    .from('puntos_interes')
    .delete()
    .eq('id', puntoId)
    .eq('viaje_id', viajeId)
    .select('id');
  if (error) return { error };
  if (!data || data.length === 0) return { error: { code: 'sin_filas' } };

  return { estado: 'ok' };
};

module.exports = { listar, crear, eliminar };
