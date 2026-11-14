// Diseños de sello que se pueden elegir al terminar un viaje
const DISENOS_SELLO = ['chincheta', 'mapa', 'ruta', 'avion'];

const anioDe = (fecha) => (typeof fecha === 'string' ? Number(fecha.slice(0, 4)) : null);

// Texto del sello: su destino (o el nombre del viaje si aún no tiene) y el año de la fecha de inicio, de la
// finalización o de la creación, por este orden. Devuelve { destino, anio }
const textoDelSello = ({ destino, nombre, fecha_inicio: fechaInicio, finalizado_en: finalizadoEn, creado_en: creadoEn }) => ({
  destino: (destino ?? nombre).trim(),
  anio: anioDe(fechaInicio) ?? anioDe(finalizadoEn) ?? anioDe(creadoEn),
});

module.exports = { DISENOS_SELLO, textoDelSello };
