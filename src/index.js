require('dotenv').config(); // Carga las variables del .env
const express = require('express');
const cors = require('cors');
const tripRoutes = require('./routes/tripRoutes');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const swaggerDocument = YAML.load(path.join(__dirname, '../docs/openapi.yaml'));

// Middlewares globales
app.use(cors()); // Permite peticiones desde el frontend
app.use(express.json()); // Permite leer req.body en formato JSON
// Accesible la documentación de la API desde http://localhost:3000/api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Registro de rutas
app.use('/api/trips', tripRoutes);

// Endpoint básico de comprobación (Health Check)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Servidor operativo' });
});

// Arranque del servidor
app.listen(PORT, () => {
  console.log(`Servidor Backend corriendo en http://localhost:${PORT}`);
});