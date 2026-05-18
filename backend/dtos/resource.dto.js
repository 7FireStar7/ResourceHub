/**
 * DTO для создания/обновления ресурса.
 * Используется в админских маршрутах.
 */
class ResourceRequestDTO {
    constructor(body) {
        this.name = body.name?.trim();
        this.description = body.description?.trim() || '';
        this.type = body.type?.trim() || '';
        this.capacity = body.capacity ? parseInt(body.capacity) : null;
        this.is_active = body.is_active !== undefined ? body.is_active : true;
        this.available_from = body.available_from || null;
        this.available_until = body.available_until || null;
    }

    /**
     * Валидация полей.
     * Проверяет обязательность названия и корректность дат.
     */
    validate() {
        const errors = [];
        if (!this.name) errors.push('Название ресурса обязательно');
        if (this.available_from && this.available_until) {
            if (new Date(this.available_from) >= new Date(this.available_until)) {
                errors.push('Дата начала доступности должна быть раньше даты окончания');
            }
        }
        return errors;
    }
}

/**
 * DTO для ответа с данными ресурса (можно расширять при необходимости).
 */
class ResourceResponseDTO {
    constructor(resource) {
        this.id = resource.id;
        this.name = resource.name;
        this.description = resource.description;
        this.type = resource.type;
        this.capacity = resource.capacity;
        this.is_active = resource.is_active;
        this.available_from = resource.available_from;
        this.available_until = resource.available_until;
    }
}

module.exports = { ResourceRequestDTO, ResourceResponseDTO };