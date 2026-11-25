# Tests del backend

Guía de cómo se prueba el backend de TravelWrap, cómo ejecutar los tests y qué criterio seguimos para decidir qué probar.

## Qué hay

- Se usa el ejecutor de tests integrado de Node (`node:test`) con `node:assert/strict`. No hay librerías de testing externas.
- Todos los tests están en la carpeta `test/`, un archivo por cada pieza del código: `xController.test.js`, `xService.test.js`, utilidades y sockets (`votacionesSocket.test.js`, `chatSocket.test.js`...).
- Estado a 25/11/2026: 682 tests, todos en verde, en unos 2-3 segundos.
- No hay tests de aceptación Cucumber en el backend: viven en el frontend (`Frontend/Frontend/tests_cucumber`). La colección de Postman (`docs/TravelWrap.postman_collection.json`) sirve para probar la API a mano.

## Cómo se ejecutan

Todos los tests:

```
npm test
```

Todos los tests con informe de cobertura (genera `coverage/lcov.info`, que usa SonarCloud):

```
npm run test:coverage
```

Un solo archivo:

```
node --test test/gastoService.test.js
```

Solo los tests cuyo nombre contenga un texto:

```
node --test --test-name-pattern="redondea" test/gastoController.test.js
```

Hace falta Node 22 o superior, como indica `package.json`.

## Cómo se escriben

- **Controladores:** el servicio se sustituye por un mock (`mock` de `node:test`) y se comprueba la validación de la entrada y la traducción de cada resultado del servicio a su código HTTP. Se usa una respuesta de Express falsa que guarda el código y el cuerpo enviados.
- **Servicios:** se sustituye el cliente de Supabase y se comprueba qué consulta se hace y cómo se interpreta la respuesta.
- **Utilidades:** funciones puras, se prueban con entradas y salidas directas.
- Cada test restaura los mocks al terminar (`afterEach` con `mock.restoreAll()`), para que no dependan unos de otros.
- Los identificadores de ejemplo (viaje, usuarios) son constantes UUID al principio del archivo.
- El nombre del test describe el comportamiento en español: «responde 409 si el viaje está finalizado o archivado».
- Se siguen las normas de `Reglas Codigo`: sin imports sin usar, sin variables sin leer y sin código comentado.

## Qué probamos y qué no (criterio de PB-70)

Solo lo esencial. Un test debe proteger algo que, si se rompe, nos importa. Se conserva:

1. El camino feliz de cada endpoint.
2. Un caso de error representativo de cada tipo (datos inválidos, no encontrado o sin permiso, conflicto de estado, fallo de la base de datos), no uno por endpoint.
3. Las reglas de negocio con lógica real: reparto y saldos de gastos, liquidación de deudas, orden de actividades, permisos del creador y de los miembros, estados del viaje, borrado de la cuenta, resumen del Wrap, OCR y rutas.

No se escriben, o se eliminan:

- La misma plantilla de errores repetida en cada endpoint (identificador que no es UUID, 500, 502, 404 de «no es miembro»). Con un caso representativo por archivo basta.
- Tests que repiten en otra capa lo que ya prueba una más cercana al código.

Cuando se quiera quitar un test, se comprueba antes con `npm run test:coverage` que no baja la cobertura de forma relevante.

## Cobertura

- Objetivo de la asignatura: al menos el 75 % del código con tests unitarios o de integración (nota notable).
- Tras PB-70: 92,5 % de líneas, 83,6 % de ramas y 92,6 % de funciones.
- La cobertura de SonarCloud se calcula a partir de `coverage/lcov.info`, con solo la carpeta `src/`.

## Integración continua

El pipeline (`.github/workflows/ci.yml`) comprueba la sintaxis de `src/index.js`, ejecuta `npm run test:coverage` y envía el resultado a SonarCloud. Un test que falle bloquea el pipeline.
