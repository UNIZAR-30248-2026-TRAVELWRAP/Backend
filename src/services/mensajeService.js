const viajeService = require('./viajeService');

const CAMPOS_MENSAJE = 'id, texto, creado_en, autor_id';
const TAMANO_PAGINA = 50;

// Da al mensaje el formato de la API: el autor sale con su nombre y avatar, sacados de los miembros del viaje.
// Si ya no es miembro (abandonó el viaje), sale sin nombre ni avatar
const formatear = (fila, miembros) => {
  const { autor_id: autorId, ...mensaje } = fila;
  const miembro = miembros.find((m) => m.usuario_id === autorId);
  return {
    ...mensaje,
    autor: {
      usuario_id: autorId,
      nombre: miembro?.nombre ?? null,
      avatar_url: miembro?.avatar_url ?? null,
    },
  };
};

// Mensajes del viaje de 50 en 50, en orden cronológico. Con antes (fecha ISO) devuelve los 50 anteriores a esa fecha.
// Los pueden leer los miembros, también en viajes finalizados
// Devuelve { error } | { estado: no_existe | ok (con mensajes) }
const listar = async (cliente, usuarioId, viajeId, antes) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };

  let consulta = cliente.from('mensajes').select(CAMPOS_MENSAJE).eq('viaje_id', viajeId);
  if (antes) consulta = consulta.lt('creado_en', antes);
  const { data, error } = await consulta.order('creado_en', { ascending: false }).limit(TAMANO_PAGINA);
  if (error) return { error };

  const mensajes = (data ?? []).map((fila) => formatear(fila, previo.viaje.miembros)).reverse();
  return { estado: 'ok', mensajes };
};

// Guarda un mensaje de quien usa la app en el viaje. Solo con el viaje activo
// Devuelve { error } | { estado: no_existe | no_activo | ok (con mensaje) }
const crear = async (cliente, usuarioId, viajeId, texto) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };
  if (previo.viaje.estado !== 'activo') return { estado: 'no_activo' };

  const { data, error } = await cliente
    .from('mensajes')
    .insert({ viaje_id: viajeId, autor_id: usuarioId, texto })
    .select(CAMPOS_MENSAJE)
    .single();
  if (error) return { error };

  return { estado: 'ok', mensaje: formatear(data, previo.viaje.miembros) };
};

module.exports = { listar, crear };
