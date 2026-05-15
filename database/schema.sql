-- Установка расширения для GiST-индексов (нужен суперпользователь)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица ресурсов (переговорки, оборудование)
CREATE TABLE IF NOT EXISTS resources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(100),
    capacity INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица бронирований
CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    purpose TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    EXCLUDE USING GIST (
        resource_id WITH =,
        tstzrange(start_time, end_time) WITH &&
    )
);

-- Добавление новых полей для периода доступности
ALTER TABLE resources ADD COLUMN IF NOT EXISTS available_from TIMESTAMPTZ;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS available_until TIMESTAMPTZ;

--Нужно
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_resource_id_tstzrange_excl;

--Создаем частичный индекс для того, чтобы можно было создавать ресурсы на аналогичном месте отменнёного 
CREATE UNIQUE INDEX bookings_active_no_overlap
ON bookings (resource_id, tstzrange(start_time, end_time))
WHERE status = 'active';