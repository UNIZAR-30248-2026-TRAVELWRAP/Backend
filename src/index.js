require('dotenv').config(); // Carga las variables del .env
const express = require('express');
const http = require('http'); // 1. Importar el módulo HTTP nativo
const { Server } = require('socket.io'); // 2. Importar Server de socket.io
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const invitationRoutes = require('./routes/invitationRoutes');
const viajeRoutes = require('./routes/viajeRoutes');
const votacionRoutes = require('./routes/votacionRoutes');
const actividadRoutes = require('./routes/actividadRoutes');
const direccionRoutes = require('./routes/direccionRoutes');
const votacionesSocket = require('./sockets/votacionesSocket');
const { comprobarToken } = require('./middleware/authMiddleware');
const viajeService = require('./services/viajeService');
const gastoRoutes = require('./routes/gastoRoutes');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const app = express();
// 3. Acoplar Express al servidor HTTP
const server = http.createServer(app); 
const PORT = process.env.PORT || 3000;
const swaggerDocument = YAML.load(path.join(__dirname, '../docs/openapi.yaml'));

// --- Configuración de Socket.io ---
// 4. Inicializar Socket.io pasando el servidor HTTP y configurando los CORS
const io = new Server(server, {
  cors: {
    origin: '*', // En producción, cambiar por la URL exacta del frontend (ej. 'http://localhost:5173')
    methods: ['GET', 'POST']
  }
});

// 5. Creación de los Namespaces específicos
const chatNamespace = io.of('/chat');
const votacionesNamespace = io.of('/votaciones');
const notificacionesNamespace = io.of('/notificaciones');

// Lógica básica para el chat
chatNamespace.on('connection', (socket) => {
  console.log(`Usuario conectado al namespace /chat [ID: ${socket.id}]`);
  
  socket.on('disconnect', () => {
    console.log(`Usuario desconectado del /chat [ID: ${socket.id}]`);
  });
});

// Votaciones en tiempo real: avisa a los miembros de un viaje cuando cambia una de sus votaciones
votacionesSocket.configurar(votacionesNamespace, {
  comprobarToken,
  esMiembro: async (cliente, usuarioId, viajeId) => {
    const { viaje, error } = await viajeService.obtener(cliente, usuarioId, viajeId);
    if (error) throw new Error('No se ha podido comprobar el viaje');
    return Boolean(viaje);
  },
});

// Lógica básica para las notificaciones
notificacionesNamespace.on('connection', (socket) => {
  console.log(`Usuario conectado al namespace /notificaciones [ID: ${socket.id}]`);
  
  socket.on('disconnect', () => {
    console.log(`Usuario desconectado de /notificaciones [ID: ${socket.id}]`);
  });
});

// --- Middlewares globales ---
// Solo el frontend puede llamar a la API REST. CORS_ORIGINS admite varios orígenes separados por comas;
// sin definir, se aceptan los del frontend en local (vite dev y vite preview)
const origenesPermitidos = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:4173')
  .split(',')
  .map((origen) => origen.trim())
  .filter(Boolean);
app.use(cors({ origin: origenesPermitidos }));
app.use(express.json()); // Permite leer req.body en formato JSON

// Accesible la documentación de la API desde http://localhost:3000/api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// --- Registro de rutas ---
app.use('/api/auth', authRoutes);
app.use('/api/viajes', viajeRoutes);
app.use('/api/viajes/:viajeId/votaciones', votacionRoutes);
app.use('/api/viajes/:viajeId/actividades', actividadRoutes);
app.use('/api/viajes/:viajeId/gastos', gastoRoutes);
app.use('/api/direcciones', direccionRoutes);
app.use('/api', invitationRoutes); // /api/viajes/:viajeId/invitacion y /api/invitaciones/:token/unirse

// Endpoint básico de comprobación (Health Check)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Servidor operativo' });
});

// --- Arranque del servidor ---
// 6. Usamos server.listen en lugar de app.listen
server.listen(PORT, () => {
  console.log(`Servidor Backend (REST y WebSockets) corriendo en http://localhost:${PORT}`);
});