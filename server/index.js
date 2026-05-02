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

// ============================================================
// Аутентификация
// ============================================================

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
        console.error('Ошибка при регистрации:', err);
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
        console.error('Ошибка при входе:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ============================================================
// Ресурсы (CRUD + статус занятости)
// ============================================================

// Получить все ресурсы (для админки)
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

// ** Новый эндпоинт: статус ресурсов по дням месяца **
app.get('/api/resources/status', authenticateToken, async (req, res) => {
    const { year, month } = req.query;
    if (!year || !month) {
        return res.status(400).json({ error: 'Параметры year и month обязательны' });
    }

    const y = parseInt(year);
    const m = parseInt(month);
    if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
        return res.status(400).json({ error: 'Некорректный год или месяц' });
    }

    const startOfMonth = new Date(Date.UTC(y, m - 1, 1));
    const endOfMonth = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

    try {
        // Базовый запрос ресурсов, которые пересекаются с месяцем
        let resourcesQuery = `
            SELECT * FROM resources
            WHERE available_from IS NOT NULL
              AND available_until IS NOT NULL
              AND date(available_from) <= $1
              AND date(available_until) >= $2
        `;
        const queryParams = [endOfMonth, startOfMonth];

        // Для обычного пользователя фильтруем только активные ресурсы
        if (!req.user.isAdmin) {
            resourcesQuery += ' AND is_active = true';
        }

        const resourcesRes = await pool.query(resourcesQuery, queryParams);
        const resources = resourcesRes.rows;

        if (resources.length === 0) {
            return res.json({ days: {} });
        }

        // Получаем ВСЕ активные бронирования этих ресурсов за месяц
        const bookingsRes = await pool.query(
            `SELECT b.resource_id, b.start_time, b.end_time
             FROM bookings b
             WHERE b.resource_id = ANY($1)
               AND b.status = 'active'
               AND b.start_time < $2
               AND b.end_time > $3`,
            [resources.map(r => r.id), endOfMonth, startOfMonth]
        );
        const bookings = bookingsRes.rows;

        const bookingsByResource = {};
        for (const b of bookings) {
            if (!bookingsByResource[b.resource_id]) {
                bookingsByResource[b.resource_id] = [];
            }
            bookingsByResource[b.resource_id].push(b);
        }

        const days = {};
        const now = new Date();

        for (let d = new Date(startOfMonth); d <= endOfMonth; d.setUTCDate(d.getUTCDate() + 1)) {
            const dayStr = d.toISOString().slice(0, 10);
            const dayResources = [];

            for (const res of resources) {
                const availStart = new Date(res.available_from);
                const availEnd = new Date(res.available_until);
                const dayStart = new Date(dayStr + 'T00:00:00Z');
                const dayEnd = new Date(dayStr + 'T23:59:59.999Z');

                if (availStart > dayEnd || availEnd < dayStart) continue;

                // Определяем статус истёкшего периода
                if (availEnd < now) {
                    dayResources.push({
                        id: res.id,
                        name: res.name,
                        type: res.type,
                        capacity: res.capacity,
                        description: res.description,
                        status: 'expired',
                        available_from: res.available_from,
                        available_until: res.available_until,
                        is_active: res.is_active
                    });
                    continue;
                }

                // Рабочие часы в этот день
                const workStartHour = availStart.getUTCHours();
                const workStartMinute = availStart.getUTCMinutes();
                const workEndHour = availEnd.getUTCHours();
                const workEndMinute = availEnd.getUTCMinutes();

                const workStart = new Date(dayStr + 'T00:00:00Z');
                workStart.setUTCHours(workStartHour, workStartMinute, 0, 0);
                const workEnd = new Date(dayStr + 'T00:00:00Z');
                workEnd.setUTCHours(workEndHour, workEndMinute, 0, 0);

                if (workEnd <= workStart) continue;

                let slotsCount = 0;
                let occupiedSlots = 0;
                const slotStart = new Date(workStart);
                while (slotStart < workEnd) {
                    const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
                    if (slotEnd > workEnd) slotEnd.setTime(workEnd.getTime());

                    const resourceBookings = bookingsByResource[res.id] || [];
                    const isOccupied = resourceBookings.some(b => {
                        const bStart = new Date(b.start_time);
                        const bEnd = new Date(b.end_time);
                        return bStart < slotEnd && bEnd > slotStart;
                    });

                    if (isOccupied) occupiedSlots++;
                    slotsCount++;
                    slotStart.setTime(slotEnd.getTime());
                }

                let status;
                if (slotsCount === 0) {
                    status = 'free';
                } else if (occupiedSlots === 0) {
                    status = 'free';
                } else if (occupiedSlots === slotsCount) {
                    status = 'full';
                } else {
                    status = 'partial';
                }

                dayResources.push({
                    id: res.id,
                    name: res.name,
                    type: res.type,
                    capacity: res.capacity,
                    description: res.description,
                    status: status,
                    available_from: res.available_from,
                    available_until: res.available_until,
                    is_active: res.is_active
                });
            }

            if (dayResources.length > 0) {
                days[dayStr] = dayResources;
            }
        }

        res.json({ days });
    } catch (err) {
        console.error('Ошибка получения статуса ресурсов:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ======== АДМИНСКИЕ МАРШРУТЫ ДЛЯ РЕСУРСОВ ========

app.post('/api/resources', authenticateToken, requireAdmin, async (req, res) => {
    const { name, description, type, capacity, is_active, available_from, available_until } = req.body;
    if (!name) return res.status(400).json({ error: 'Название ресурса обязательно' });
    if (available_from && available_until) {
        if (new Date(available_from) >= new Date(available_until)) {
            return res.status(400).json({ error: 'Дата начала доступности должна быть раньше даты окончания' });
        }
    }

    try {
        const result = await pool.query(
            `INSERT INTO resources (name, description, type, capacity, is_active, available_from, available_until)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [name, description || '', type || '', capacity || null,
             is_active !== undefined ? is_active : true,
             available_from || null, available_until || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при создании ресурса' });
    }
});

app.put('/api/resources/:id', authenticateToken, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    const { name, description, type, capacity, is_active, available_from, available_until } = req.body;

    try {
        const existing = await pool.query('SELECT * FROM resources WHERE id = $1', [id]);
        if (existing.rows.length === 0) return res.status(404).json({ error: 'Ресурс не найден' });

        const result = await pool.query(
            `UPDATE resources
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description),
                 type = COALESCE($3, type),
                 capacity = COALESCE($4, capacity),
                 is_active = COALESCE($5, is_active),
                 available_from = COALESCE($6, available_from),
                 available_until = COALESCE($7, available_until)
             WHERE id = $8
             RETURNING *`,
            [name, description, type, capacity, is_active, available_from, available_until, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при обновлении ресурса' });
    }
});

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

// ============================================================
// Бронирования (с проверкой активности ресурса)
// ============================================================

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
        const resCheck = await pool.query('SELECT * FROM resources WHERE id = $1', [resource_id]);
        if (resCheck.rows.length === 0) return res.status(404).json({ error: 'Ресурс не найден' });

        const resource = resCheck.rows[0];

        // Проверка, что ресурс активен
        if (!resource.is_active) {
            return res.status(400).json({ error: 'Ресурс неактивен, бронирование невозможно' });
        }

        // Проверка вхождения времени в период доступности ресурса
        if (resource.available_from && resource.available_until) {
            if (start < resource.available_from || end > resource.available_until) {
                return res.status(400).json({ error: 'Время бронирования выходит за пределы доступности ресурса' });
            }
        }

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

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});