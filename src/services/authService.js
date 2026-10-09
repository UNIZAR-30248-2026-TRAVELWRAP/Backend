const { createClient } = require('@supabase/supabase-js');

const crearClienteAislado = () =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

const crearClienteOAuth = (almacen) =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: {
        getItem: (clave) => (clave in almacen ? almacen[clave] : null),
        setItem: (clave, valor) => {
          almacen[clave] = valor;
        },
        removeItem: (clave) => {
          delete almacen[clave];
        },
      },
    },
  });

const nombrePorDefecto = (user) =>
  user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email.split('@')[0];

const construirSesion = async (cliente, user, session, { crearPerfil = false } = {}) => {
  let { data: perfil } = await cliente
    .from('perfiles')
    .select('nombre, email, avatar_url, creado_en')
    .eq('id', user.id)
    .maybeSingle();

  if (!perfil && crearPerfil) {
    const { data: creado } = await cliente
      .from('perfiles')
      .insert({
        id: user.id,
        nombre: nombrePorDefecto(user),
        email: user.email,
        avatar_url: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
      })
      .select('nombre, email, avatar_url, creado_en')
      .maybeSingle();
    perfil = creado;
  }

  return {
    usuario: {
      id: user.id,
      nombre: perfil?.nombre ?? user.user_metadata?.full_name ?? null,
      email: perfil?.email ?? user.email,
      avatar_url: perfil?.avatar_url ?? null,
      creado_en: perfil?.creado_en ?? user.created_at,
    },
    token: session.access_token,
    refresh_token: session.refresh_token,
  };
};

const login = async (email, password) => {
  const cliente = crearClienteAislado();
  const { data, error } = await cliente.auth.signInWithPassword({ email, password });
  if (error) return { error };

  return construirSesion(cliente, data.user, data.session);
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

const iniciarGoogle = async (redirectTo) => {
  const almacen = {};
  const cliente = crearClienteOAuth(almacen);
  const { data, error } = await cliente.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) return { error: error ?? { code: 'oauth_url_missing' } };

  return { url: data.url, almacen };
};

const completarGoogle = async (codigo, almacen, flowId) => {
  const cliente = crearClienteOAuth({ ...almacen });
  const { data, error } = await cliente.auth.exchangeCodeForSession(
    codigo,
    flowId ? { flowId } : undefined,
  );
  if (error || !data?.session) return { error: error ?? { code: 'session_not_found' } };

  return construirSesion(cliente, data.user, data.session, { crearPerfil: true });
};

module.exports = { login, refrescar, iniciarGoogle, completarGoogle };
