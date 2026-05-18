/**
 * DTO (Data Transfer Object) для запроса регистрации.
 * Принимает сырой объект req.body, нормализует и валидирует данные.
 */
class RegisterRequestDTO {
    constructor(body) {
        this.full_name = body.full_name?.trim();
        this.email = body.email?.trim().toLowerCase();
        this.password = body.password;
    }

    /**
     * Проверяет корректность полей.
     * Возвращает массив строк с ошибками (пустой, если всё хорошо).
     */
    validate() {
        const errors = [];
        if (!this.full_name) errors.push('full_name обязателен');
        if (!this.email || !this.email.includes('@')) errors.push('Некорректный email');
        if (!this.password || this.password.length < 6) errors.push('Пароль должен быть не менее 6 символов');
        return errors;
    }
}

/**
 * DTO для запроса входа.
 */
class LoginRequestDTO {
    constructor(body) {
        this.email = body.email?.trim().toLowerCase();
        this.password = body.password;
    }

    validate() {
        const errors = [];
        if (!this.email) errors.push('email обязателен');
        if (!this.password) errors.push('Пароль обязателен');
        return errors;
    }
}

/**
 * DTO для ответа с данными пользователя.
 * Гарантирует, что пароль никогда не попадёт в ответ.
 */
class UserResponseDTO {
    constructor(user) {
        this.id = user.id;
        this.full_name = user.full_name;
        this.email = user.email;
        this.is_admin = user.is_admin;
    }
}

module.exports = { RegisterRequestDTO, LoginRequestDTO, UserResponseDTO };