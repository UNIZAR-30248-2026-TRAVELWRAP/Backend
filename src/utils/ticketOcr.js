// Extrae el concepto y el importe del texto que devuelve el OCR de un ticket.

const MAX_CONCEPTO = 100;

// Importes en formato español (1.234,56 o 12,50) o con punto decimal (12.50), con o sin símbolo de euro
const IMPORTE = /(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}|\d+\.\d{2})(?!\d)/g;

// Líneas que describen el ticket pero no son el concepto del gasto (cabeceras, impuestos, datos fiscales...)
const LINEA_NO_CONCEPTO = /total|subtotal|iva|cif|nif|tel[eé]fono|tel\.|fecha|factura|ticket|cambio|efectivo|tarjeta|mesa|cliente|€|eur/i;

// Convierte un importe escrito en formato español o con punto a número (12,50 → 12.5)
const aNumero = (texto) => {
  const normalizado = texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto;
  return Number(normalizado);
};

// Importes de una línea, como números
const importesDe = (linea) => [...linea.matchAll(IMPORTE)].map((m) => aNumero(m[1]));

// Importe del ticket: el de la última línea con «total» (sin «subtotal»); si no la hay, el mayor importe del texto.
// Devuelve null si no aparece ningún importe
const extraerImporte = (lineas) => {
  const lineasTotal = lineas.filter((linea) => /total/i.test(linea) && !/subtotal/i.test(linea));
  for (let i = lineasTotal.length - 1; i >= 0; i--) {
    const importes = importesDe(lineasTotal[i]);
    if (importes.length) return importes[importes.length - 1];
  }

  const todos = lineas.flatMap(importesDe).filter((importe) => importe > 0);
  return todos.length ? Math.max(...todos) : null;
};

// Concepto del gasto: la primera línea con texto que no sea cabecera, impuesto ni importe.
// Devuelve null si no hay ninguna que sirva
const extraerConcepto = (lineas) => {
  const candidata = lineas.find(
    (linea) => /[a-zA-ZáéíóúñÁÉÍÓÚÑ]{3,}/.test(linea) && !LINEA_NO_CONCEPTO.test(linea) && importesDe(linea).length === 0,
  );
  return candidata ? candidata.slice(0, MAX_CONCEPTO) : null;
};

// Datos del ticket a partir del texto del OCR. Cada campo es null si no se ha encontrado
const extraerDatosTicket = (texto) => {
  const lineas = String(texto ?? '')
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter((linea) => linea !== '');

  return { concepto: extraerConcepto(lineas), importe: extraerImporte(lineas) };
};

module.exports = { extraerDatosTicket };
