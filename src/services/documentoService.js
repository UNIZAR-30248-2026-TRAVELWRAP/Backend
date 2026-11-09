const { randomUUID } = require('node:crypto');
const viajeService = require('./viajeService');

// Bucket privado de Supabase Storage con los archivos de la cartera (scripts/02_politicas_rls.sql)
const BUCKET = 'documentos';

const CAMPOS_DOCUMENTO = 'id, viaje_id, nombre, tipo_mime, tamano_bytes, subido_por, creado_en';

const EXTENSIONES = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

// Ruta del archivo dentro del bucket: la carpeta del viaje (la que comprueban las políticas de Storage)
// y un nombre aleatorio, para no repetir rutas ni guardar en ella el nombre que ha puesto el usuario
const generarRuta = (viajeId, tipoMime) => `${viajeId}/${randomUUID()}.${EXTENSIONES[tipoMime]}`;

// Documentos de la cartera del viaje, del más reciente al más antiguo.
// También se pueden consultar en viajes finalizados o archivados: solo lee
// Devuelve { error } | { estado: no_existe | ok (con documentos) }
const listar = async (cliente, usuarioId, viajeId) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };

  const { data, error } = await cliente
    .from('documentos')
    .select(CAMPOS_DOCUMENTO)
    .eq('viaje_id', viajeId)
    .order('creado_en', { ascending: false });
  if (error) return { error };

  return { estado: 'ok', documentos: data ?? [] };
};

// Sube el archivo al bucket y registra el documento. Si el registro falla, borra el archivo subido
// para no dejarlo en el bucket sin fila que lo referencie
// Devuelve { error } | { estado: no_existe | no_activo | ok (con documento) }
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
    .from('documentos')
    .insert({
      viaje_id: viajeId,
      nombre,
      ruta,
      tipo_mime: tipoMime,
      tamano_bytes: buffer.length,
      subido_por: usuarioId,
    })
    .select(CAMPOS_DOCUMENTO)
    .single();
  if (error) {
    await almacen.remove([ruta]).catch(() => {});
    return { error };
  }

  return { estado: 'ok', documento: data };
};

// Segundos que dura el enlace de un documento. Se pide uno nuevo cada vez que se abre o se descarga,
// así que un documento se puede abrir siempre mientras no se elimine
const SEGUNDOS_DE_ENLACE = 300;

const archivoNoEncontrado = (error) => error.statusCode === '404' || /not found/i.test(error.message ?? '');

// Enlace temporal de Supabase Storage para abrir un documento del viaje, o para descargarlo con su nombre.
// Sirve también en viajes finalizados o archivados: solo lee. La ruta del archivo no sale del servidor
// Devuelve { error } | { estado: no_existe | documento_no_existe | ok (con url, expira_en, nombre y tipo_mime) }
const obtenerUrl = async (cliente, usuarioId, viajeId, documentoId, { descargar = false } = {}) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };

  // El documento tiene que ser de este viaje: con otro id de viaje no se encuentra
  const { data: documento, error } = await cliente
    .from('documentos')
    .select('ruta, nombre, tipo_mime')
    .eq('id', documentoId)
    .eq('viaje_id', viajeId)
    .maybeSingle();
  if (error) return { error };
  if (!documento) return { estado: 'documento_no_existe' };

  const expira = new Date(Date.now() + SEGUNDOS_DE_ENLACE * 1000);
  const { data, error: errorEnlace } = await cliente.storage
    .from(BUCKET)
    .createSignedUrl(documento.ruta, SEGUNDOS_DE_ENLACE, descargar ? { download: documento.nombre } : undefined);
  if (errorEnlace) {
    return archivoNoEncontrado(errorEnlace) ? { estado: 'documento_no_existe' } : { error: errorEnlace };
  }

  return {
    estado: 'ok',
    url: data.signedUrl,
    expira_en: expira.toISOString(),
    nombre: documento.nombre,
    tipo_mime: documento.tipo_mime,
  };
};

module.exports = { listar, subir, obtenerUrl, BUCKET, SEGUNDOS_DE_ENLACE };
