const { randomUUID } = require('node:crypto');
const viajeService = require('./viajeService');

const BUCKET = 'fotos';

const VIGENCIA_URL_SEGUNDOS = 3600;

const CAMPOS_FOTO = 'id, viaje_id, nombre, tipo_mime, tamano_bytes, subido_por, creado_en';

const EXTENSIONES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const generarRuta = (viajeId, tipoMime) => `${viajeId}/${randomUUID()}.${EXTENSIONES[tipoMime]}`;

const listar = async (cliente, usuarioId, viajeId) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };

  const { data, error } = await cliente
    .from('fotos')
    .select(`${CAMPOS_FOTO}, ruta`)
    .eq('viaje_id', viajeId)
    .order('creado_en', { ascending: false });
  if (error) return { error };

  const filas = data ?? [];
  if (filas.length === 0) return { estado: 'ok', fotos: [] };

  const firmadas = await cliente.storage.from(BUCKET).createSignedUrls(
    filas.map((fila) => fila.ruta),
    VIGENCIA_URL_SEGUNDOS,
  );
  if (firmadas.error) return { error: firmadas.error };

  const urls = new Map((firmadas.data ?? []).map((firmada) => [firmada.path, firmada.signedUrl ?? null]));
  const fotos = filas.map(({ ruta, ...foto }) => ({ ...foto, url: urls.get(ruta) ?? null }));
  return { estado: 'ok', fotos };
};

const subir = async (cliente, usuarioId, viajeId, { nombre, buffer, tipoMime }) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };
  if (previo.viaje.estado !== 'activo') return { estado: 'no_activo' };

  const ruta = generarRuta(viajeId, tipoMime);
  const almacen = cliente.storage.from(BUCKET);
  const subida = await almacen.upload(ruta, buffer, { contentType: tipoMime, upsert: false });
  if (subida.error) return { error: subida.error };

  const { data, error } = await cliente
    .from('fotos')
    .insert({
      viaje_id: viajeId,
      nombre,
      ruta,
      tipo_mime: tipoMime,
      tamano_bytes: buffer.length,
      subido_por: usuarioId,
    })
    .select(CAMPOS_FOTO)
    .single();
  if (error) {
    await almacen.remove([ruta]).catch(() => {});
    return { error };
  }

  const firmada = await almacen.createSignedUrl(ruta, VIGENCIA_URL_SEGUNDOS);
  return { estado: 'ok', foto: { ...data, url: firmada.data?.signedUrl ?? null } };
};

module.exports = { listar, subir, BUCKET, VIGENCIA_URL_SEGUNDOS };
