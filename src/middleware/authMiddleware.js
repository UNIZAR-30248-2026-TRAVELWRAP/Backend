const { createClient } = require('@supabase/supabase-js');

const responderError = (res, estado, codigo, mensaje) =>
  res.status(estado).json({ error: { codigo, mensaje } });

// Cliente que actúa como el usuario del token, para que se le apliquen las políticas RLS
const crearClienteDeUsuario = (token) =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

// Comprueba el token de acceso con Supabase. La usan la API REST y los WebSockets.
// Devuelve { usuario, cliente } o { error: [estado HTTP, código, mensaje] }
const comprobarToken = async (token) => {
  if (!token) return { error: [401, 'sin_sesion', 'Falta el token de acceso'] };

  const cliente = crearClienteDeUsuario(token);
  const { data, error } = await cliente.auth.getUser(token);

  if (error || !data?.user) {
    if (error && (!error.status || error.status >= 500)) {
      return { error: [502, 'error_autenticacion', 'No se ha podido comprobar la sesión'] };
    }
    return { error: [401, 'sesion_invalida', 'La sesión ha caducado o no es válida'] };
  }
  return { usuario: data.user, cliente };
};

const requiereSesion = async (req, res, next) => {
  const [esquema, token] = (req.headers.authorization ?? '').split(' ');

  if (esquema !== 'Bearer' || !token) {
    return responderError(res, 401, 'sin_sesion', 'Falta el token de acceso');
  }

  try {
    const resultado = await comprobarToken(token);
    if (resultado.error) return responderError(res, ...resultado.error);

    req.usuario = resultado.usuario;
    req.supabase = resultado.cliente;
    return next();
  } catch {
    return responderError(res, 500, 'error_interno', 'Error interno del servidor');
  }
};

module.exports = { requiereSesion, comprobarToken };
