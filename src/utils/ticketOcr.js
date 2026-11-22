// Analiza el texto que devuelve el OCR de un documento: detecta si es un gasto (ticket), una actividad
// (reserva, entrada, vuelo...) o cualquier otra cosa, y extrae los datos que necesita la pantalla de confirmación.
// Son funciones puras: no leen imágenes ni hablan con la base de datos.

const MAX_CONCEPTO = 100;
const MAX_RESUMEN = 1000;

// Importes en formato español (1.234,56 o 12,50) o con punto decimal (12.50), con o sin símbolo de euro
const IMPORTE = /(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}|\d+\.\d{2})(?!\d)/g;

// Líneas que describen el ticket pero no son el concepto del gasto (cabeceras, impuestos, datos fiscales...)
const LINEA_NO_CONCEPTO = /total|subtotal|iva|cif|nif|tel[eé]fono|tel\.|fecha|factura|ticket|cambio|efectivo|tarjeta|mesa|cliente|€|eur/i;

// Pistas de cada tipo de documento
// Marcas que solo trae un ticket o una factura, aunque el OCR lea mal el total (I.V.A., base imponible, forma de pago...)
const PISTAS_GASTO_FUERTES = /factura|ticket|base\s+imponible|\biva\b|i\.\s?v\.\s?a|forma\s+de\s+pago|tarjeta|efectivo|\bnif\b|\bcif\b/i;
const SIMBOLO_EURO = /€|\beur\b/i;
const PISTAS_ACTIVIDAD = /reserva|check-?in|check-?out|entrada|billete|vuelo|embarque|llegada|salida|booking|confirmaci[oó]n|visita|tour|museo|cita/i;

const HORA = /\b([01]?\d|2[0-3])[:h]([0-5]\d)\b/;
const FECHA_NUMERICA = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/;
const FECHA_TEXTO = /\b(\d{1,2})\s*(?:de\s+)?(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*\.?(?:\s+(?:de\s+)?(\d{4}))?\b/i;
const MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12 };

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

  // Sin línea de total, el mayor importe, sin contar la base imponible ni el IVA, que son parte del total
  const todos = lineas
    .filter((linea) => !/base|\biva\b|i\.\s?v\.\s?a/i.test(linea))
    .flatMap(importesDe)
    .filter((importe) => importe > 0);
  return todos.length ? Math.max(...todos) : null;
};

// Primera línea con texto que sirva como nombre: no es cabecera, impuesto ni importe
const extraerConcepto = (lineas) => {
  const candidata = lineas.find(
    (linea) => /[a-zA-ZáéíóúñÁÉÍÓÚÑ]{3,}/.test(linea) && !LINEA_NO_CONCEPTO.test(linea) && importesDe(linea).length === 0,
  );
  return candidata ? candidata.slice(0, MAX_CONCEPTO) : null;
};

// Hora de inicio en formato HH:MM, o null si no hay ninguna
const extraerHora = (texto) => {
  const m = texto.match(HORA);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
};

// Fecha en formato AAAA-MM-DD. Solo se devuelve si el documento trae el año: sin él no se puede saber
// en qué viaje o año va, así que la pantalla de confirmación la pide al usuario
const extraerFecha = (texto) => {
  const numerica = texto.match(FECHA_NUMERICA);
  if (numerica) {
    const anio = numerica[3].length === 2 ? `20${numerica[3]}` : numerica[3];
    return iso(anio, numerica[2], numerica[1]);
  }
  const textual = texto.match(FECHA_TEXTO);
  if (textual && textual[3]) return iso(textual[3], MESES[textual[2].toLowerCase()], textual[1]);
  return null;
};

// Formatea año, mes y día como AAAA-MM-DD, o devuelve null si la fecha no existe (por ejemplo, 31 de febrero)
const iso = (anio, mes, dia) => {
  const fecha = new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia)));
  const valida = fecha.getUTCFullYear() === Number(anio) && fecha.getUTCMonth() === Number(mes) - 1 && fecha.getUTCDate() === Number(dia);
  if (!valida) return null;
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
};

// Texto del OCR como líneas limpias
const lineasDe = (texto) =>
  String(texto ?? '')
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter((linea) => linea !== '');

// Datos del ticket a partir del texto del OCR. Cada campo es null si no se ha encontrado
const extraerDatosTicket = (texto) => {
  const lineas = lineasDe(texto);
  return { concepto: extraerConcepto(lineas), importe: extraerImporte(lineas) };
};

// Puntuación de cada tipo de documento según las pistas que tiene el texto
const puntuar = (texto, importe) => {
  // Un ticket trae fecha y hora, así que esas pistas solo cuentan para actividad si no hay marcas de ticket
  const gasto =
    (/total/i.test(texto) ? 2 : 0) +
    (PISTAS_GASTO_FUERTES.test(texto) ? 3 : 0) +
    (SIMBOLO_EURO.test(texto) ? 1 : 0) +
    (importe !== null ? 1 : 0);
  const actividad =
    (extraerFecha(texto) ? 2 : 0) + (HORA.test(texto) ? 2 : 0) + (PISTAS_ACTIVIDAD.test(texto) ? 2 : 0);
  return { gasto, actividad };
};

// --- Reservas, entradas y billetes (correos de confirmación, PDFs de compra...) ---

// Líneas de la web o del correo que no son datos de la reserva (agradecimientos, descargas, soporte, precios...)
const RUIDO_RESERVA = /gracias|confirmad|descarga|gestiona|\bpdf\b|soporte|viaja|\bapp\b|personas?|total|precio|pago|€|\beur\b|\biva\b|factura|www|https?|@|tel[eé]fono/i;
// Líneas con fecha u hora (no son el título ni el lugar)
const FECHA_O_HORA = /\d{1,2}[/.-]\d{1,2}|\d{1,2}:\d{2}|\b\d{1,2}\s+de\s+[a-záéíóú]+|\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b|\b\d{1,2}\s*h\d{2}\b/i;
// Palabras que dejan un título a medias: si el título acaba en una, la siguiente línea también es del título
const PREPOSICIONES = /^(de|del|la|las|los|el|en|y|a|of|the|and|da|di|e)$/i;
// Calle o dirección: nombres de vía, o un número seguido de una palabra (190 High Street, 12 Calle Mayor)
const CALLE = /\b(street|st\.?|road|rd\.?|avenue|ave\.?|calle|c\/|avda\.?|avenida|plaza|pza\.?|paseo|carrer|rue|via|piazza|strasse|square|boulevard)\b|\b\d{1,4}\s+[A-Za-zÀ-ÿ]/i;
// Dirección con nombre de vía: «190 High Street», «12 Calle Mayor» o «Calle Mayor 12»
const CALLE_CON_NOMBRE = /\b\d{1,4}\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]*\b(street|st|road|rd|avenue|calle|avenida|plaza|paseo|carrer|rue|piazza|strasse|square|boulevard)\b|\b(street|road|avenue|calle|avenida|plaza|paseo|carrer|rue|piazza|strasse|square|boulevard)\b/i;
// Código de reserva: «Reserva: A40333938» o «Reserva 123456»
const CODIGO_RESERVA = /reserva\s*:?\s*[A-Z]{0,2}\d{5,}/i;
// Categorías de actividad de la app, por las palabras que suelen traer sus reservas (en el orden de prioridad)
const CATEGORIAS_ACTIVIDAD = [
  ['cultura', /tour|visita|museo|catedral|iglesia|monumento|castillo|galer[ií]a|exposici[oó]n|guiad|palacio|teatro|concierto|historia/i],
  ['comida', /restaurante|cena|comida|almuerzo|degust|tapas|\bcata\b|bodega|cafeter[ií]a/i],
  ['alojamiento', /hotel|alojamiento|hostal|airbnb|apartamento|check-?in|check-?out|habitaci[oó]n/i],
  ['transporte', /vuelo|tren|bus|autob[uú]s|taxi|transfer|ferry|avi[oó]n|embarque|billete/i],
];

// Quita lo que el OCR añade alrededor del texto: símbolos, «Cómo llegar» y las letras sueltas del principio
const limpiarLinea = (linea) => {
  const sinEnlaces = linea.replace(/\bc[oó]mo llegar\b|\bver (el )?mapa\b/gi, '').replace(/[|_~=*<>]+/g, ' ');
  const sinSimbolos = sinEnlaces.replace(/^[^A-Za-zÀ-ÿ0-9]+/, '').trim();
  const tokens = sinSimbolos.split(/\s+/).filter(Boolean);
  while (tokens.length && /^[A-Za-zÀ-ÿ]{1,2}[.)\]]?$/.test(tokens[0]) && !PREPOSICIONES.test(tokens[0])) tokens.shift();
  return tokens.join(' ').replace(/[.,;:]+$/, '').trim();
};

// Título de la reserva: la línea que sigue al código de reserva. Si el nombre ocupa dos líneas (el OCR
// lo parte), se unen mientras el título siga incompleto (acaba en «de», o tiene menos de tres palabras)
const extraerTituloActividad = (lineas) => {
  // La línea con el código de reserva (Reserva: A40333938), no cualquier «reserva» de la web
  const indiceReserva = lineas.findIndex((linea) => CODIGO_RESERVA.test(linea));
  const inicio = indiceReserva === -1 ? 0 : indiceReserva + 1;
  const partes = [];

  for (let i = inicio; i < lineas.length && i <= inicio + 8; i++) {
    const original = lineas[i];
    const esRuido = FECHA_O_HORA.test(original) || /reserva/i.test(original) || RUIDO_RESERVA.test(original) || /c[oó]mo llegar/i.test(original);
    if (esRuido) {
      if (partes.length) break;
      continue;
    }
    const linea = limpiarLinea(original);
    const palabras = linea.split(' ').filter((palabra) => /[A-Za-zÀ-ÿ]{4,}/.test(palabra));
    if (palabras.length === 0) continue;

    if (partes.length === 0) {
      partes.push(linea);
    } else {
      const titulo = partes.join(' ').split(' ');
      const incompleto = PREPOSICIONES.test(titulo[titulo.length - 1]) || titulo.length < 3;
      if (!incompleto) break;
      // En la continuación solo valen palabras de letras: los números y las siglas del OCR no son del título
      partes.push(linea.split(' ').filter((t) => /^[A-Za-zÀ-ÿ]{3,}$/.test(t) || PREPOSICIONES.test(t)).join(' '));
    }
    const titulo = partes.join(' ').split(' ').filter(Boolean);
    if (titulo.length >= 3 && !PREPOSICIONES.test(titulo[titulo.length - 1])) break;
  }

  const titulo = partes.join(' ').replace(/\s+/g, ' ').trim();
  if (titulo) return titulo.slice(0, MAX_CONCEPTO);

  // Sin código de reserva, la primera línea con varias palabras que no sea de la web ni una fecha
  const primera = lineas.find((linea) => !RUIDO_RESERVA.test(linea) && !FECHA_O_HORA.test(linea) && linea.split(/\s+/).length >= 3);
  return primera ? limpiarLinea(primera).slice(0, MAX_CONCEPTO) : null;
};

// Dirección o lugar: primero una línea con nombre de calle (190 High Street), y solo si no hay ninguna,
// una con número y palabra. Sin «Cómo llegar» ni fechas
const extraerUbicacion = (lineas) => {
  const sinRuido = (linea) => !FECHA_O_HORA.test(linea) && !RUIDO_RESERVA.test(linea);
  const candidata =
    lineas.find((linea) => CALLE_CON_NOMBRE.test(linea) && sinRuido(linea)) ??
    lineas.find((linea) => CALLE.test(linea) && sinRuido(linea));
  const lugar = candidata ? limpiarLinea(candidata) : '';
  return lugar ? lugar.slice(0, MAX_CONCEPTO) : null;
};

// Categoría de la actividad según sus palabras clave. Si no encaja ninguna, se deja sin categoría
const extraerCategoria = (texto) => {
  const encontrada = CATEGORIAS_ACTIVIDAD.find(([, patron]) => patron.test(texto));
  return encontrada ? encontrada[0] : null;
};

// Clasifica el documento y devuelve sus datos listos para la pantalla de confirmación:
//  - gasto: { tipo: 'gasto', datos: { concepto, importe } }
//  - actividad: { tipo: 'actividad', datos: { titulo, fecha, hora_inicio } }
//  - otro: { tipo: 'otro', datos: { resumen } }
// Con pistas empatadas o insuficientes el documento se trata como otro: es lo más seguro para no crear
// un gasto o una actividad equivocados
const clasificarDocumento = (texto) => {
  const lineas = lineasDe(texto);
  const importe = extraerImporte(lineas);
  const { gasto, actividad } = puntuar(String(texto ?? ''), importe);
  const MINIMO = 3;

  if (gasto >= MINIMO && gasto > actividad) {
    return { tipo: 'gasto', datos: { concepto: extraerConcepto(lineas), importe } };
  }
  if (actividad >= MINIMO && actividad > gasto) {
    const completo = String(texto ?? '');
    return {
      tipo: 'actividad',
      datos: {
        titulo: extraerTituloActividad(lineas),
        fecha: extraerFecha(completo),
        hora_inicio: extraerHora(completo),
        ubicacion_nombre: extraerUbicacion(lineas),
        categoria: extraerCategoria(completo),
      },
    };
  }
  return { tipo: 'otro', datos: { resumen: lineas.join('\n').slice(0, MAX_RESUMEN) } };
};

module.exports = { extraerDatosTicket, clasificarDocumento };
