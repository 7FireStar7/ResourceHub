const { RegisterRequestDTO, LoginRequestDTO, UserResponseDTO } = require('../dtos/auth.dto');
const authService = require('../services/auth.service');

const authController = {
  /**
   * Регистрация нового пользователя
   */
  async register(req, res) {
    // 1. Создаём DTO и валидируем
    const dto = new RegisterRequestDTO(req.body);
    const errors = dto.validate();
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    try {
      // 2. Вызываем сервис
      const { user, token } = await authService.register(dto);

      // 3. Формируем ответ через DTO (скрывает пароль)
      return res.status(201).json({
        token,
        user: new UserResponseDTO(user)
      });
    } catch (err) {
      // Ожидаемые ошибки (email уже существует)
      if (err.message === 'Пользователь с таким email уже существует') {
        return res.status(400).json({ error: err.message });
      }
      console.error(err);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
  },

  /**
   * Вход пользователя
   */
  async login(req, res) {
    const dto = new LoginRequestDTO(req.body);
    const errors = dto.validate();
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    try {
      const { user, token } = await authService.login(dto);
      return res.json({
        token,
        user: new UserResponseDTO(user)
      });
    } catch (err) {
      if (err.message === 'Неверный email или пароль') {
        return res.status(401).json({ error: err.message });
      }
      console.error(err);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
};

module.exports = authController;