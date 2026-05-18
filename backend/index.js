require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const { authenticateToken, requireAdmin } = require('./middleware/auth.middleware');

const authController = require('./controllers/auth.controller');
const resourceController = require('./controllers/resource.controller');
const bookingController = require('./controllers/booking.controller');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// ---------- Swagger конфигурация ----------
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'ResourceHub API',
    version: '1.0.0',
    description: 'API для системы бронирования переговорок и оборудования',
  },
  servers: [
    {
      url: `http://localhost:${PORT}`,
      description: 'Локальный сервер',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
};

const options = {
  swaggerDefinition,
  // пути к файлам с JSDoc-аннотациями
  apis: ['./controllers/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ------------------------------------------------------
// Маршруты
// ------------------------------------------------------
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);

app.get('/api/resources', authenticateToken, resourceController.getAll);
app.get('/api/resources/availability', authenticateToken, resourceController.getStatus);
app.get('/api/resources/:id/slots', authenticateToken, resourceController.getSlots);

app.post('/api/resources', authenticateToken, requireAdmin, resourceController.create);
app.put('/api/resources/:id', authenticateToken, requireAdmin, resourceController.update);
app.delete('/api/resources/:id', authenticateToken, requireAdmin, resourceController.delete);

app.get('/api/bookings/me', authenticateToken, bookingController.getMine);
app.post('/api/bookings', authenticateToken, bookingController.create);
app.delete('/api/bookings/:id', authenticateToken, bookingController.cancel);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`📚 Swagger UI: http://localhost:${PORT}/api-docs`);
});