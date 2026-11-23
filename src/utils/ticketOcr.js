// Analiza el texto que devuelve el OCR de un documento: detecta si es un gasto (ticket), una actividad
// (reserva, entrada, vuelo...) o cualquier otra cosa, y extrae los datos que necesita la pantalla de confirmación.
// Son funciones puras: no leen imágenes ni hablan con la base de datos.

const MAX_CONCEPTO = 100;
const MAX_RESUMEN = 1000;

// Importes en formato español (1.234,56 o 12,50) o con punto decimal (12.50), con o sin símbolo de euro
const IMPORTE = /\d+(?:\.\d{3})*,\d{2}(?!\d)|\d+\.\d{2}(?!\d)/g;

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
  const normalizado = texto.includes(',') ? texto.replaceAll('.', '').replace(',', '.') : texto;
  return Number(normalizado);
};

// Importes de una línea, como números
const importesDe = (linea) => [...linea.matchAll(IMPORTE)].map((m) => aNumero(m[0]));

// Importe del ticket: el de la última línea con «total» (sin «subtotal»); si no la hay, el mayor importe del texto.
// Devuelve null si no aparece ningún importe
const extraerImporte = (lineas) => {
  const importesTotal = lineas
    .filter((linea) => /total/i.test(linea) && !/subtotal/i.test(linea))
    .map(importesDe)
    .filter((importes) => importes.length > 0);
  if (importesTotal.length) return importesTotal.at(-1).at(-1);

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
    (linea) => /\p{L}{3,}/u.test(linea) && !LINEA_NO_CONCEPTO.test(linea) && importesDe(linea).length === 0,
  );
  return candidata ? candidata.slice(0, MAX_CONCEPTO) : null;
};

// Hora de inicio en formato HH:MM, o null si no hay ninguna
const extraerHora = (texto) => {
  const m = texto.match(HORA);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
};

// Formatea año, mes y día como AAAA-MM-DD, o devuelve null si la fecha no existe (por ejemplo, 31 de febrero)
const iso = (anio, mes, dia) => {
  const fecha = new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia)));
  const valida = fecha.getUTCFullYear() === Number(anio) && fecha.getUTCMonth() === Number(mes) - 1 && fecha.getUTCDate() === Number(dia);
  if (!valida) return null;
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
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
  if (textual?.[3]) return iso(textual[3], MESES[textual[2].toLowerCase()], textual[1]);
  return null;
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
const RUIDO_RESERVA = [
  /gracias|confirmad|descarga|gestiona|\bpdf\b|soporte|viaja|\bapp\b|personas?/i,
  /total|precio|pago|€|\beur\b|\biva\b|factura/i,
  /www|https?|@|tel[eé]fono/i,
];
const esRuidoReserva = (linea) => RUIDO_RESERVA.some((patron) => patron.test(linea));

// Líneas con fecha u hora (no son el título ni el lugar)
const FECHA_O_HORA = [
  /\d{1,2}[/.-]\d{1,2}/,
  /\d{1,2}:\d{2}/,
  /\d{1,2}\s+de\s+[a-záéíóú]+/i,
  /\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/i,
  /\b\d{1,2}\s*h\d{2}\b/i,
];
const esFechaOHora = (linea) => FECHA_O_HORA.some((patron) => patron.test(linea));

// Línea que no puede ser parte del título de la reserva: web, precios, fechas o «Cómo llegar»
const esLineaDeRuido = (linea) =>
  esFechaOHora(linea) || /reserva/i.test(linea) || esRuidoReserva(linea) || /c[oó]mo llegar/i.test(linea);

// Palabras que dejan un título a medias: si el título acaba en una, la siguiente línea también es del título
const PREPOSICIONES = /^(de|del|la|las|los|el|en|y|a|of|the|and|da|di|e)$/i;

// Calle o dirección: nombres de vía, o un número seguido de una palabra (190 High Street, 12 Calle Mayor)
const CALLE = /\b(street|st\.?|road|rd\.?|avenue|ave\.?|calle|c\/|avda\.?|avenida|plaza|pza\.?|paseo|carrer|rue|via|piazza|strasse|square|boulevard)\b|\b\d{1,4}\s+\p{L}/iu;

// Dirección con nombre de vía: «190 High Street», «12 Calle Mayor» o «Calle Mayor 12»
const CALLE_CON_NOMBRE =
  /\b\d{1,4}\s+\p{L}[\p{L}\s]*\b(street|st|road|rd|avenue|calle|avenida|plaza|paseo|carrer|rue|piazza|strasse|square|boulevard)\b|\b(street|road|avenue|calle|avenida|plaza|paseo|carrer|rue|piazza|strasse|square|boulevard)\b/iu;

// Código de reserva: «Reserva: A40333938» o «Reserva 123456»
const CODIGO_RESERVA = /reserva[\s:]*[A-Z]{0,2}\d{5,}/i;

// Categorías de actividad de la app, por las palabras que suelen traer sus reservas (en el orden de prioridad)
const CATEGORIAS_ACTIVIDAD = [
  ['cultura', /tour|visita|museo|catedral|iglesia|monumento|castillo|galer[ií]a|exposici[oó]n|guiad|palacio|teatro|concierto|historia/i],
  ['comida', /restaurante|cena|comida|almuerzo|degust|tapas|\bcata\b|bodega|cafeter[ií]a/i],
  ['alojamiento', /hotel|alojamiento|hostal|airbnb|apartamento|check-?in|check-?out|habitaci[oó]n/i],
  ['transporte', /vuelo|tren|bus|autob[uú]s|taxi|transfer|ferry|avi[oó]n|embarque|billete/i],
];

// Quita los signos de puntuación del final del texto (punto, coma, punto y coma, dos puntos)
const quitarSignosFinales = (texto) => {
  let fin = texto.length;
  while (fin > 0 && '.,;:'.includes(texto[fin - 1])) fin--;
  return texto.slice(0, fin);
};

// Quita lo que el OCR añade alrededor del texto: símbolos, «Cómo llegar» y las letras sueltas del principio
const limpiarLinea = (linea) => {
  const sinEnlaces = linea.replace(/\bc[oó]mo llegar\b|\bver (el )?mapa\b/gi, '').replace(/[|_~=*<>]+/g, ' ');
  const sinSimbolos = sinEnlaces.replace(/^[^\p{L}0-9]+/u, '').trim();
  const tokens = sinSimbolos.split(/\s+/).filter(Boolean);
  while (tokens.length && /^\p{L}{1,2}[.)\]]?$/u.test(tokens[0]) && !PREPOSICIONES.test(tokens[0])) tokens.shift();
  return quitarSignosFinales(tokens.join(' ')).trim();
};

// Palabras de todas las partes del título
const palabrasDe = (partes) => partes.join(' ').split(' ').filter(Boolean);

// El título está incompleto si tiene menos de tres palabras o acaba en preposición
const tituloIncompleto = (partes) => {
  const palabras = palabrasDe(partes);
  return palabras.length < 3 || PREPOSICIONES.test(palabras.at(-1));
};

// En la continuación del título solo valen las palabras de letras: los números y las siglas del OCR no son del título
const palabrasDeLetras = (linea) =>
  linea
    .split(' ')
    .filter((palabra) => /^\p{L}{3,}$/u.test(palabra) || PREPOSICIONES.test(palabra))
    .join(' ');

// Título de la reserva: la línea que sigue al código de reserva. Si el nombre ocupa dos líneas (el OCR
// lo parte), se unen mientras el título siga incompleto (acaba en «de», o tiene menos de tres palabras)
const extraerTituloActividad = (lineas) => {
  // La línea con el código de reserva (Reserva: A40333938), no cualquier «reserva» de la web
  const indiceReserva = lineas.findIndex((linea) => CODIGO_RESERVA.test(linea));
  const inicio = indiceReserva === -1 ? 0 : indiceReserva + 1;
  const partes = [];

  for (let i = inicio; i < lineas.length && i <= inicio + 8; i++) {
    const original = lineas[i];
    if (esLineaDeRuido(original)) {
      if (partes.length) break;
      continue;
    }
    const linea = limpiarLinea(original);
    if (!linea.split(' ').some((palabra) => /\p{L}{4,}/u.test(palabra))) continue;

    if (partes.length > 0 && !tituloIncompleto(partes)) break;
    partes.push(partes.length === 0 ? linea : palabrasDeLetras(linea));
    if (!tituloIncompleto(partes)) break;
  }

  const titulo = partes.join(' ').replace(/\s+/g, ' ').trim();
  if (titulo) return titulo.slice(0, MAX_CONCEPTO);

  // Sin código de reserva, la primera línea con varias palabras que no sea de la web ni una fecha
  const primera = lineas.find((linea) => !esRuidoReserva(linea) && !esFechaOHora(linea) && linea.split(/\s+/).length >= 3);
  return primera ? limpiarLinea(primera).slice(0, MAX_CONCEPTO) : null;
};

// Dirección o lugar: primero una línea con nombre de calle (190 High Street), y solo si no hay ninguna,
// una con número y palabra. Sin «Cómo llegar» ni fechas
const extraerUbicacion = (lineas) => {
  const sinRuido = (linea) => !esFechaOHora(linea) && !esRuidoReserva(linea);
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
