const webpush = require('web-push');

// Recibe el cliente de supabase del usuario (req.supabase) para que se apliquen las políticas RLS.
// Las claves VAPID son del servidor; sin ellas las push no están disponibles, pero los avisos en la app siguen

// Códigos con los que el servicio push dice que la suscripción ya no vale
const SUSCRIPCION_CADUCADA = [404, 410];

// Envío con la librería web-push, aparte para poder simularlo en las pruebas
const envio = {
  enviar: (suscripcion, carga, claves) => {
    webpush.setVapidDetails(claves.contacto, claves.publica, claves.privada);
    return webpush.sendNotification(suscripcion, carga);
  },
};

const claves = () => ({
  publica: process.env.VAPID_PUBLIC_KEY,
  privada: process.env.VAPID_PRIVATE_KEY,
  contacto: process.env.VAPID_SUBJECT ?? 'mailto:travelwrap@example.com',
});

const pushDisponible = () => Boolean(claves().publica && claves().privada);

const clavePublica = () => (pushDisponible() ? claves().publica : null);

// Guarda (o actualiza) la suscripción push del dispositivo de quien usa la app
// Devuelve { error } | { estado: ok }
const suscribir = async (cliente, usuarioId, { endpoint, p256dh, auth }) => {
  const { error } = await cliente
    .from('suscripciones_push')
    .upsert({ usuario_id: usuarioId, endpoint, p256dh, auth }, { onConflict: 'endpoint' });
  return error ? { error } : { estado: 'ok' };
};

// Borra la suscripción push de ese dispositivo, solo si es de quien usa la app
const cancelar = async (cliente, usuarioId, endpoint) => {
  const { error } = await cliente.from('suscripciones_push').delete().eq('usuario_id', usuarioId).eq('endpoint', endpoint);
  return error ? { error } : { estado: 'ok' };
};

// Envía la notificación a las suscripciones de los demás miembros del viaje y limpia las caducadas.
// Un fallo de un dispositivo no impide avisar a los demás
const enviarPush = async (cliente, viajeId, aviso) => {
  if (!pushDisponible()) return;

  const { data, error } = await cliente.rpc('suscripciones_push_del_viaje', { p_viaje_id: viajeId });
  if (error || !data?.length) return;

  const vapid = claves();
  const carga = JSON.stringify(aviso);

  await Promise.all(
    data.map(async (suscripcion) => {
      try {
        await envio.enviar(
          { endpoint: suscripcion.endpoint, keys: { p256dh: suscripcion.p256dh, auth: suscripcion.auth } },
          carga,
          vapid,
        );
      } catch (fallo) {
        if (SUSCRIPCION_CADUCADA.includes(fallo?.statusCode)) {
          await cliente.rpc('borrar_suscripcion_caducada', { p_endpoint: suscripcion.endpoint });
        }
      }
    }),
  );
};

module.exports = { envio, clavePublica, suscribir, cancelar, enviarPush };
