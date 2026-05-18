const { BookingRequestDTO, BookingResponseDTO } = require('../dtos/booking.dto');
const bookingService = require('../services/booking.service');

/**
 * @swagger
 * components:
 *   schemas:
 *     BookingRequest:
 *       type: object
 *       required:
 *         - resource_id
 *         - start_time
 *         - end_time
 *       properties:
 *         resource_id:
 *           type: integer
 *         start_time:
 *           type: string
 *           format: date-time
 *         end_time:
 *           type: string
 *           format: date-time
 *         purpose:
 *           type: string
 *     BookingResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         resource_id:
 *           type: integer
 *         user_id:
 *           type: integer
 *         start_time:
 *           type: string
 *           format: date-time
 *         end_time:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *         purpose:
 *           type: string
 *         resource_name:
 *           type: string
 */

const bookingController = {
  /**
   * @swagger
   * /api/bookings/me:
   *   get:
   *     summary: Получить бронирования текущего пользователя
   *     tags: [Bookings]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Массив бронирований
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/BookingResponse'
   *       401:
   *         description: Требуется авторизация
   *       500:
   *         description: Ошибка сервера
   */
  async getMine(req, res) {
    try {
      const bookings = await bookingService.getMyBookings(req.user.userId);
      return res.json(bookings.map(b => new BookingResponseDTO(b)));
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
  },

  /**
   * @swagger
   * /api/bookings:
   *   post:
   *     summary: Создать бронирование
   *     tags: [Bookings]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/BookingRequest'
   *     responses:
   *       201:
   *         description: Созданное бронирование
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/BookingResponse'
   *       400:
   *         description: Ошибка валидации или ресурс неактивен/время недоступно
   *       404:
   *         description: Ресурс не найден
   *       409:
   *         description: Время уже занято
   *       500:
   *         description: Ошибка сервера
   */
  async create(req, res) {
    const dto = new BookingRequestDTO(req.body);
    const errors = dto.validate();
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    try {
      const booking = await bookingService.createBooking(dto, req.user.userId);
      return res.status(201).json(new BookingResponseDTO(booking));
    } catch (err) {
      const message = err.message;
      if (message === 'Ресурс не найден') return res.status(404).json({ error: message });
      if (message === 'Ресурс неактивен, бронирование невозможно') return res.status(400).json({ error: message });
      if (message === 'Время бронирования выходит за пределы доступности ресурса') return res.status(400).json({ error: message });
      if (message === 'Это время уже занято') return res.status(409).json({ error: message });
      console.error(err);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
  },

  /**
   * @swagger
   * /api/bookings/{id}:
   *   delete:
   *     summary: Отменить бронирование
   *     tags: [Bookings]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Бронирование отменено
   *       403:
   *         description: Нет прав
   *       404:
   *         description: Бронирование не найдено
   *       500:
   *         description: Ошибка сервера
   */
  async cancel(req, res) {
    const bookingId = parseInt(req.params.id);
    try {
      await bookingService.cancelBooking(bookingId, req.user.userId, req.user.isAdmin);
      return res.json({ message: 'Бронирование отменено' });
    } catch (err) {
      const message = err.message;
      if (message === 'Бронирование не найдено') return res.status(404).json({ error: message });
      if (message === 'Вы не можете отменить это бронирование') return res.status(403).json({ error: message });
      console.error(err);
      return res.status(500).json({ error: 'Ошибка при отмене' });
    }
  }
};

module.exports = bookingController;