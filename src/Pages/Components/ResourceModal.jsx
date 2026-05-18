import './BookingModal.css';  // общие стили модальных окон

/**
 * Модальное окно создания / редактирования ресурса.
 * Используется только администратором.
 *
 * @param {object} props
 * @param {object|null} props.editingResource – ресурс для редактирования или null (создание)
 * @param {object} props.resForm – состояние формы
 * @param {function} props.onFormChange – callback для обновления отдельного поля
 * @param {function} props.onAutoResize – callback для автовысоты textarea
 * @param {string} props.resFormError – текст ошибки
 * @param {boolean} props.resFormLoading – индикатор загрузки
 * @param {function} props.onSubmit – обработчик отправки формы
 * @param {function} props.onClose – закрыть окно
 */
function ResourceModal({
  editingResource,
  resForm,
  onFormChange,
  onAutoResize,
  resFormError,
  resFormLoading,
  onSubmit,
  onClose
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>{editingResource ? 'Редактировать ресурс' : 'Новый ресурс'}</h2>
        <form onSubmit={onSubmit} className="booking-form">
          <div className="field">
            <label>Название *</label>
            <input
              type="text"
              value={resForm.name}
              onChange={e => onFormChange('name', e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Тип</label>
            <input
              type="text"
              placeholder="переговорка, оборудование..."
              value={resForm.type}
              onChange={e => onFormChange('type', e.target.value)}
            />
          </div>
          <div className="field">
            <label>Вместимость</label>
            <input
              type="number"
              value={resForm.capacity}
              onChange={e => onFormChange('capacity', e.target.value)}
            />
          </div>
          <div className="field">
            <label>Описание</label>
            <textarea
              rows={3}
              value={resForm.description}
              onChange={e => {
                onFormChange('description', e.target.value);
                onAutoResize(e);
              }}
              style={{ minHeight: '5rem' }}
            />
          </div>
          <div className="field">
            <label>Доступность с</label>
            <input
              type="datetime-local"
              value={resForm.available_from}
              onChange={e => onFormChange('available_from', e.target.value)}
            />
          </div>
          <div className="field">
            <label>Доступность по</label>
            <input
              type="datetime-local"
              value={resForm.available_until}
              onChange={e => onFormChange('available_until', e.target.value)}
            />
          </div>
          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={resForm.is_active}
                onChange={e => onFormChange('is_active', e.target.checked)}
              />{' '}
              Активен
            </label>
          </div>
          {resFormError && <p className="error-message">{resFormError}</p>}
          <div className="modal-actions">
            <button type="submit" className="submit-btn" disabled={resFormLoading}>
              {resFormLoading ? 'Сохранение...' : editingResource ? 'Сохранить' : 'Создать'}
            </button>
            <button type="button" className="cancel-btn" onClick={onClose}>Отмена</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ResourceModal;