const { createClient } = require('@supabase/supabase-js');

// Cliente con la service key, que se salta las políticas RLS. Es la única excepción a la regla de actuar siempre con
// el token del usuario y solo se usa para eliminar una cuenta (PB-47): borrar un usuario de Supabase Auth no se puede
// hacer con su propio token. Quien lo llama ha comprobado antes la sesión y pasa siempre el id de esa sesión.
// Devuelve null si falta SUPABASE_SERVICE_ROLE_KEY
const crearClienteAdmin = () => {
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) return null;

  return createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
};

module.exports = { crearClienteAdmin };
