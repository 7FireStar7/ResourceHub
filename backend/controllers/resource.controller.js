const { ResourceRequestDTO, ResourceResponseDTO } = require('../dtos/resource.dto');
const resourceService = require('../services/resource.service');

const resourceController = {
  /**
   * Список всех ресурсов
   */
  async getAll(req, res) {
    try {
      const resources = await resourceService.getAllResources();
      return res.json(resources.map(r => new ResourceResponseDTO(r)));
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
  },

  /**
   * Занятые слоты ресурса на дату
   */
  async getSlots(req, res) {
    const { id } = req.params;
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'Параметр date обязателен (YYYY-MM-DD)' });
    }
    try {
      const slots = await resourceService.getResourceSlots(parseInt(id), date);
      return res.json(slots);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
  },

  /**
   * Статус ресурсов по дням месяца (для календаря)
   */
  async getStatus(req, res) {
    const { year, month } = req.query;
    if (!year || !month) {
      return res.status(400).json({ error: 'Параметры year и month обязательны' });
    }
    const y = parseInt(year);
    const m = parseInt(month);
    if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
      return res.status(400).json({ error: 'Некорректный год или месяц' });
    }

    try {
      const result = await resourceService.getResourcesStatus(y, m, req.user.isAdmin);
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
  },

  /**
   * Создание ресурса (только админ)
   */
  async create(req, res) {
    const dto = new ResourceRequestDTO(req.body);
    const errors = dto.validate();
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    try {
      const resource = await resourceService.createResource(dto);
      return res.status(201).json(new ResourceResponseDTO(resource));
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Ошибка при создании ресурса' });
    }
  },

  /**
   * Обновление ресурса (только админ)
   */
  async update(req, res) {
    const id = parseInt(req.params.id);
    const dto = new ResourceRequestDTO(req.body);
    const errors = dto.validate();
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    try {
      const resource = await resourceService.updateResource(id, dto);
      return res.json(new ResourceResponseDTO(resource));
    } catch (err) {
      if (err.message === 'Ресурс не найден') {
        return res.status(404).json({ error: err.message });
      }
      console.error(err);
      return res.status(500).json({ error: 'Ошибка при обновлении ресурса' });
    }
  },

  /**
   * Удаление ресурса (только админ)
   */
  async delete(req, res) {
    const id = parseInt(req.params.id);
    try {
      await resourceService.deleteResource(id);
      return res.json({ message: 'Ресурс удалён' });
    } catch (err) {
      if (err.message === 'Ресурс не найден') {
        return res.status(404).json({ error: err.message });
      }
      console.error(err);
      return res.status(500).json({ error: 'Ошибка при удалении ресурса' });
    }
  }
};

module.exports = resourceController;