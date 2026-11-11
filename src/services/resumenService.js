const viajeService = require('./viajeService');
const { contarDias, resumirGastos, actividadMasVotada, almaDelGrupo } = require('../utils/resumenViaje');

const TIPO_ACTIVIDAD = 'actividad';

const gastosDelViaje = (cliente, viajeId) =>
  cliente.from('gastos').select('concepto, importe, pagado_por').eq('viaje_id', viajeId);

const actividadesDelViaje = (cliente, viajeId) =>
  cliente.from('actividades').select('fecha, creado_por').eq('viaje_id', viajeId);

const fotosDelViaje = (cliente, viajeId) => cliente.from('fotos').select('subido_por').eq('viaje_id', viajeId);

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
  const [gastos, votaciones, actividades, fotos] = await Promise.all([
    gastosDelViaje(cliente, viajeId),
    votosDeActividades(cliente, viajeId),
    actividadesDelViaje(cliente, viajeId),
    fotosDelViaje(cliente, viajeId),
  ]);
  const fallo = gastos.error ?? votaciones.error ?? actividades.error ?? fotos.error;
  if (fallo) return { error: fallo };

  return {
    estado: 'ok',
    resumen: {
      dias: contarDias(
        inicio,
        fin,
        (actividades.data ?? []).map((actividad) => actividad.fecha),
      ),
      ...resumirGastos(gastos.data ?? []),
      actividad_mas_votada: actividadMasVotada(votaciones.opciones, votaciones.votos),
      alma_del_grupo: almaDelGrupo(previo.viaje.miembros, gastos.data ?? [], actividades.data ?? [], fotos.data ?? []),
    },
  };
};

module.exports = { obtener };
