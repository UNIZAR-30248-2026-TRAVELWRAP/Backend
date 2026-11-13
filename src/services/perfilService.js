const { randomUUID } = require('node:crypto');

// Bucket público de Supabase Storage con los avatares (scripts/02_politicas_rls.sql)
const BUCKET = 'avatares';

const CAMPOS_PERFIL = 'nombre, email, avatar_url, creado_en';

const EXTENSIONES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

// Misma forma que el usuario de la sesión, para que el frontend lo pueda guardar tal cual
const aUsuario = (usuarioId, perfil) => ({
  id: usuarioId,
  nombre: perfil.nombre,
  email: perfil.email ?? null,
  avatar_url: perfil.avatar_url ?? null,
  creado_en: perfil.creado_en,
});

// Ruta del archivo dentro del bucket a partir de su URL pública, o null si la foto no es de nuestro bucket
// (por ejemplo, la de Google): esas no se tocan
const rutaDeAvatar = (url) => {
  if (typeof url !== 'string') return null;
  const prefijo = `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
  if (!url.startsWith(prefijo)) return null;

  const ruta = url.slice(prefijo.length).split(/[?#]/)[0];
  try {
    return decodeURIComponent(ruta) || null;
  } catch {
    return null;
  }
};

// Borra la foto anterior si era nuestra. Si falla se ignora: el cambio del perfil ya está hecho
const borrarAvatarAnterior = async (almacen, urlAnterior) => {
  const ruta = rutaDeAvatar(urlAnterior);
  if (!ruta) return;
  await almacen.remove([ruta]).catch(() => {});
};

// Cambia el nombre del perfil del usuario
// Devuelve { error } | { estado: no_existe | ok (con usuario) }
const actualizarNombre = async (cliente, usuarioId, nombre) => {
  const { data, error } = await cliente
    .from('perfiles')
    .update({ nombre })
    .eq('id', usuarioId)
    .select(CAMPOS_PERFIL)
    .maybeSingle();
  if (error) return { error };
  if (!data) return { estado: 'no_existe' };

  return { estado: 'ok', usuario: aUsuario(usuarioId, data) };
};

// avatar_url actual del perfil
// Devuelve { error } | { estado: no_existe | ok (con url) }
const leerAvatar = async (cliente, usuarioId) => {
  const { data, error } = await cliente
    .from('perfiles')
    .select('avatar_url')
    .eq('id', usuarioId)
    .maybeSingle();
  if (error) return { error };
  if (!data) return { estado: 'no_existe' };
  return { estado: 'ok', url: data.avatar_url };
};

// Sube la foto con un nombre nuevo (así la URL cambia y no queda la anterior en cachés), guarda su URL en el perfil
// y borra la foto anterior. Si falla el guardado, borra la foto nueva y el perfil queda como estaba
// Devuelve { error } | { estado: no_existe | ok (con usuario) }
const cambiarAvatar = async (cliente, usuarioId, { buffer, tipoMime }) => {
  const actual = await leerAvatar(cliente, usuarioId);
  if (actual.error) return { error: actual.error };
  if (actual.estado !== 'ok') return { estado: actual.estado };

  const ruta = `${usuarioId}/${randomUUID()}.${EXTENSIONES[tipoMime]}`;
  const almacen = cliente.storage.from(BUCKET);
  const subida = await almacen.upload(ruta, buffer, { contentType: tipoMime, upsert: false });
  if (subida.error) return { error: subida.error };

  const { data: publica } = almacen.getPublicUrl(ruta);
  const { data, error } = await cliente
    .from('perfiles')
    .update({ avatar_url: publica.publicUrl })
    .eq('id', usuarioId)
    .select(CAMPOS_PERFIL)
    .maybeSingle();
  if (error || !data) {
    await almacen.remove([ruta]).catch(() => {});
    return error ? { error } : { estado: 'no_existe' };
  }

  await borrarAvatarAnterior(almacen, actual.url);
  return { estado: 'ok', usuario: aUsuario(usuarioId, data) };
};

// Deja el perfil sin foto (avatar_url = null) y borra la anterior si era nuestra
// Devuelve { error } | { estado: no_existe | ok (con usuario) }
const quitarAvatar = async (cliente, usuarioId) => {
  const actual = await leerAvatar(cliente, usuarioId);
  if (actual.error) return { error: actual.error };
  if (actual.estado !== 'ok') return { estado: actual.estado };

  const { data, error } = await cliente
    .from('perfiles')
    .update({ avatar_url: null })
    .eq('id', usuarioId)
    .select(CAMPOS_PERFIL)
    .maybeSingle();
  if (error) return { error };
  if (!data) return { estado: 'no_existe' };

  await borrarAvatarAnterior(cliente.storage.from(BUCKET), actual.url);
  return { estado: 'ok', usuario: aUsuario(usuarioId, data) };
};

module.exports = { actualizarNombre, cambiarAvatar, quitarAvatar, rutaDeAvatar, BUCKET };
