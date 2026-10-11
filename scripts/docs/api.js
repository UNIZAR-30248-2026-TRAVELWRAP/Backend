// Genera docs/API.md a partir del contrato OpenAPI (docs/openapi.yaml)
const { celda, codigo, tabla, ancla, unirBloques } = require('./markdown');

const METODOS = ['get', 'post', 'put', 'patch', 'delete'];
const PROFUNDIDAD_MAXIMA = 3;

const resolver = (documento, nodo) => {
  if (!nodo || !nodo.$ref) return nodo;
  const destino = nodo.$ref
    .replace(/^#\//, '')
    .split('/')
    .reduce((actual, parte) => actual?.[parte], documento);
  if (!destino) throw new Error(`Referencia $ref no encontrada: ${nodo.$ref}`);
  return resolver(documento, destino);
};

const nombreDeReferencia = (nodo) => nodo?.$ref?.split('/').pop();

const ejemplo = (esquema) => {
  if (!esquema || !('example' in esquema)) return '';
  return typeof esquema.example === 'string' ? esquema.example : JSON.stringify(esquema.example);
};

const describirTipo = (documento, esquema) => {
  const nombre = nombreDeReferencia(esquema);
  const real = resolver(documento, esquema) ?? {};
  let tipo;
  if (real.enum) tipo = `enum (${real.enum.join(', ')})`;
  else if (real.type === 'array') tipo = `array<${describirTipo(documento, real.items) || 'any'}>`;
  else if (nombre && real.type === 'object') tipo = nombre;
  else tipo = [real.type, real.format && `(${real.format})`].filter(Boolean).join(' ');
  return real.nullable ? `${tipo} | null` : tipo;
};

// Aplana un esquema de tipo objeto en filas: campo, tipo, obligatorio, descripción y ejemplo
const aplanar = (documento, esquema, prefijo = '', profundidad = 0) => {
  const real = resolver(documento, esquema);
  if (!real?.properties) return [];
  const obligatorios = new Set(real.required ?? []);
  const filas = [];
  for (const [nombre, propiedad] of Object.entries(real.properties)) {
    const campo = `${prefijo}${nombre}`;
    const propiedadReal = resolver(documento, propiedad);
    filas.push({
      campo,
      tipo: describirTipo(documento, propiedad),
      obligatorio: obligatorios.has(nombre),
      descripcion: propiedadReal.description ?? '',
      ejemplo: ejemplo(propiedadReal),
    });
    if (profundidad + 1 >= PROFUNDIDAD_MAXIMA) continue;
    if (propiedadReal.properties) {
      filas.push(...aplanar(documento, propiedadReal, `${campo}.`, profundidad + 1));
    } else if (propiedadReal.type === 'array' && resolver(documento, propiedadReal.items)?.properties) {
      filas.push(...aplanar(documento, propiedadReal.items, `${campo}[].`, profundidad + 1));
    }
  }
  return filas;
};

const tablaDeCampos = (filas) =>
  tabla(
    ['Campo', 'Tipo', 'Obligatorio', 'Descripción', 'Ejemplo'],
    filas.map((f) => [codigo(f.campo), f.tipo, f.obligatorio ? 'Sí' : 'No', f.descripcion, codigo(f.ejemplo)]),
  );

// Describe un esquema: tabla de campos, o la lista de variantes si es un oneOf
const describirEsquema = (documento, esquema) => {
  const real = resolver(documento, esquema);
  if (real?.oneOf) {
    const variantes = real.oneOf.map((variante) => {
      const nombre = nombreDeReferencia(variante) ?? 'Variante';
      const filas = aplanar(documento, variante);
      return `- **${nombre}**\n\n${filas.length ? tablaDeCampos(filas) : ''}`.trimEnd();
    });
    return `Una de estas variantes:\n\n${variantes.join('\n\n')}`;
  }
  const filas = aplanar(documento, esquema);
  return filas.length ? tablaDeCampos(filas) : '';
};

// Pares código/mensaje de error que aparecen en los ejemplos de una respuesta
const erroresDeEjemplos = (contenido) => {
  const ejemplos = [];
  if ('example' in contenido) ejemplos.push(contenido.example);
  for (const e of Object.values(contenido.examples ?? {})) ejemplos.push(e.value);
  return ejemplos
    .filter((e) => e?.error?.codigo)
    .map((e) => [codigo(e.error.codigo), e.error.mensaje ?? '']);
};

const describirSeguridad = (documento, operacion) => {
  const requisitos = operacion.security ?? documento.security ?? [];
  if (requisitos.length === 0) return 'Público (no requiere sesión)';
  return requisitos
    .flatMap((requisito) => Object.keys(requisito))
    .map((nombre) => {
      const esquema = documento.components?.securitySchemes?.[nombre] ?? {};
      if (esquema.type === 'http' && esquema.scheme === 'bearer') {
        return 'Requiere sesión: cabecera `Authorization: Bearer <token>`';
      }
      if (esquema.type === 'apiKey') {
        return `Requiere ${esquema.in} \`${esquema.name}\`${esquema.description ? `: ${esquema.description}` : ''}`;
      }
      return nombre;
    })
    .join('. ');
};

// Versión corta para la tabla resumen
const describirAcceso = (documento, operacion) => {
  const requisitos = operacion.security ?? documento.security ?? [];
  if (requisitos.length === 0) return 'Público';
  return requisitos
    .flatMap((requisito) => Object.keys(requisito))
    .map((nombre) => {
      const esquema = documento.components?.securitySchemes?.[nombre] ?? {};
      return esquema.type === 'apiKey' ? `Cookie ${esquema.name}` : 'Token de sesión';
    })
    .join(', ');
};

const bloqueParametros =(documento, operacion) => {
  const parametros = (operacion.parameters ?? []).map((p) => resolver(documento, p));
  if (parametros.length === 0) return null;
  return [
    '**Parámetros**',
    tabla(
      ['Nombre', 'En', 'Obligatorio', 'Tipo', 'Descripción', 'Ejemplo'],
      parametros.map((p) => [
        codigo(p.name),
        p.in,
        p.required ? 'Sí' : 'No',
        describirTipo(documento, p.schema),
        p.description ?? '',
        codigo(p.example ?? ejemplo(resolver(documento, p.schema))),
      ]),
    ),
  ].join('\n\n');
};

const bloqueCuerpo = (documento, operacion) => {
  const cuerpo = resolver(documento, operacion.requestBody);
  if (!cuerpo) return null;
  const [tipoContenido, contenido] = Object.entries(cuerpo.content ?? {})[0] ?? [];
  const cabecera = `**Cuerpo de la petición** (${codigo(tipoContenido)}${cuerpo.required ? ', obligatorio' : ''})`;
  return [cabecera, contenido ? describirEsquema(documento, contenido.schema) : ''].filter(Boolean).join('\n\n');
};

const bloqueRespuesta = (documento, estado, respuestaOriginal) => {
  const respuesta = resolver(documento, respuestaOriginal);
  const partes = [`**${estado}** — ${respuesta.description ?? ''}`];

  const [tipoContenido, contenido] = Object.entries(respuesta.content ?? {})[0] ?? [];
  if (contenido) {
    const errores = erroresDeEjemplos(contenido);
    const esError = nombreDeReferencia(contenido.schema) === 'Error';
    if (!esError) {
      const campos = describirEsquema(documento, contenido.schema);
      if (campos) partes.push(`Cuerpo (${codigo(tipoContenido)}):\n\n${campos}`);
    }
    if (errores.length > 0) partes.push(tabla(['Código de error', 'Mensaje'], errores));
  }

  const cabeceras = Object.entries(respuesta.headers ?? {});
  if (cabeceras.length > 0) {
    partes.push(
      tabla(
        ['Cabecera', 'Descripción', 'Ejemplo'],
        cabeceras.map(([nombre, cabecera]) => [codigo(nombre), cabecera.description ?? '', codigo(cabecera.example ?? ejemplo(cabecera.schema))]),
      ),
    );
  }
  return partes.join('\n\n');
};

const listarOperaciones = (documento) => {
  const operaciones = [];
  for (const [ruta, elemento] of Object.entries(documento.paths ?? {})) {
    for (const metodo of METODOS) {
      const operacion = elemento[metodo];
      if (!operacion) continue;
      operaciones.push({
        metodo: metodo.toUpperCase(),
        ruta,
        operacion,
        grupo: operacion.tags?.[0] ?? 'General',
      });
    }
  }
  return operaciones;
};

const generarApi = (documento) => {
  const operaciones = listarOperaciones(documento);
  const grupos = [...new Set(operaciones.map((o) => o.grupo))];
  const titulo = (o) => `${o.metodo} ${o.ruta}`;

  const cabecera = [
    `# ${documento.info?.title ?? 'API'}`,
    '> Documento generado automáticamente a partir de `docs/openapi.yaml` con `npm run docs`. No editar a mano: los cambios se perderían. Para modificar la documentación, edita el contrato OpenAPI.',
    documento.info?.description ?? '',
    [
      `- **Versión:** ${documento.info?.version ?? ''}`,
      ...(documento.servers ?? []).map((s) => `- **URL base:** ${codigo(s.url)}${s.description ? ` (${s.description})` : ''}`),
      '- **Formato:** JSON (`application/json`), salvo donde se indique',
      '- **Errores:** cuerpo `{ "error": { "codigo": "...", "mensaje": "..." } }`',
    ].join('\n'),
  ];

  const resumen = [
    '## Resumen de endpoints',
    tabla(
      ['Método', 'Ruta', 'Descripción', 'Acceso'],
      operaciones.map((o) => [
        o.metodo,
        `[${codigo(o.ruta)}](#${ancla(titulo(o))})`,
        o.operacion.summary ?? '',
        describirAcceso(documento, o.operacion),
      ]),
    ),
  ];

  const secciones = grupos.flatMap((grupo) => [
    `## ${grupo}`,
    ...operaciones
      .filter((o) => o.grupo === grupo)
      .map((o) =>
        unirBloques([
          `### ${titulo(o)}`,
          o.operacion.summary ? `**${o.operacion.summary}**` : '',
          o.operacion.description?.trim() ?? '',
          `**Acceso:** ${describirSeguridad(documento, o.operacion)}`,
          bloqueParametros(documento, o.operacion),
          bloqueCuerpo(documento, o.operacion),
          '**Respuestas**',
          ...Object.entries(o.operacion.responses ?? {}).map(([estado, r]) => bloqueRespuesta(documento, estado, r)),
        ]).trimEnd(),
      ),
  ]);

  return unirBloques([...cabecera, ...resumen, ...secciones]);
};

module.exports = { generarApi };
