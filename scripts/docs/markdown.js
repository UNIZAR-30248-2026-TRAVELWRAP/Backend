// Utilidades comunes para generar Markdown

const normalizarSaltos = (texto) => texto.replace(/\r\n/g, '\n');

// Texto seguro para una celda de tabla: sin barras verticales ni saltos de línea
const celda = (valor) =>
  String(valor ?? '')
    .trim()
    .replace(/\|/g, '\\|')
    .replace(/\n+/g, '<br>');

const codigo = (valor) => (valor === undefined || valor === null || valor === '' ? '' : `\`${String(valor).replace(/`/g, "'")}\``);

const tabla = (cabeceras, filas) => {
  const linea = (celdas) => `| ${celdas.map(celda).join(' | ')} |`;
  return [linea(cabeceras), linea(cabeceras.map(() => '---')), ...filas.map(linea)].join('\n');
};

// Ancla que GitHub genera para un encabezado
const ancla = (encabezado) =>
  encabezado
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');

const unirBloques = (bloques) => `${bloques.filter((b) => b !== null && b !== undefined && b !== '').join('\n\n')}\n`;

module.exports = { normalizarSaltos, celda, codigo, tabla, ancla, unirBloques };
