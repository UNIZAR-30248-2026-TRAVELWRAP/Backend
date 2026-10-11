// Recibe el cliente de Supabase del usuario (req.supabase) para que se apliquen las políticas RLS

const obtenerToken = async (cliente, viajeId) => {
  const { data, error } = await cliente
    .from('viajes')
    .select('token_invitacion')
    .eq('id', viajeId)
    .maybeSingle();
  if (error) return { error };

  // Sin fila: el viaje no existe o el usuario no es miembro (RLS no deja distinguirlo)
  return { token: data?.token_invitacion ?? null };
};

const unirse = async (cliente, token) => {
  const { data, error } = await cliente.rpc('unirse_con_invitacion', { p_token: token });
  if (error || !data) return { error: error ?? { code: 'respuesta_vacia' } };

  return data;
};

module.exports = { obtenerToken, unirse };
