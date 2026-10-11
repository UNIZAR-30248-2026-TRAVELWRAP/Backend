// Genera docs/BASE_DE_DATOS.md a partir de los scripts SQL (esquema y políticas RLS).
//
// No es un parser SQL completo: entiende el estilo de estos scripts (una columna por línea,
// comentarios `--` encima o al final de la línea, sentencias terminadas en `;`).
const { normalizarSaltos, celda, codigo, tabla, ancla, unirBloques } = require('./markdown');

const sinEsquema = (nombre) => nombre.replace(/^public\./, '');
const colapsar = (texto) => texto.replace(/\s+/g, ' ').trim();

// Divide el script en sentencias. Los comentarios `--` justo encima de una sentencia
// (sin línea en blanco de por medio) se guardan como su descripción.
const dividirSentencias = (script) => {
  const sentencias = [];
  let comentarios = [];
  let actual = '';
  let enDolar = false;
  let enComilla = false;

  for (const linea of normalizarSaltos(script).split('\n')) {
    if (actual === '') {
      const recortada = linea.trim();
      if (recortada === '') {
        comentarios = [];
        continue;
      }
      if (recortada.startsWith('--')) {
        comentarios.push(recortada.slice(2).trim());
        continue;
      }
    }

    let fin = -1;
    for (let i = 0; i < linea.length && fin === -1; i += 1) {
      if (enDolar) {
        if (linea.startsWith('$$', i)) {
          enDolar = false;
          i += 1;
        }
      } else if (enComilla) {
        if (linea[i] === "'") enComilla = false;
      } else if (linea.startsWith('--', i)) {
        break;
      } else if (linea[i] === "'") {
        enComilla = true;
      } else if (linea.startsWith('$$', i)) {
        enDolar = true;
        i += 1;
      } else if (linea[i] === ';') {
        fin = i;
      }
    }

    actual += `${fin === -1 ? linea : linea.slice(0, fin)}\n`;
    if (fin !== -1) {
      sentencias.push({ texto: actual.trim(), comentarios });
      actual = '';
      comentarios = [];
    }
  }
  return sentencias;
};

// ── Esquema (01) ──────────────────────────────────────────────────────────────

const separarComentario = (linea) => {
  let enComilla = false;
  for (let i = 0; i < linea.length; i += 1) {
    if (linea[i] === "'") enComilla = !enComilla;
    else if (!enComilla && linea.startsWith('--', i)) {
      return [linea.slice(0, i).trimEnd(), linea.slice(i + 2).trim()];
    }
  }
  return [linea, ''];
};

const contar = (texto, caracter) => texto.split(caracter).length - 1;

// Separa el cuerpo de un CREATE TABLE en elementos (columnas y restricciones) con sus comentarios
const dividirElementos = (cuerpo) => {
  const elementos = [];
  let pendientes = [];
  let actual = null;
  let profundidad = 0;

  for (const linea of cuerpo.split('\n')) {
    const [codigoLinea, comentario] = separarComentario(linea);
    if (codigoLinea.trim() === '') {
      if (comentario) pendientes.push(comentario);
      continue;
    }
    if (!actual) {
      actual = { texto: '', comentarios: pendientes };
      pendientes = [];
    }
    if (comentario) actual.comentarios.push(comentario);
    actual.texto = `${actual.texto} ${codigoLinea.trim()}`.trim();
    profundidad += contar(codigoLinea, '(') - contar(codigoLinea, ')');
    if (profundidad === 0 && codigoLinea.trimEnd().endsWith(',')) {
      actual.texto = actual.texto.replace(/,$/, '');
      elementos.push(actual);
      actual = null;
    }
  }
  if (actual) elementos.push(actual);
  return elementos;
};

const RESTRICCION = /^(CONSTRAINT|PRIMARY\s+KEY|UNIQUE|FOREIGN\s+KEY|CHECK)\b/i;
const PALABRA_CLAVE = '(?:NOT\\s+NULL|NULL|PRIMARY\\s+KEY|UNIQUE|REFERENCES|CHECK|CONSTRAINT)';

const analizarColumna = ({ texto, comentarios }) => {
  const [, nombre, resto] = texto.match(/^"?(\w+)"?\s+(.*)$/s);
  const tipoCrudo = resto.match(/^[\w.]+(?:\s*\([^)]*\))?(?:\[\])?/)[0];
  const opciones = resto.slice(tipoCrudo.length);
  const referencia = opciones.match(
    /\bREFERENCES\s+([\w.]+)\s*\(([^)]+)\)(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION))?/i,
  );
  return {
    nombre,
    tipo: sinEsquema(tipoCrudo.replace(/\s+/g, '')),
    clavePrimaria: /\bPRIMARY\s+KEY\b/i.test(opciones),
    obligatoria: /\bNOT\s+NULL\b/i.test(opciones) || /\bPRIMARY\s+KEY\b/i.test(opciones),
    unica: /\bUNIQUE\b/i.test(opciones),
    defecto: opciones.match(new RegExp(`\\bDEFAULT\\s+(.+?)(?=\\s+${PALABRA_CLAVE}\\b|$)`, 'i'))?.[1] ?? null,
    comprobacion: opciones.match(/\bCHECK\s*\((.*)\)\s*$/i)?.[1]?.trim() ?? null,
    referencia: referencia
      ? {
          tabla: sinEsquema(referencia[1]),
          columna: referencia[2].trim(),
          alBorrar: referencia[3] ? colapsar(referencia[3]).toUpperCase() : null,
        }
      : null,
    comentarios,
  };
};

const analizarTabla = ({ texto, comentarios }) => {
  const nombre = sinEsquema(texto.match(/^CREATE\s+TABLE\s+([\w.]+)/i)[1]);
  const cuerpo = texto.slice(texto.indexOf('(') + 1, texto.lastIndexOf(')'));
  const columnas = [];
  const restricciones = [];

  for (const elemento of dividirElementos(cuerpo)) {
    if (!RESTRICCION.test(elemento.texto)) {
      columnas.push(analizarColumna(elemento));
      continue;
    }
    const clave = elemento.texto.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)/i);
    if (clave) {
      const nombres = clave[1].split(',').map((n) => n.trim());
      for (const columna of columnas) {
        if (nombres.includes(columna.nombre)) {
          columna.clavePrimaria = true;
          columna.obligatoria = true;
        }
      }
      continue;
    }
    const nombrada = elemento.texto.match(/^CONSTRAINT\s+(\w+)\s+(.*)$/is);
    restricciones.push({
      nombre: nombrada ? nombrada[1] : null,
      definicion: colapsar(nombrada ? nombrada[2] : elemento.texto),
      comentarios: elemento.comentarios,
    });
  }
  return { nombre, descripcion: comentarios, columnas, restricciones, indices: [], rls: false, politicas: [] };
};

const analizarEnum = ({ texto }) => {
  const coincidencia = texto.match(/^CREATE\s+TYPE\s+([\w.]+)\s+AS\s+ENUM\s*\((.*)\)$/is);
  if (!coincidencia) return null;
  return {
    nombre: sinEsquema(coincidencia[1]),
    valores: [...coincidencia[2].matchAll(/'([^']*)'/g)].map((m) => m[1]),
  };
};

const analizarIndice = ({ texto }) => {
  const c = texto.match(/^CREATE\s+(UNIQUE\s+)?INDEX\s+(\w+)\s+ON\s+([\w.]+)\s*\((.*)\)$/is);
  if (!c) return null;
  return { unico: Boolean(c[1]), nombre: c[2], tabla: sinEsquema(c[3]), columnas: colapsar(c[4]) };
};

// ── Políticas y funciones (02) ────────────────────────────────────────────────

// Texto entre los paréntesis que siguen a una expresión regular, respetando el anidamiento
const expresionEntreParentesis = (texto, patron) => {
  const coincidencia = texto.match(patron);
  if (!coincidencia) return null;
  const inicio = coincidencia.index + coincidencia[0].length;
  let profundidad = 1;
  for (let i = inicio; i < texto.length; i += 1) {
    if (texto[i] === '(') profundidad += 1;
    if (texto[i] === ')') profundidad -= 1;
    if (profundidad === 0) return colapsar(texto.slice(inicio, i));
  }
  return null;
};

const analizarPolitica = ({ texto, comentarios }) => {
  const c = texto.match(/^CREATE\s+POLICY\s+(\w+)\s+ON\s+([\w.]+)\s+(?:AS\s+\w+\s+)?FOR\s+(\w+)\s+TO\s+([\w\s,]+?)\s+(?=USING|WITH)/is);
  if (!c) return null;
  return {
    nombre: c[1],
    tabla: sinEsquema(c[2]),
    operacion: c[3].toUpperCase(),
    roles: colapsar(c[4]),
    using: expresionEntreParentesis(texto, /\bUSING\s*\(/i),
    withCheck: expresionEntreParentesis(texto, /\bWITH\s+CHECK\s*\(/i),
    comentarios,
  };
};

const analizarFuncion = ({ texto, comentarios }) => {
  const c = texto.match(/^CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w.]+)\s*\(([^)]*)\)\s+RETURNS\s+([\w.[\]]+)/i);
  if (!c) return null;
  return {
    nombre: sinEsquema(c[1]),
    parametros: colapsar(c[2]),
    devuelve: c[3],
    seguridad: /\bSECURITY\s+DEFINER\b/i.test(texto) ? 'DEFINER' : 'INVOKER',
    lenguaje: texto.match(/\bLANGUAGE\s+(\w+)/i)?.[1] ?? '',
    descripcion: comentarios.join(' '),
    ejecutablePor: [],
  };
};

// ── Análisis conjunto ─────────────────────────────────────────────────────────

const analizar = (scriptEsquema, scriptPoliticas) => {
  const tablas = [];
  const enums = [];
  const politicas = [];
  const funciones = [];
  const tablasConRls = new Set();

  for (const sentencia of [...dividirSentencias(scriptEsquema), ...dividirSentencias(scriptPoliticas)]) {
    const { texto } = sentencia;
    if (/^CREATE\s+TABLE\b/i.test(texto)) tablas.push(analizarTabla(sentencia));
    else if (/^CREATE\s+TYPE\b/i.test(texto)) enums.push(analizarEnum(sentencia));
    else if (/^CREATE\s+POLICY\b/i.test(texto)) politicas.push(analizarPolitica(sentencia));
    else if (/^CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\b/i.test(texto)) funciones.push(analizarFuncion(sentencia));
    else if (/^CREATE\s+(UNIQUE\s+)?INDEX\b/i.test(texto)) {
      const indice = analizarIndice(sentencia);
      tablas.find((t) => t.nombre === indice?.tabla)?.indices.push(indice);
    } else if (/^ALTER\s+TABLE\b.*\bENABLE\s+ROW\s+LEVEL\s+SECURITY\b/is.test(texto)) {
      tablasConRls.add(sinEsquema(texto.match(/^ALTER\s+TABLE\s+([\w.]+)/i)[1]));
    } else if (/^GRANT\s+EXECUTE\s+ON\s+FUNCTION\b/i.test(texto)) {
      const g = texto.match(/^GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+([\w.]+)\s*\([^)]*\)\s+TO\s+(.+)$/is);
      funciones.find((f) => f.nombre === sinEsquema(g[1]))?.ejecutablePor.push(colapsar(g[2]));
    }
  }

  for (const t of tablas) {
    t.rls = tablasConRls.has(t.nombre);
    t.politicas = politicas.filter((p) => p?.tabla === t.nombre);
  }
  return { tablas, enums: enums.filter(Boolean), politicas: politicas.filter(Boolean), funciones: funciones.filter(Boolean) };
};

// ── Markdown ──────────────────────────────────────────────────────────────────

const diagramaRelaciones = (tablas) => {
  const nombreMermaid = (nombre) => nombre.replace(/\./g, '_');
  const lineas = tablas.flatMap((t) =>
    t.columnas
      .filter((c) => c.referencia)
      .map((c) => `    ${nombreMermaid(c.referencia.tabla)} ${c.obligatoria ? '||' : '|o'}--o{ ${nombreMermaid(t.nombre)} : "${c.nombre}"`),
  );
  return lineas.length ? ['```mermaid', 'erDiagram', ...lineas, '```'].join('\n') : '';
};

const claveDeColumna = (c) =>
  [
    c.clavePrimaria ? 'PK' : '',
    c.referencia ? `FK → ${c.referencia.tabla}.${c.referencia.columna}${c.referencia.alBorrar ? ` (ON DELETE ${c.referencia.alBorrar})` : ''}` : '',
    c.unica ? 'UNIQUE' : '',
  ]
    .filter(Boolean)
    .join(', ');

const notasDeColumna = (c) =>
  [c.comentarios.join(' '), c.comprobacion ? `Debe cumplir: ${codigo(c.comprobacion)}` : ''].filter(Boolean).join('\n');

const bloqueTabla = (t) => {
  const partes = [`### ${t.nombre}`];
  if (t.descripcion.length) partes.push(t.descripcion.join(' '));
  partes.push(`**Seguridad por filas (RLS):** ${t.rls ? `activada, ${t.politicas.length} política${t.politicas.length === 1 ? '' : 's'}` : 'no activada'}`);
  partes.push(
    tabla(
      ['Columna', 'Tipo', 'Obligatoria', 'Clave', 'Por defecto', 'Notas'],
      t.columnas.map((c) => [codigo(c.nombre), codigo(c.tipo), c.obligatoria ? 'Sí' : 'No', claveDeColumna(c), codigo(c.defecto), notasDeColumna(c)]),
    ),
  );
  if (t.restricciones.length) {
    partes.push(`**Restricciones**\n\n${t.restricciones.map((r) => `- ${r.nombre ? `${codigo(r.nombre)}: ` : ''}${codigo(r.definicion)}${r.comentarios.length ? ` — ${r.comentarios.join(' ')}` : ''}`).join('\n')}`);
  }
  if (t.indices.length) {
    partes.push(`**Índices**\n\n${t.indices.map((i) => `- ${codigo(i.nombre)}${i.unico ? ' (único)' : ''} sobre (${i.columnas})`).join('\n')}`);
  }
  return unirBloques(partes).trimEnd();
};

const bloquePoliticas = (t) =>
  unirBloques([
    `#### ${t.nombre}`,
    tabla(
      ['Política', 'Operación', 'Rol', 'USING (qué filas puede ver o modificar)', 'WITH CHECK (qué filas puede escribir)'],
      t.politicas.map((p) => [codigo(p.nombre), p.operacion, p.roles, codigo(p.using), codigo(p.withCheck)]),
    ),
  ]).trimEnd();

const generarBaseDeDatos = (scriptEsquema, scriptPoliticas) => {
  const { tablas, enums, funciones } = analizar(scriptEsquema, scriptPoliticas);

  const bloques = [
    '# Base de datos de TravelWrap',
    '> Documento generado automáticamente a partir de `scripts/01_create_tables.sql` y `scripts/02_politicas_rls.sql` con `npm run docs`. No editar a mano: los cambios se perderían. Para modificar la documentación, edita los scripts SQL (los comentarios `--` junto a cada columna aparecen en la columna «Notas»).',
    'Base de datos PostgreSQL gestionada en Supabase. La autenticación usa Supabase Auth (`auth.users`).',
    '## Resumen',
    tabla(
      ['Tabla', 'Columnas', 'RLS', 'Políticas'],
      tablas.map((t) => [`[${t.nombre}](#${ancla(t.nombre)})`, t.columnas.length, t.rls ? 'Activada' : 'No activada', t.politicas.length]),
    ),
    '## Relaciones',
    diagramaRelaciones(tablas),
  ];

  if (enums.length) {
    bloques.push('## Tipos enumerados', tabla(['Tipo', 'Valores'], enums.map((e) => [codigo(e.nombre), e.valores.map((v) => codigo(v)).join(', ')])));
  }

  bloques.push('## Tablas', ...tablas.map(bloqueTabla));

  bloques.push('## Seguridad (RLS)');
  if (funciones.length) {
    bloques.push(
      '### Funciones',
      tabla(
        ['Función', 'Parámetros', 'Devuelve', 'Se ejecuta con permisos de', 'Ejecutable por', 'Descripción'],
        funciones.map((f) => [
          codigo(f.nombre),
          codigo(f.parametros),
          codigo(f.devuelve),
          f.seguridad === 'DEFINER' ? 'su propietario (SECURITY DEFINER)' : 'quien la llama',
          f.ejecutablePor.join(', '),
          f.descripcion,
        ]),
      ),
    );
  }
  bloques.push('### Políticas por tabla', ...tablas.filter((t) => t.politicas.length).map(bloquePoliticas));

  return unirBloques(bloques);
};

module.exports = { generarBaseDeDatos, dividirSentencias, analizar };
