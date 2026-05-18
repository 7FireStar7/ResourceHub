require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Middleware для проверки токена и прав администратора
const { authenticateToken, requireAdmin } = require('./middleware/auth.middleware');

// Контроллеры
const authController = require('./controllers/auth.controller');
const resourceController = require('./controllers/resource.controller');
const bookingController = require('./controllers/booking.controller');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// ------------------------------------------------------
// Аутентификация
// ------------------------------------------------------
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);

// ------------------------------------------------------
// Ресурсы (требуют авторизации)
// ------------------------------------------------------
app.get('/api/resources', authenticateToken, resourceController.getAll);
app.get('/api/resources/status', authenticateToken, resourceController.getStatus);
app.get('/api/resources/:id/slots', authenticateToken, resourceController.getSlots);

// Административные операции с ресурсами
app.post('/api/resources', authenticateToken, requireAdmin, resourceController.create);
app.put('/api/resources/:id', authenticateToken, requireAdmin, resourceController.update);
app.delete('/api/resources/:id', authenticateToken, requireAdmin, resourceController.delete);

// ------------------------------------------------------
// Бронирования
// ------------------------------------------------------
app.get('/api/bookings/me', authenticateToken, bookingController.getMine);
app.post('/api/bookings', authenticateToken, bookingController.create);
app.delete('/api/bookings/:id', authenticateToken, bookingController.cancel);

// Проверка здоровья сервера
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});