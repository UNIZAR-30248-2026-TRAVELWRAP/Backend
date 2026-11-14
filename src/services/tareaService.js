const viajeService = require('./viajeService');

const CAMPOS_TAREA = 'id, texto, hecha, hecha_en, creado_en, responsable_id';

// Da a la tarea el formato de la API: el responsable sale con su nombre y avatar, que se sacan de los miembros
// del viaje. Si el responsable ya no es miembro (abandonó el viaje), se devuelve sin nombre ni avatar
const formatear = (fila, miembros) => {
  const { responsable_id: responsableId, ...tarea } = fila;
  const miembro = miembros.find((m) => m.usuario_id === responsableId);
  return {
    ...tarea,
    responsable: {
      usuario_id: responsableId,
      nombre: miembro?.nombre ?? null,
      avatar_url: miembro?.avatar_url ?? null,
    },
  };
};

const esMiembro = (viaje, usuarioId) => viaje.miembros.some((m) => m.usuario_id === usuarioId);

// Tareas del viaje, de la más antigua a la más reciente. También se pueden consultar en viajes finalizados
// Devuelve { error } | { estado: no_existe | ok (con tareas) }
const listar = async (cliente, usuarioId, viajeId) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };

  const { data, error } = await cliente
    .from('tareas')
    .select(CAMPOS_TAREA)
    .eq('viaje_id', viajeId)
    .order('creado_en', { ascending: true });
  if (error) return { error };

  return { estado: 'ok', tareas: (data ?? []).map((fila) => formatear(fila, previo.viaje.miembros)) };
};

// Devuelve { error } | { estado: no_existe | no_activo | responsable_no_miembro | ok (con tarea) }
const crear = async (cliente, usuarioId, viajeId, { texto, responsableId }) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };
  if (previo.viaje.estado !== 'activo') return { estado: 'no_activo' };
  if (!esMiembro(previo.viaje, responsableId)) return { estado: 'responsable_no_miembro' };

  const { data, error } = await cliente
    .from('tareas')
    .insert({ viaje_id: viajeId, texto, responsable_id: responsableId, creada_por: usuarioId })
    .select(CAMPOS_TAREA)
    .single();
  if (error) return { error };

  return { estado: 'ok', tarea: formatear(data, previo.viaje.miembros) };
};

// Cambia solo los campos recibidos (texto, responsableId y hecha). Al marcar o desmarcar se actualiza también
// hecha_en, que la tabla exige coherente con hecha
// Devuelve { error } | { estado: no_existe | no_activo | responsable_no_miembro | tarea_no_existe | ok (con tarea) }
const editar = async (cliente, usuarioId, viajeId, tareaId, { texto, responsableId, hecha }) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };
  if (previo.viaje.estado !== 'activo') return { estado: 'no_activo' };
  if (responsableId !== undefined && !esMiembro(previo.viaje, responsableId)) {
    return { estado: 'responsable_no_miembro' };
  }

  const cambios = {};
  if (texto !== undefined) cambios.texto = texto;
  if (responsableId !== undefined) cambios.responsable_id = responsableId;
  if (hecha !== undefined) {
    cambios.hecha = hecha;
    cambios.hecha_en = hecha ? new Date().toISOString() : null;
  }

  // La tarea tiene que ser de este viaje: con otro id de viaje no se encuentra
  const { data, error } = await cliente
    .from('tareas')
    .update(cambios)
    .eq('id', tareaId)
    .eq('viaje_id', viajeId)
    .select(CAMPOS_TAREA);
  if (error) return { error };
  if (!data?.length) return { estado: 'tarea_no_existe' };

  return { estado: 'ok', tarea: formatear(data[0], previo.viaje.miembros) };
};

// Devuelve { error } | { estado: no_existe | no_activo | tarea_no_existe | ok }
const borrar = async (cliente, usuarioId, viajeId, tareaId) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };
  if (previo.viaje.estado !== 'activo') return { estado: 'no_activo' };

  const { data, error } = await cliente
    .from('tareas')
    .delete()
    .eq('id', tareaId)
    .eq('viaje_id', viajeId)
    .select('id');
  if (error) return { error };
  if (!data?.length) return { estado: 'tarea_no_existe' };

  return { estado: 'ok' };
};

module.exports = { listar, crear, editar, borrar };
