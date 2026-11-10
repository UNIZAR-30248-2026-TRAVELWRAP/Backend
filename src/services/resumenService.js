const viajeService = require('./viajeService');
const { contarDias, resumirGastos, actividadMasVotada } = require('../utils/resumenViaje');

const TIPO_ACTIVIDAD = 'actividad';

const gastosDelViaje = (cliente, viajeId) => cliente.from('gastos').select('concepto, importe').eq('viaje_id', viajeId);

const fechasDeLasActividades = async (cliente, viajeId) => {
  const { data, error } = await cliente.from('actividades').select('fecha').eq('viaje_id', viajeId);
  if (error) return { error };
  return { fechas: (data ?? []).map((actividad) => actividad.fecha) };
};

const votosDeActividades = async (cliente, viajeId) => {
  const votaciones = await cliente.from('votaciones').select('id').eq('viaje_id', viajeId).eq('tipo', TIPO_ACTIVIDAD);
  if (votaciones.error) return { error: votaciones.error };

  const ids = (votaciones.data ?? []).map((votacion) => votacion.id);
  if (ids.length === 0) return { opciones: [], votos: [] };

  const [opciones, votos] = await Promise.all([
    cliente.from('opciones_votacion').select('id, texto, orden').in('votacion_id', ids),
    cliente.from('votos').select('opcion_id').in('votacion_id', ids),
  ]);
  if (opciones.error || votos.error) return { error: opciones.error ?? votos.error };
  return { opciones: opciones.data ?? [], votos: votos.data ?? [] };
};

const obtener = async (cliente, usuarioId, viajeId) => {
  const previo = await viajeService.obtener(cliente, usuarioId, viajeId);
  if (previo.error) return { error: previo.error };
  if (!previo.viaje) return { estado: 'no_existe' };

  const { fecha_inicio: inicio, fecha_fin: fin } = previo.viaje;
  const [gastos, votaciones, actividades] = await Promise.all([
    gastosDelViaje(cliente, viajeId),
    votosDeActividades(cliente, viajeId),
    inicio && fin ? Promise.resolve({ fechas: [] }) : fechasDeLasActividades(cliente, viajeId),
  ]);
  if (gastos.error) return { error: gastos.error };
  if (votaciones.error) return { error: votaciones.error };
  if (actividades.error) return { error: actividades.error };

  return {
    estado: 'ok',
    resumen: {
      dias: contarDias(inicio, fin, actividades.fechas),
      ...resumirGastos(gastos.data ?? []),
      actividad_mas_votada: actividadMasVotada(votaciones.opciones, votaciones.votos),
    },
  };
};

module.exports = { obtener };
