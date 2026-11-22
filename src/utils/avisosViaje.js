const viajeService = require('../services/viajeService');
const notificacionService = require('../services/notificacionService');
const notificacionesSocket = require('../sockets/notificacionesSocket');

const MAX_DETALLE = 80;

// Qué se cuenta de cada tipo de evento y a qué pantalla lleva el aviso
const EVENTOS = {
  votacion: { accion: 'ha creado una votación', pantalla: 'votaciones' },
  gasto: { accion: 'ha registrado un gasto', pantalla: 'gastos' },
  tarea: { accion: 'ha añadido una tarea', pantalla: 'tareas' },
  mensaje: { accion: 'ha enviado un mensaje', pantalla: 'chat' },
};

const recortar = (texto) => (texto.length > MAX_DETALLE ? `${texto.slice(0, MAX_DETALLE - 1)}…` : texto);

// Avisa a los demás miembros del viaje (en la app y con push) de un evento nuevo. Nunca avisa a quien lo ha generado
// y nunca falla: si no se puede avisar, el evento ya está guardado y la respuesta no cambia
// tipo: votacion | gasto | tarea | mensaje; detalle: título, concepto o texto del evento
const avisarEvento = async (cliente, usuarioId, viajeId, tipo, detalle) => {
  try {
    const evento = EVENTOS[tipo];
    const { viaje } = await viajeService.obtener(cliente, usuarioId, viajeId);
    if (!evento || !viaje) return;

    const autor = viaje.miembros.find((m) => m.usuario_id === usuarioId)?.nombre ?? 'Alguien';
    const destinatarios = viaje.miembros.map((m) => m.usuario_id).filter((id) => id !== usuarioId);
    const aviso = {
      viaje_id: viajeId,
      viaje_nombre: viaje.nombre,
      tipo,
      pantalla: evento.pantalla,
      texto: `${autor} ${evento.accion}${detalle ? `: ${recortar(detalle)}` : ''}`,
    };

    notificacionesSocket.avisarA(destinatarios, aviso);
    await notificacionService.enviarPush(cliente, viajeId, aviso);
  } catch {
    // Un fallo al avisar no debe afectar a la petición que ha generado el evento
  }
};

module.exports = { avisarEvento };
