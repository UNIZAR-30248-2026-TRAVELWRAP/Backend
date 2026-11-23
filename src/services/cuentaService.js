const { BUCKET: BUCKET_AVATARES } = require('./perfilService');

const TAMANO_LOTE = 100;
const BUCKETS_VIAJE = ['documentos', 'fotos', 'portadas'];

// Borra archivos de un bucket en lotes. Quitar uno que ya no existe no da error
const borrarArchivos = async (admin, bucket, rutas) => {
  for (let i = 0; i < rutas.length; i += TAMANO_LOTE) {
    const { error } = await admin.storage.from(bucket).remove(rutas.slice(i, i + TAMANO_LOTE));
    if (error) return { error };
  }
  return {};
};

// Borra las fotos de perfil del usuario (carpeta <usuario_id>/ del bucket avatares)
const borrarAvatares = async (admin, usuarioId) => {
  const almacen = admin.storage.from(BUCKET_AVATARES);
  const { data, error } = await almacen.list(usuarioId, { limit: 1000 });
  if (error) return { error };

  return borrarArchivos(admin, BUCKET_AVATARES, (data ?? []).map((archivo) => `${usuarioId}/${archivo.name}`));
};

// Elimina la cuenta del usuario con el cliente admin (service key):
//   1. Borra los archivos de los viajes en los que es el único miembro
//   2. Borra sus datos personales con eliminar_datos_cuenta: esos viajes, su perfil anonimizado, sus sellos...
//   3. Borra sus fotos de perfil
//   4. Elimina el usuario en Supabase Auth
// Si un paso falla se para y se puede repetir: cada paso se puede volver a ejecutar sin efectos duplicados.
// Devuelve { error } | { estado: ok }
const eliminarCuenta = async (admin, usuarioId) => {
  const solitarios = await admin.rpc('viajes_en_solitario', { p_usuario_id: usuarioId });
  if (solitarios.error) return { error: solitarios.error };

  for (const viaje of solitarios.data ?? []) {
    for (const bucket of BUCKETS_VIAJE) {
      const borrado = await borrarArchivos(admin, bucket, viaje[bucket] ?? []);
      if (borrado.error) return { error: borrado.error };
    }
  }

  const datos = await admin.rpc('eliminar_datos_cuenta', { p_usuario_id: usuarioId });
  if (datos.error) return { error: datos.error };
  // false si Storage no ha borrado algún archivo (una política puede impedirlo sin dar error)
  if (datos.data !== true) return { error: { code: 'sin_filas' } };

  const avatares = await borrarAvatares(admin, usuarioId);
  if (avatares.error) return { error: avatares.error };

  const { error } = await admin.auth.admin.deleteUser(usuarioId);
  if (error) return { error };
  return { estado: 'ok' };
};

module.exports = { eliminarCuenta };
