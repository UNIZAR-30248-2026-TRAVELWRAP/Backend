// Recibe el cliente de Supabase del usuario (req.supabase) para que se apliquen las políticas RLS

const SELECCION =
  'id, nombre, destino, descripcion, fecha_inicio, fecha_fin, moneda, presupuesto, estado, creado_en, ' +
  'miembros_viaje(usuario_id, rol, abandonado_en, perfiles(nombre, avatar_url))';

// Un viaje está pendiente de destino cuando está activo y todavía no lo tiene
const conPendiente = (viaje) => ({
  ...viaje,
  pendiente_destino: viaje.estado === 'activo' && viaje.destino === null,
});

// Da al viaje el formato de la API. Devuelve null si el usuario no es miembro activo
const formatear = (fila, usuarioId) => {
  const { miembros_viaje: filas, ...viaje } = fila;
  const miembros = (filas ?? []).filter((m) => m.abandonado_en === null);
  const yo = miembros.find((m) => m.usuario_id === usuarioId);
  if (!yo) return null;

  return {
    ...conPendiente(viaje),
    rol: yo.rol,
    miembros: miembros.map((m) => ({
      usuario_id: m.usuario_id,
      nombre: m.perfiles?.nombre ?? null,
      avatar_url: m.perfiles?.avatar_url ?? null,
      rol: m.rol,
    })),
  };
};

const listar = async (cliente, usuarioId, estado) => {
  let consulta = cliente.from('viajes').select(SELECCION).order('creado_en', { ascending: false });
  if (estado) consulta = consulta.eq('estado', estado);

  const { data, error } = await consulta;
  if (error) return { error };

  return { viajes: (data ?? []).map((fila) => formatear(fila, usuarioId)).filter(Boolean) };
};

const obtener = async (cliente, usuarioId, viajeId) => {
  const { data, error } = await cliente.from('viajes').select(SELECCION).eq('id', viajeId).maybeSingle();
  if (error) return { error };

  // Sin fila: el viaje no existe o el usuario no es miembro (RLS no deja distinguirlo)
  return { viaje: data ? formatear(data, usuarioId) : null };
};

const crear = async (cliente, datos) => {
  const { data, error } = await cliente.rpc('crear_viaje', {
    p_nombre: datos.nombre,
    p_destino: datos.destino,
    p_fecha_inicio: datos.fechaInicio,
    p_fecha_fin: datos.fechaFin,
    p_presupuesto: datos.presupuesto,
  });
  if (error || !data) return { error: error ?? { code: 'respuesta_vacia' } };

  return data.estado === 'ok' ? { estado: 'ok', viaje: conPendiente(data.viaje) } : { estado: data.estado };
};

module.exports = { listar, obtener, crear };
