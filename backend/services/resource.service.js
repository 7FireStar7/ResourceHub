const pool = require('../db');

/**
 * Получает список всех ресурсов.
 */
async function getAllResources() {
    const result = await pool.query('SELECT * FROM resources ORDER BY id');
    return result.rows;
}

/**
 * Получает один ресурс по ID (для проверки существования).
 */
async function getResourceById(id) {
    const result = await pool.query('SELECT * FROM resources WHERE id = $1', [id]);
    return result.rows[0] || null;
}

/**
 * Создаёт новый ресурс.
 * @param {object} dto – проверенные данные
 * @returns {Promise<object>} созданный ресурс
 */
async function createResource(dto) {
    const result = await pool.query(
        `INSERT INTO resources (name, description, type, capacity, is_active, available_from, available_until)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [dto.name, dto.description, dto.type, dto.capacity,
         dto.is_active, dto.available_from, dto.available_until]
    );
    return result.rows[0];
}

/**
 * Обновляет существующий ресурс.
 * @param {number} id
 * @param {object} dto – объект с полями для обновления
 * @returns {Promise<object>} обновлённый ресурс
 */
async function updateResource(id, dto) {
    // Убедимся, что ресурс существует
    const existing = await pool.query('SELECT * FROM resources WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
        throw new Error('Ресурс не найден');
    }

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
        [dto.name, dto.description, dto.type, dto.capacity,
         dto.is_active, dto.available_from, dto.available_until, id]
    );
    return result.rows[0];
}

/**
 * Удаляет ресурс по ID.
 * @returns {Promise<boolean>} true, если удалён
 */
async function deleteResource(id) {
    const result = await pool.query('DELETE FROM resources WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
        throw new Error('Ресурс не найден');
    }
    return true;
}

/**
 * Получает занятые слоты (активные брони) для ресурса на конкретную дату.
 * @param {number} resourceId
 * @param {string} date – в формате YYYY-MM-DD
 * @returns {Promise<Array>}
 */
async function getResourceSlots(resourceId, date) {
    const startOfDay = new Date(`${date}T00:00:00`);
    const endOfDay = new Date(`${date}T23:59:59.999`);

    const result = await pool.query(
        `SELECT start_time, end_time, purpose, user_id, status
         FROM bookings
         WHERE resource_id = $1
           AND start_time >= $2 AND end_time <= $3
           AND status = 'active'
         ORDER BY start_time`,
        [resourceId, startOfDay, endOfDay]
    );
    return result.rows;
}

/**
 * Основная функция для календаря: возвращает статус ресурсов по дням месяца.
 * @param {number} year
 * @param {number} month
 * @param {boolean} isAdmin
 * @returns {Promise<object>} объект вида { days: { 'YYYY-MM-DD': [...] } }
 */
async function getResourcesStatus(year, month, isAdmin) {
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    // Запрос ресурсов, пересекающихся с месяцем
    let resourcesQuery = `
        SELECT * FROM resources
        WHERE available_from IS NOT NULL
          AND available_until IS NOT NULL
          AND date(available_from) <= $1
          AND date(available_until) >= $2
    `;
    const queryParams = [endOfMonth, startOfMonth];

    if (!isAdmin) {
        resourcesQuery += ' AND is_active = true';
    }

    const resourcesRes = await pool.query(resourcesQuery, queryParams);
    const resources = resourcesRes.rows;

    if (resources.length === 0) {
        return { days: {} };
    }

    // Все активные бронирования этих ресурсов за месяц
    const bookingsRes = await pool.query(
        `SELECT b.resource_id, b.start_time, b.end_time
         FROM bookings b
         WHERE b.resource_id = ANY($1)
           AND b.status = 'active'
           AND b.start_time < $2
           AND b.end_time > $3`,
        [resources.map(r => r.id), endOfMonth, startOfMonth]
    );

    // Группируем бронирования по resource_id для быстрого поиска
    const bookingsByResource = {};
    for (const b of bookingsRes.rows) {
        if (!bookingsByResource[b.resource_id]) {
            bookingsByResource[b.resource_id] = [];
        }
        bookingsByResource[b.resource_id].push(b);
    }

    const days = {};
    const now = new Date();

    // Перебираем каждый день месяца
    for (let d = new Date(startOfMonth); d <= endOfMonth; d.setUTCDate(d.getUTCDate() + 1)) {
        const dayStr = d.toISOString().slice(0, 10);
        const dayResources = [];

        for (const res of resources) {
            const availStart = new Date(res.available_from);
            const availEnd = new Date(res.available_until);
            const dayStart = new Date(dayStr + 'T00:00:00Z');
            const dayEnd = new Date(dayStr + 'T23:59:59.999Z');

            // Ресурс не активен в этот день
            if (availStart > dayEnd || availEnd < dayStart) continue;

            // Период истёк
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

            // Подсчёт занятых и свободных слотов (по часам)
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

    return { days };
}

module.exports = {
    getAllResources,
    getResourceById,
    createResource,
    updateResource,
    deleteResource,
    getResourceSlots,
    getResourcesStatus
};