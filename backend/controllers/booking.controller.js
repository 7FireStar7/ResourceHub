const { BookingRequestDTO, BookingResponseDTO } = require('../dtos/booking.dto');
const bookingService = require('../services/booking.service');

const bookingController = {
  /**
   * Мои бронирования
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
   * Создание бронирования
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
   * Отмена бронирования
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