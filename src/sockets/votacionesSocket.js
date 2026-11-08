// Tiempo real de las votaciones (namespace /votaciones de Socket.io).
// Cada cliente se conecta con su token de sesión y se une a la sala de un viaje del que es miembro. Cuando una
// votación cambia por la API REST, se avisa a la sala de ese viaje para que las pantallas abiertas la vuelvan a
// pedir. El aviso no lleva los datos de la votación: cada usuario la pide con su sesión, así recibe su propio
// «mi_voto» y se siguen aplicando las políticas RLS
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Motivos del aviso: cambios en una votación, o en los miembros del viaje (cambia quién puede votar y,
// con ello, si ya han votado todos)
const MOTIVOS = ['creada', 'opcion', 'voto', 'cerrada', 'miembros'];

const sala = (viajeId) => `viaje:${viajeId}`;

let espacio = null;

// Error de conexión con el mismo formato que los de la API: el cliente lo recibe en «connect_error» (err.data)
const errorDeConexion = (codigo, mensaje) => Object.assign(new Error(mensaje), { data: { codigo, mensaje } });

// namespace: io.of('/votaciones'). comprobarToken(token) → { usuario, cliente } | { error: [estado, codigo, mensaje] }.
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
    // { viaje_id }: empieza a recibir los cambios de las votaciones de ese viaje. Responde (si se pide) con
    // { ok: true } o { error: { codigo, mensaje } }
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

// Avisa a los miembros conectados de que ha cambiado una votación del viaje o sus miembros.
// cambio: { votacion_id, motivo (creada | opcion | voto | cerrada), destino (solo al cerrar la de destino) }
// o { motivo: miembros }, sin votación
const avisarCambio = (viajeId, cambio) => {
  if (!espacio || !MOTIVOS.includes(cambio.motivo)) return;
  espacio.to(sala(viajeId)).emit('votacion_cambiada', { viaje_id: viajeId, ...cambio });
};

module.exports = { configurar, avisarCambio };
