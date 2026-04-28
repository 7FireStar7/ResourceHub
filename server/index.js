// Загружаем переменные окружения из файла .env
require('dotenv').config();

// Подключаем необходимые библиотеки
const express = require('express');          // веб-сервер
const cors = require('cors');                // разрешает запросы с других доменов
const bcrypt = require('bcrypt');            // хеширование паролей
const jwt = require('jsonwebtoken');         // создание и проверка JWT-токенов
const pool = require('./db');                // пул соединений с PostgreSQL

const app = express();

// Middleware: разрешаем все кросс-доменные запросы (для разработки)
app.use(cors());
// Middleware: автоматически разбираем JSON в теле запросов
app.use(express.json());

// Порт сервера: берём из .env или используем 3001
const PORT = process.env.PORT || 3001;
// Секретный ключ для токенов (должен быть надёжным в продакшене)
const JWT_SECRET = process.env.JWT_SECRET;

// ============================================================
// Middleware для проверки токена
// Извлекает токен из заголовка Authorization, проверяет его
// и добавляет данные пользователя в объект req.user
// ============================================================
function authenticateToken(req, res, next) {
    // Ожидаем заголовок в формате: "Bearer <токен>"
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        // Токен отсутствует - 401 Unauthorized
        return res.status(401).json({ error: 'Требуется авторизация' });
    }

    // Проверяем токен с помощью секретного ключа
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            // Токен недействителен или истёк - 403 Forbidden
            return res.status(403).json({ error: 'Недействительный токен' });
        }
        // Сохраняем расшифрованные данные (userId, isAdmin) в запросе
        req.user = user;
        next(); // Передаём управление следующему обработчику
    });
}

// ============================================================
// Middleware для проверки прав администратора
// Должен использоваться ПОСЛЕ authenticateToken
// ============================================================
function requireAdmin(req, res, next) {
    if (!req.user || !req.user.isAdmin) {
        // Пользователь не админ - 403 Forbidden
        return res.status(403).json({ error: 'Доступ запрещён. Требуются права администратора.' });
    }
    next();
}

// ============================================================
// Маршруты аутентификации
// ============================================================

/**
 * Регистрация нового пользователя
 * Принимает: { full_name, email, password }
 * Возвращает: { token, user }
 */
app.post('/api/auth/register', async (req, res) => {
    const { full_name, email, password } = req.body;

    // Проверяем, что все поля заполнены
    if (!full_name || !email || !password) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }

    try {
        // Проверяем, не занят ли email
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }

        // Хешируем пароль (соль 10 раундов - оптимально)
        const hashedPassword = await bcrypt.hash(password, 10);

        // Сохраняем пользователя в БД
        const result = await pool.query(
            'INSERT INTO users (full_name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, full_name, email, is_admin',
            [full_name, email, hashedPassword]
        );
        const user = result.rows[0];

        // Создаём JWT-токен, который будет действовать 7 дней
        // В токене храним ID пользователя и признак админа
        const token = jwt.sign(
            { userId: user.id, isAdmin: user.is_admin },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Отправляем токен и информацию о пользователе (без пароля!)
        res.status(201).json({
            token,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                is_admin: user.is_admin
            }
        });
    } catch (err) {
        console.error('Ошибка при регистрации:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

/**
 * Вход пользователя
 * Принимает: { email, password }
 * Возвращает: { token, user }
 */
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    try {
        // Ищем пользователя по email
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            // Не говорим, что именно неверно - безопаснее
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        // Сравниваем введённый пароль с хешем в БД
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        // Генерируем токен с теми же данными
        const token = jwt.sign(
            { userId: user.id, isAdmin: user.is_admin },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                is_admin: user.is_admin
            }
        });
    } catch (err) {
        console.error('Ошибка при входе:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ============================================================
// Маршруты ресурсов (доступны всем авторизованным)
// ============================================================

/**
 * Получить список ВСЕХ ресурсов (даже неактивных, для админки)
 */
app.get('/api/resources', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM resources ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

/**
 * Получить занятые слоты для конкретного ресурса на выбранную дату
 * Параметры: id ресурса в URL, date в запросе (YYYY-MM-DD)
 */
app.get('/api/resources/:id/slots', authenticateToken, async (req, res) => {
    const resourceId = parseInt(req.params.id);
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ error: 'Параметр date обязателен (YYYY-MM-DD)' });
    }

    // Определяем начало и конец дня
    const startOfDay = new Date(`${date}T00:00:00`);
    const endOfDay = new Date(`${date}T23:59:59.999`);

    try {
        const result = await pool.query(
            `SELECT start_time, end_time, purpose, user_id, status
             FROM bookings
             WHERE resource_id = $1
               AND start_time >= $2 AND end_time <= $3
               AND status = 'active'
             ORDER BY start_time`,
            [resourceId, startOfDay, endOfDay]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ============================================================
// Административные маршруты для управления ресурсами
// ============================================================

/**
 * Создать новый ресурс (только админ)
 * Принимает: { name, description?, type?, capacity?, is_active? }
 */
app.post('/api/resources', authenticateToken, requireAdmin, async (req, res) => {
    const { name, description, type, capacity, is_active } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Название ресурса обязательно' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO resources (name, description, type, capacity, is_active)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [name, description || '', type || '', capacity || null, is_active !== undefined ? is_active : true]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при создании ресурса' });
    }
});

/**
 * Обновить существующий ресурс (только админ)
 * Обновляются только переданные поля (COALESCE сохраняет старые значения)
 */
app.put('/api/resources/:id', authenticateToken, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    const { name, description, type, capacity, is_active } = req.body;

    try {
        const existing = await pool.query('SELECT * FROM resources WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Ресурс не найден' });
        }

        const result = await pool.query(
            `UPDATE resources
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description),
                 type = COALESCE($3, type),
                 capacity = COALESCE($4, capacity),
                 is_active = COALESCE($5, is_active)
             WHERE id = $6
             RETURNING *`,
            [name, description, type, capacity, is_active, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при обновлении ресурса' });
    }
});

/**
 * Удалить ресурс (только админ).
 * Связанные бронирования удалятся каскадно (ON DELETE CASCADE).
 */
app.delete('/api/resources/:id', authenticateToken, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const result = await pool.query('DELETE FROM resources WHERE id = $1 RETURNING id', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Ресурс не найден' });
        }
        res.json({ message: 'Ресурс удалён' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при удалении ресурса' });
    }
});

// ============================================================
// Маршруты бронирований
// ============================================================

/**
 * Получить бронирования ТОЛЬКО текущего пользователя (все статусы)
 */
app.get('/api/bookings/me', authenticateToken, async (req, res) => {
    const userId = req.user.userId;  // ID из токена

    try {
        const result = await pool.query(
            `SELECT b.*, r.name as resource_name
             FROM bookings b
             JOIN resources r ON b.resource_id = r.id
             WHERE b.user_id = $1
             ORDER BY b.start_time DESC`,
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

/**
 * Создать бронирование
 * Проверяет, что ресурс существует и что нет пересечений с активными бронями.
 */
app.post('/api/bookings', authenticateToken, async (req, res) => {
    const { resource_id, start_time, end_time, purpose } = req.body;
    const userId = req.user.userId;

    // Проверка обязательных полей
    if (!resource_id || !start_time || !end_time) {
        return res.status(400).json({ error: 'resource_id, start_time, end_time обязательны' });
    }

    const start = new Date(start_time);
    const end = new Date(end_time);

    if (isNaN(start) || isNaN(end)) {
        return res.status(400).json({ error: 'Некорректный формат даты' });
    }
    if (start >= end) {
        return res.status(400).json({ error: 'Время начала должно быть раньше окончания' });
    }

    try {
        // Проверяем существование ресурса
        const resCheck = await pool.query('SELECT id FROM resources WHERE id = $1', [resource_id]);
        if (resCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Ресурс не найден' });
        }

        // Проверяем конфликт времени: ищем любую активную бронь, которая пересекается
        const conflict = await pool.query(
            `SELECT id FROM bookings
             WHERE resource_id = $1 AND status = 'active'
               AND tstzrange(start_time, end_time) && tstzrange($2, $3)`,
            [resource_id, start, end]
        );
        if (conflict.rows.length > 0) {
            return res.status(409).json({ error: 'Это время уже занято' });
        }

        // Создаём бронирование
        const result = await pool.query(
            `INSERT INTO bookings (user_id, resource_id, start_time, end_time, purpose)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [userId, resource_id, start, end, purpose || '']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        // Обрабатываем ошибку исключения (EXCLUDE) – если она возникла всё равно
        if (err.code === '23P01' || err.message.includes('exclusion')) {
            return res.status(409).json({ error: 'Конфликт: это время занято' });
        }
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

/**
 * Отменить бронирование (меняет статус на 'cancelled').
 * Может сделать владелец брони или администратор.
 */
app.delete('/api/bookings/:id', authenticateToken, async (req, res) => {
    const bookingId = parseInt(req.params.id);
    const userId = req.user.userId;
    const isAdmin = req.user.isAdmin;

    try {
        // Получаем владельца брони
        const bookingResult = await pool.query('SELECT user_id FROM bookings WHERE id = $1', [bookingId]);
        if (bookingResult.rows.length === 0) {
            return res.status(404).json({ error: 'Бронирование не найдено' });
        }

        const ownerId = bookingResult.rows[0].user_id;
        // Проверяем права: отменять может только автор или админ
        if (ownerId !== userId && !isAdmin) {
            return res.status(403).json({ error: 'Вы не можете отменить это бронирование' });
        }

        // "Мягкое" удаление – меняем статус
        await pool.query('UPDATE bookings SET status = $1 WHERE id = $2', ['cancelled', bookingId]);
        res.json({ message: 'Бронирование отменено' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при отмене' });
    }
});

/**
 * Завершить бронирование досрочно (статус 'completed').
 * Доступно владельцу или админу.
 */
app.put('/api/bookings/:id/complete', authenticateToken, async (req, res) => {
    const bookingId = parseInt(req.params.id);
    const userId = req.user.userId;
    const isAdmin = req.user.isAdmin;

    try {
        const bookingResult = await pool.query('SELECT user_id, status FROM bookings WHERE id = $1', [bookingId]);
        if (bookingResult.rows.length === 0) {
            return res.status(404).json({ error: 'Бронирование не найдено' });
        }

        const { user_id, status } = bookingResult.rows[0];
        // Проверка прав
        if (user_id !== userId && !isAdmin) {
            return res.status(403).json({ error: 'Вы не можете завершить это бронирование' });
        }
        // Бронь должна быть активной
        if (status !== 'active') {
            return res.status(400).json({ error: 'Бронь уже не активна' });
        }

        // Устанавливаем статус completed и фиксируем текущее время окончания
        await pool.query(
            `UPDATE bookings SET status = 'completed', end_time = NOW() WHERE id = $1`,
            [bookingId]
        );
        res.json({ message: 'Бронирование завершено' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при завершении' });
    }
});

// Простой эндпоинт для проверки, что сервер жив
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});