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

module.exports = { listar, subir, BUCKET };
