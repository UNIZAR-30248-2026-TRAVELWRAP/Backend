const { randomUUID } = require('node:crypto');
const viajeService = require('./viajeService');

const BUCKET = 'fotos';

const VIGENCIA_URL_SEGUNDOS = 3600;

const LIMITE_ALMACENAMIENTO_BYTES = 200_000_000;

const CAMPOS_FOTO = 'id, viaje_id, nombre, tipo_mime, tamano_bytes, subido_por, creado_en';

const EXTENSIONES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

const sumarBytes = (filas) => filas.reduce((total, fila) => total + Number(fila.tamano_bytes ?? 0), 0);

const almacenamiento = (usadoBytes) => ({ usado_bytes: usadoBytes, limite_bytes: LIMITE_ALMACENAMIENTO_BYTES });

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
  if (filas.length === 0) return { estado: 'ok', fotos: [], almacenamiento: almacenamiento(0) };

  const firmadas = await cliente.storage.from(BUCKET).createSignedUrls(
    filas.map((fila) => fila.ruta),
    VIGENCIA_URL_SEGUNDOS,
  );
  if (firmadas.error) return { error: firmadas.error };

  const urls = new Map((firmadas.data ?? []).map((firmada) => [firmada.path, firmada.signedUrl ?? null]));
  const fotos = filas.map(({ ruta, ...foto }) => ({ ...foto, url: urls.get(ruta) ?? null }));
  return { estado: 'ok', fotos, almacenamiento: almacenamiento(sumarBytes(filas)) };
};

const subir = async (cliente, usuarioId, viajeId, { nombre, buffer, tipoMime }) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };
  if (previo.viaje.estado !== 'activo') return { estado: 'no_activo' };

  const ocupado = await cliente.from('fotos').select('tamano_bytes').eq('viaje_id', viajeId);
  if (ocupado.error) return { error: ocupado.error };
  const usado = sumarBytes(ocupado.data ?? []);
  if (usado + buffer.length > LIMITE_ALMACENAMIENTO_BYTES) return { estado: 'almacenamiento_lleno', ...almacenamiento(usado) };

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

// Borra la fila (la política fotos_delete solo lo deja con el viaje activo) y después el archivo, que queda huérfano
// y Storage deja borrar. Si falla el borrado del archivo, la foto ya no existe para los miembros
// Devuelve { error } | { estado: no_existe | no_activo | foto_no_existe | ok }
const eliminar = async (cliente, usuarioId, viajeId, fotoId) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };
  if (previo.viaje.estado !== 'activo') return { estado: 'no_activo' };

  const { data, error } = await cliente.from('fotos').delete().eq('id', fotoId).eq('viaje_id', viajeId).select('ruta');
  if (error) return { error };
  if (!data?.length) return { estado: 'foto_no_existe' };

  await cliente.storage
    .from(BUCKET)
    .remove([data[0].ruta])
    .catch(() => {});

  return { estado: 'ok' };
};

module.exports = { listar, subir, eliminar, BUCKET, VIGENCIA_URL_SEGUNDOS, LIMITE_ALMACENAMIENTO_BYTES };
