// Genera la documentación Markdown a partir de las fuentes de verdad:
//   docs/openapi.yaml            → docs/API.md
//   scripts/01_create_tables.sql
//   scripts/02_politicas_rls.sql → docs/BASE_DE_DATOS.md
//
// Uso:
//   npm run docs         escribe los ficheros
//   npm run docs:check   no escribe nada; falla si los ficheros no están al día (lo usa el CI)
const fs = require('fs');
const path = require('path');
const YAML = require('yamljs');
const { generarApi } = require('./docs/api');
const { generarBaseDeDatos } = require('./docs/sql');
const { normalizarSaltos } = require('./docs/markdown');

const raiz = path.join(__dirname, '..');
const ruta = (relativa) => path.join(raiz, relativa);
const leer = (relativa) => normalizarSaltos(fs.readFileSync(ruta(relativa), 'utf8'));

const documentos = [
  {
    destino: 'docs/API.md',
    generar: () => generarApi(YAML.parse(leer('docs/openapi.yaml'))),
  },
  {
    destino: 'docs/BASE_DE_DATOS.md',
    generar: () => generarBaseDeDatos(leer('scripts/01_create_tables.sql'), leer('scripts/02_politicas_rls.sql')),
  },
];

const soloComprobar = process.argv.includes('--check');
const desactualizados = [];

for (const { destino, generar } of documentos) {
  const nuevo = generar();
  const existe = fs.existsSync(ruta(destino));
  const actual = existe ? leer(destino) : null;

  if (actual === nuevo) {
    console.log(`Al día:        ${destino}`);
  } else if (soloComprobar) {
    desactualizados.push(destino);
  } else {
    fs.writeFileSync(ruta(destino), nuevo, 'utf8');
    console.log(`Actualizado:   ${destino}`);
  }
}

if (desactualizados.length > 0) {
  console.error(`\nLa documentación no está al día: ${desactualizados.join(', ')}`);
  console.error('Ejecuta `npm run docs` y sube los cambios generados.');
  process.exit(1);
}
