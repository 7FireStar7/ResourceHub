const { ResourceRequestDTO, ResourceResponseDTO } = require('../dtos/resource.dto');
const resourceService = require('../services/resource.service');

/**
 * @swagger
 * components:
 *   schemas:
 *     ResourceRequest:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         type:
 *           type: string
 *         capacity:
 *           type: integer
 *         is_active:
 *           type: boolean
 *         available_from:
 *           type: string
 *           format: date-time
 *         available_until:
 *           type: string
 *           format: date-time
 *     Resource:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         type:
 *           type: string
 *         capacity:
 *           type: integer
 *         is_active:
 *           type: boolean
 *         available_from:
 *           type: string
 *           format: date-time
 *         available_until:
 *           type: string
 *           format: date-time
 *     ResourceStatus:
 *       type: object
 *       properties:
 *         days:
 *           type: object
 *           additionalProperties:
 *             type: array
 *             items:
 *               $ref: '#/components/schemas/DayResource'
 *     DayResource:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         status:
 *           type: string
 *           enum: [free, partial, full, expired]
 *         available_from:
 *           type: string
 *           format: date-time
 *         available_until:
 *           type: string
 *           format: date-time
 *         is_active:
 *           type: boolean
 */

const resourceController = {
  /**
   * @swagger
   * /api/resources:
   *   get:
   *     summary: Получить список всех ресурсов
   *     tags: [Resources]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Массив ресурсов
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Resource'
   *       401:
   *         description: Требуется авторизация
   *       500:
   *         description: Ошибка сервера
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
   * @swagger
   * /api/resources/{id}/slots:
   *   get:
   *     summary: Получить занятые слоты ресурса на дату
   *     tags: [Resources]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *       - in: query
   *         name: date
   *         required: true
   *         schema:
   *           type: string
   *           format: date
   *     responses:
   *       200:
   *         description: Массив занятых слотов
   *       400:
   *         description: Не указан параметр date
   *       401:
   *         description: Требуется авторизация
   *       500:
   *         description: Ошибка сервера
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
   * @swagger
   * /api/resources/availability:
   *   get:
   *     summary: Получить статус ресурсов по дням месяца (календарь)
   *     tags: [Resources]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: year
   *         required: true
   *         schema:
   *           type: integer
   *       - in: query
   *         name: month
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Статусы по дням
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ResourceStatus'
   *       400:
   *         description: Неверные параметры
   *       401:
   *         description: Требуется авторизация
   *       500:
   *         description: Ошибка сервера
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
   * @swagger
   * /api/resources:
   *   post:
   *     summary: Создать новый ресурс (только админ)
   *     tags: [Resources]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ResourceRequest'
   *     responses:
   *       201:
   *         description: Созданный ресурс
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Resource'
   *       400:
   *         description: Ошибка валидации
   *       403:
   *         description: Доступ запрещён
   *       500:
   *         description: Ошибка сервера
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
   * @swagger
   * /api/resources/{id}:
   *   put:
   *     summary: Обновить ресурс (только админ)
   *     tags: [Resources]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ResourceRequest'
   *     responses:
   *       200:
   *         description: Обновлённый ресурс
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Resource'
   *       400:
   *         description: Ошибка валидации
   *       403:
   *         description: Доступ запрещён
   *       404:
   *         description: Ресурс не найден
   *       500:
   *         description: Ошибка сервера
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
   * @swagger
   * /api/resources/{id}:
   *   delete:
   *     summary: Удалить ресурс (только админ)
   *     tags: [Resources]
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
   *         description: Ресурс удалён
   *       403:
   *         description: Доступ запрещён
   *       404:
   *         description: Ресурс не найден
   *       500:
   *         description: Ошибка сервера
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