const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Регистрирует нового пользователя.
 * @param {object} dto - Нормализованные данные (full_name, email, password)
 * @returns {Promise<{user: object, token: string}>}
 */
async function register(dto) {
    // Проверка уникальности email
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [dto.email]);
    if (existing.rows.length > 0) {
        throw new Error('Пользователь с таким email уже существует');
    }

    // Хеширование пароля
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Вставка пользователя
    const result = await pool.query(
        'INSERT INTO users (full_name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, full_name, email, is_admin',
        [dto.full_name, dto.email, hashedPassword]
    );
    const user = result.rows[0];

    // Генерация токена
    const token = jwt.sign(
        { userId: user.id, isAdmin: user.is_admin },
        JWT_SECRET,
        { expiresIn: '7d' }
    );

    return { user, token };
}

/**
 * Аутентифицирует пользователя.
 * @param {object} dto - Нормализованные данные (email, password)
 * @returns {Promise<{user: object, token: string}>}
 */
async function login(dto) {
    // Поиск пользователя
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [dto.email]);
    const user = result.rows[0];
    if (!user) {
        throw new Error('Неверный email или пароль');
    }

    // Проверка пароля
    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) {
        throw new Error('Неверный email или пароль');
    }

    // Генерация токена
    const token = jwt.sign(
        { userId: user.id, isAdmin: user.is_admin },
        JWT_SECRET,
        { expiresIn: '7d' }
    );

    return { user, token };
}

module.exports = { register, login };