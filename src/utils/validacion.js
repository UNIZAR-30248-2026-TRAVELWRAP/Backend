// Utilidades comunes de los controladores: respuesta de error y validación de datos de entrada

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Código de PostgreSQL cuando se incumple un check
const CHECK_VIOLATION = '23514';

const responderError = (res, estado, codigo, mensaje) =>
  res.status(estado).json({ error: { codigo, mensaje } });

// Fecha AAAA-MM-DD que existe en el calendario (rechaza, por ejemplo, 2026-02-30)
const fechaValida = (texto) => {
  if (!FECHA_REGEX.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().startsWith(texto);
};

// Texto opcional: null, ausente o vacío (null). Devuelve undefined si no es un texto válido
const textoOpcional = (valor) => {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string') return undefined;
  const texto = valor.trim();
  return texto === '' ? null : texto;
};

module.exports = { UUID_REGEX, CHECK_VIOLATION, responderError, fechaValida, textoOpcional };
