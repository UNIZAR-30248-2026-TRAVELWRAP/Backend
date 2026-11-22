// Avisos en tiempo real de los eventos del viaje (namespace /notificaciones de Socket.io).
// Cada cliente se conecta con su token de sesión y entra en su sala personal. Cuando alguien crea una votación,
// un gasto, una tarea o un mensaje por la API REST, se avisa a la sala de cada uno de los demás miembros del viaje
// (nunca a quien lo ha creado). Por el socket solo se reciben avisos: no se escribe nada

const sala = (usuarioId) => `usuario:${usuarioId}`;

let espacio = null;

// Error de conexión con el mismo formato que los de la API: el cliente lo recibe en «connect_error» (err.data)
const errorDeConexion = (codigo, mensaje) => Object.assign(new Error(mensaje), { data: { codigo, mensaje } });

// namespace: io.of('/notificaciones'). comprobarToken(token) → { usuario, cliente } | { error: [estado, codigo, mensaje] }
const configurar = (namespace, { comprobarToken }) => {
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
      return next();
    } catch {
      return next(errorDeConexion('error_interno', 'Error interno del servidor'));
    }
  });

  namespace.on('connection', (socket) => {
    socket.join(sala(socket.data.usuario.id));
  });
};

// Envía el aviso (viaje_id, viaje_nombre, tipo, texto) a cada usuario de la lista
const avisarA = (usuariosIds, aviso) => {
  if (!espacio) return;
  usuariosIds.forEach((usuarioId) => espacio.to(sala(usuarioId)).emit('notificacion', aviso));
};

module.exports = { configurar, avisarA };
