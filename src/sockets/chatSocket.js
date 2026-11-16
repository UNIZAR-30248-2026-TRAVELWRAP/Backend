// Tiempo real del chat del viaje (namespace /chat de Socket.io).
// Cada cliente se conecta con su token de sesión y se une a la sala de un viaje del que es miembro activo. Cuando se
// guarda un mensaje por la API REST, se envía a la sala de ese viaje con el mensaje ya guardado. La API REST sigue
// siendo la única que escribe: por el socket solo se recibe y se entra o sale de salas
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sala = (viajeId) => `viaje:${viajeId}`;

let espacio = null;

// Error de conexión con el mismo formato que los de la API: el cliente lo recibe en «connect_error» (err.data)
const errorDeConexion = (codigo, mensaje) => Object.assign(new Error(mensaje), { data: { codigo, mensaje } });

// namespace: io.of('/chat'). comprobarToken(token) → { usuario, cliente } | { error: [estado, codigo, mensaje] }.
// esMiembro(cliente, usuarioId, viajeId) → true si el usuario es miembro activo del viaje
const configurar = (namespace, { comprobarToken, esMiembro }) => {
  espacio = namespace;

  // Sin una sesión válida no se acepta la conexión
  namespace.use(async (socket, next) => {
    try {
      const resultado = await comprobarToken(socket.handshake.auth?.token);
      if (resultado.error) {
        const [, codigo, mensaje] = resultado.error;
        return next(errorDeConexion(codigo, mensaje));
      }
      socket.data.usuario = resultado.usuario;
      socket.data.cliente = resultado.cliente;
      return next();
    } catch {
      return next(errorDeConexion('error_interno', 'Error interno del servidor'));
    }
  });

  namespace.on('connection', (socket) => {
    // { viaje_id }: empieza a recibir los mensajes de ese viaje. Responde (si se pide) con { ok: true } o
    // { error: { codigo, mensaje } }
    socket.on('unirse_viaje', async (datos, responder = () => {}) => {
      const viajeId = datos?.viaje_id;
      if (typeof viajeId !== 'string' || !UUID_REGEX.test(viajeId)) {
        return responder({ error: { codigo: 'datos_invalidos', mensaje: 'El identificador del viaje no es válido' } });
      }
      try {
        if (!(await esMiembro(socket.data.cliente, socket.data.usuario.id, viajeId))) {
          return responder({ error: { codigo: 'viaje_no_encontrado', mensaje: 'El viaje no existe o no perteneces a él' } });
        }
        await socket.join(sala(viajeId));
        return responder({ ok: true });
      } catch {
        return responder({ error: { codigo: 'error_interno', mensaje: 'Error interno del servidor' } });
      }
    });

    socket.on('salir_viaje', (datos) => {
      if (typeof datos?.viaje_id === 'string') socket.leave(sala(datos.viaje_id));
    });
  });
};

// Envía a los miembros conectados del viaje un mensaje ya guardado (con el mismo formato que la respuesta REST)
const avisarMensaje = (viajeId, mensaje) => {
  if (!espacio) return;
  espacio.to(sala(viajeId)).emit('mensaje', { viaje_id: viajeId, mensaje });
};

module.exports = { configurar, avisarMensaje };
