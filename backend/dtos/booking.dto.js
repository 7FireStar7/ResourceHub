/**
 * DTO для запроса на создание бронирования.
 */
class BookingRequestDTO {
    constructor(body) {
        this.resource_id = body.resource_id ? parseInt(body.resource_id) : null;
        this.start_time = body.start_time;
        this.end_time = body.end_time;
        this.purpose = body.purpose?.trim() || '';
    }

    validate() {
        const errors = [];
        if (!this.resource_id) errors.push('resource_id обязателен');
        if (!this.start_time) errors.push('start_time обязателен');
        if (!this.end_time) errors.push('end_time обязателен');
        if (this.start_time && this.end_time) {
            const start = new Date(this.start_time);
            const end = new Date(this.end_time);
            if (isNaN(start) || isNaN(end)) {
                errors.push('Некорректный формат даты');
            } else if (start >= end) {
                errors.push('Время начала должно быть раньше окончания');
            }
        }
        return errors;
    }
}

/**
 * DTO для ответа с данными бронирования.
 */
class BookingResponseDTO {
    constructor(booking) {
        this.id = booking.id;
        this.resource_id = booking.resource_id;
        this.user_id = booking.user_id;
        this.start_time = booking.start_time;
        this.end_time = booking.end_time;
        this.status = booking.status;
        this.purpose = booking.purpose;
        // если есть связанное имя ресурса, добавим и его
        this.resource_name = booking.resource_name || null;
    }
}

module.exports = { BookingRequestDTO, BookingResponseDTO };