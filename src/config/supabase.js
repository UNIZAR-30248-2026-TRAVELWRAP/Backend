const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY; // o SUPABASE_SERVICE_ROLE_KEY si hay que saltar las políticas de seguridad (RLS) en el backend

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltan las credenciales de Supabase en el archivo .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;