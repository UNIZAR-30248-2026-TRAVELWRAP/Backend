const { createClient } = require('@supabase/supabase-js');

const responderError = (res, estado, codigo, mensaje) =>
  res.status(estado).json({ error: { codigo, mensaje } });

// Cliente que actúa como el usuario del token, para que se le apliquen las políticas RLS
const crearClienteDeUsuario = (token) =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

const requiereSesion = async (req, res, next) => {
  const [esquema, token] = (req.headers.authorization ?? '').split(' ');

  if (esquema !== 'Bearer' || !token) {
    return responderError(res, 401, 'sin_sesion', 'Falta el token de acceso');
  }

  try {
    const cliente = crearClienteDeUsuario(token);
    const { data, error } = await cliente.auth.getUser(token);

    if (error || !data?.user) {
      if (error && (!error.status || error.status >= 500)) {
        return responderError(res, 502, 'error_autenticacion', 'No se ha podido comprobar la sesión');
      }
      return responderError(res, 401, 'sesion_invalida', 'La sesión ha caducado o no es válida');
    }

    req.usuario = data.user;
    req.supabase = cliente;
    return next();
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

module.exports = { requiereSesion };
