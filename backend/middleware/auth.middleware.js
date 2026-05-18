const jwt = require('jsonwebtoken');

// Секретный ключ (из переменных окружения)
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware для проверки JWT-токена.
 * Извлекает токен из заголовка Authorization, проверяет его
 * и добавляет данные пользователя (userId, isAdmin) в объект req.user.
 */
function authenticateToken(req, res, next) {
    // Ожидаем заголовок в формате: "Bearer <токен>"
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Недействительный токен' });
        }
        // Сохраняем расшифрованные данные в запросе
        req.user = user; // { userId, isAdmin, iat, exp }
        next();
    });
}

/**
 * Middleware для проверки прав администратора.
 * Должен использоваться ПОСЛЕ authenticateToken.
 */
function requireAdmin(req, res, next) {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ error: 'Доступ запрещён. Требуются права администратора.' });
    }
    next();
}

module.exports = { authenticateToken, requireAdmin };