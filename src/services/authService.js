const { createClient } = require('@supabase/supabase-js');

const crearClienteAislado = () =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

const login = async (email, password) => {
  const cliente = crearClienteAislado();
  const { data, error } = await cliente.auth.signInWithPassword({ email, password });
  if (error) return { error };

  const { user, session } = data;
  const { data: perfil } = await cliente
    .from('profiles')
    .select('full_name, avatar_url, created_at')
    .eq('id', user.id)
    .maybeSingle();

  return {
    usuario: {
      id: user.id,
      nombre: perfil?.full_name ?? user.user_metadata?.full_name ?? null,
      email: user.email,
      avatar_url: perfil?.avatar_url ?? null,
      creado_en: perfil?.created_at ?? user.created_at,
    },
    token: session.access_token,
    refresh_token: session.refresh_token,
  };
};

const refrescar = async (refreshToken) => {
  const cliente = crearClienteAislado();
  const { data, error } = await cliente.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) return { error: error ?? { code: 'session_not_found' } };

  return {
    token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };
};

module.exports = { login, refrescar };
