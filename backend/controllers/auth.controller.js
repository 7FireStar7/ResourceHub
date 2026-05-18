const { RegisterRequestDTO, LoginRequestDTO, UserResponseDTO } = require('../dtos/auth.dto');
const authService = require('../services/auth.service');

/**
 * @swagger
 * components:
 *   schemas:
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - full_name
 *         - email
 *         - password
 *       properties:
 *         full_name:
 *           type: string
 *         email:
 *           type: string
 *         password:
 *           type: string
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *         password:
 *           type: string
 *     AuthResponse:
 *       type: object
 *       properties:
 *         token:
 *           type: string
 *         user:
 *           $ref: '#/components/schemas/User'
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         full_name:
 *           type: string
 *         email:
 *           type: string
 *         is_admin:
 *           type: boolean
 */

const authController = {
  /**
   * @swagger
   * /api/auth/register:
   *   post:
   *     summary: Регистрация нового пользователя
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/RegisterRequest'
   *     responses:
   *       201:
   *         description: Успешная регистрация
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuthResponse'
   *       400:
   *         description: Ошибка валидации
   *       500:
   *         description: Ошибка сервера
   */
  async register(req, res) {
    const dto = new RegisterRequestDTO(req.body);
    const errors = dto.validate();
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    try {
      const { user, token } = await authService.register(dto);
      return res.status(201).json({
        token,
        user: new UserResponseDTO(user)
      });
    } catch (err) {
      if (err.message === 'Пользователь с таким email уже существует') {
        return res.status(400).json({ error: err.message });
      }
      console.error(err);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
  },

  /**
   * @swagger
   * /api/auth/login:
   *   post:
   *     summary: Вход пользователя
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/LoginRequest'
   *     responses:
   *       200:
   *         description: Успешный вход
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuthResponse'
   *       400:
   *         description: Ошибка валидации
   *       401:
   *         description: Неверный email или пароль
   *       500:
   *         description: Ошибка сервера
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