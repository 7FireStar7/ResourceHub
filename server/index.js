require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware проверки токена
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Требуется авторизация' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Недействительный токен' });
        req.user = user; // { userId, isAdmin }
        next();
    });
}

// Middleware проверки администратора
function requireAdmin(req, res, next) {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ error: 'Доступ запрещён. Требуются права администратора.' });
    }
    next();
}

// ======== АУТЕНТИФИКАЦИЯ (без изменений) ========
app.post('/api/auth/register', async (req, res) => {
    const { full_name, email, password } = req.body;
    if (!full_name || !email || !password)
        return res.status(400).json({ error: 'Все поля обязательны' });

    try {
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0)
            return res.status(400).json({ error: 'Пользователь с таким email уже существует' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (full_name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, full_name, email, is_admin',
            [full_name, email, hashedPassword]
        );
        const user = result.rows[0];

        const token = jwt.sign({ userId: user.id, isAdmin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ token, user: { id: user.id, full_name: user.full_name, email: user.email, is_admin: user.is_admin } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];
        if (!user) return res.status(401).json({ error: 'Неверный email или пароль' });

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Неверный email или пароль' });

        const token = jwt.sign({ userId: user.id, isAdmin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, full_name: user.full_name, email: user.email, is_admin: user.is_admin } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ======== РЕСУРСЫ ========

// Получить все ресурсы (доступно всем авторизованным)
app.get('/api/resources', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM resources ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Занятые слоты ресурса на дату
app.get('/api/resources/:id/slots', authenticateToken, async (req, res) => {
    const resourceId = parseInt(req.params.id);
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Параметр date обязателен (YYYY-MM-DD)' });

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

// ======== АДМИНСКИЕ МАРШРУТЫ ДЛЯ РЕСУРСОВ ========

// Создать ресурс (только админ)
app.post('/api/resources', authenticateToken, requireAdmin, async (req, res) => {
    const { name, description, type, capacity, is_active } = req.body;
    if (!name) return res.status(400).json({ error: 'Название ресурса обязательно' });

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

// Обновить ресурс (только админ)
app.put('/api/resources/:id', authenticateToken, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    const { name, description, type, capacity, is_active } = req.body;

    try {
        const existing = await pool.query('SELECT * FROM resources WHERE id = $1', [id]);
        if (existing.rows.length === 0) return res.status(404).json({ error: 'Ресурс не найден' });

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

// Удалить ресурс (только админ)
app.delete('/api/resources/:id', authenticateToken, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const result = await pool.query('DELETE FROM resources WHERE id = $1 RETURNING id', [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Ресурс не найден' });
        res.json({ message: 'Ресурс удалён' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при удалении ресурса' });
    }
});

// ======== БРОНИРОВАНИЯ (без изменений) ========
app.get('/api/bookings/me', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const result = await pool.query(
            `SELECT b.*, r.name as resource_name
             FROM bookings b JOIN resources r ON b.resource_id = r.id
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

app.post('/api/bookings', authenticateToken, async (req, res) => {
    const { resource_id, start_time, end_time, purpose } = req.body;
    const userId = req.user.userId;
    if (!resource_id || !start_time || !end_time)
        return res.status(400).json({ error: 'resource_id, start_time, end_time обязательны' });

    const start = new Date(start_time);
    const end = new Date(end_time);
    if (isNaN(start) || isNaN(end)) return res.status(400).json({ error: 'Некорректный формат даты' });
    if (start >= end) return res.status(400).json({ error: 'Время начала должно быть раньше окончания' });

    try {
        const resCheck = await pool.query('SELECT id FROM resources WHERE id = $1', [resource_id]);
        if (resCheck.rows.length === 0) return res.status(404).json({ error: 'Ресурс не найден' });

        const conflict = await pool.query(
            `SELECT id FROM bookings
             WHERE resource_id = $1 AND status = 'active'
               AND tstzrange(start_time, end_time) && tstzrange($2, $3)`,
            [resource_id, start, end]
        );
        if (conflict.rows.length > 0) return res.status(409).json({ error: 'Это время уже занято' });

        const result = await pool.query(
            `INSERT INTO bookings (user_id, resource_id, start_time, end_time, purpose)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [userId, resource_id, start, end, purpose || '']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        if (err.code === '23P01' || err.message.includes('exclusion'))
            return res.status(409).json({ error: 'Конфликт: это время занято' });
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.delete('/api/bookings/:id', authenticateToken, async (req, res) => {
    const bookingId = parseInt(req.params.id);
    const userId = req.user.userId;
    const isAdmin = req.user.isAdmin;

    try {
        const bookingResult = await pool.query('SELECT user_id FROM bookings WHERE id = $1', [bookingId]);
        if (bookingResult.rows.length === 0) return res.status(404).json({ error: 'Бронирование не найдено' });

        const ownerId = bookingResult.rows[0].user_id;
        if (ownerId !== userId && !isAdmin) return res.status(403).json({ error: 'Вы не можете отменить это бронирование' });

        await pool.query('UPDATE bookings SET status = $1 WHERE id = $2', ['cancelled', bookingId]);
        res.json({ message: 'Бронирование отменено' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при отмене' });
    }
});

app.put('/api/bookings/:id/complete', authenticateToken, async (req, res) => {
    const bookingId = parseInt(req.params.id);
    const userId = req.user.userId;
    const isAdmin = req.user.isAdmin;

    try {
        const bookingResult = await pool.query('SELECT user_id, status FROM bookings WHERE id = $1', [bookingId]);
        if (bookingResult.rows.length === 0) return res.status(404).json({ error: 'Бронирование не найдено' });

        const { user_id, status } = bookingResult.rows[0];
        if (user_id !== userId && !isAdmin) return res.status(403).json({ error: 'Вы не можете завершить это бронирование' });
        if (status !== 'active') return res.status(400).json({ error: 'Бронь уже не активна' });

        await pool.query(`UPDATE bookings SET status = 'completed', end_time = NOW() WHERE id = $1`, [bookingId]);
        res.json({ message: 'Бронирование завершено' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при завершении' });
    }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`🚀 Сервер запущен на http://localhost:${PORT}`));