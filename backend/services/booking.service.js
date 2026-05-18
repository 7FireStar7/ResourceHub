const pool = require('../db');

/**
 * Возвращает все бронирования текущего пользователя (любые статусы).
 * @param {number} userId
 * @returns {Promise<Array>}
 */
async function getMyBookings(userId) {
    const result = await pool.query(
        `SELECT b.*, r.name as resource_name
         FROM bookings b JOIN resources r ON b.resource_id = r.id
         WHERE b.user_id = $1
         ORDER BY b.start_time DESC`,
        [userId]
    );
    return result.rows;
}

/**
 * Создаёт бронирование с полной проверкой:
 * - существование и активность ресурса,
 * - вхождение времени в период доступности,
 * - отсутствие конфликтов с активными бронями.
 * @param {object} dto – проверенные данные (resource_id, start_time, end_time, purpose)
 * @param {number} userId
 * @returns {Promise<object>} созданная бронь
 */
async function createBooking(dto, userId) {
    // Проверка ресурса
    const resCheck = await pool.query('SELECT * FROM resources WHERE id = $1', [dto.resource_id]);
    if (resCheck.rows.length === 0) {
        throw new Error('Ресурс не найден');
    }

    const resource = resCheck.rows[0];

    if (!resource.is_active) {
        throw new Error('Ресурс неактивен, бронирование невозможно');
    }

    // Проверка доступности по времени ресурса
    const start = new Date(dto.start_time);
    const end = new Date(dto.end_time);

    if (resource.available_from && resource.available_until) {
        if (start < new Date(resource.available_from) || end > new Date(resource.available_until)) {
            throw new Error('Время бронирования выходит за пределы доступности ресурса');
        }
    }

    // Проверка конфликтов (только с активными бронями)
    const conflict = await pool.query(
        `SELECT id FROM bookings
         WHERE resource_id = $1 AND status = 'active'
           AND tstzrange(start_time, end_time) && tstzrange($2, $3)`,
        [dto.resource_id, start, end]
    );
    if (conflict.rows.length > 0) {
        throw new Error('Это время уже занято');
    }

    // Вставка бронирования
    const result = await pool.query(
        `INSERT INTO bookings (user_id, resource_id, start_time, end_time, purpose)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [userId, dto.resource_id, start, end, dto.purpose]
    );
    return result.rows[0];
}

/**
 * Отменяет бронирование (меняет статус на 'cancelled').
 * @param {number} bookingId
 * @param {number} userId
 * @param {boolean} isAdmin
 * @returns {Promise<void>}
 */
async function cancelBooking(bookingId, userId, isAdmin) {
    // Проверяем, кто владелец
    const bookingResult = await pool.query('SELECT user_id FROM bookings WHERE id = $1', [bookingId]);
    if (bookingResult.rows.length === 0) {
        throw new Error('Бронирование не найдено');
    }

    const ownerId = bookingResult.rows[0].user_id;
    if (ownerId !== userId && !isAdmin) {
        throw new Error('Вы не можете отменить это бронирование');
    }

    await pool.query('UPDATE bookings SET status = $1 WHERE id = $2', ['cancelled', bookingId]);
}

module.exports = { getMyBookings, createBooking, cancelBooking };