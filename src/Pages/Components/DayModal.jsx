import './DayModal.css';

/**
 * Модальное окно дня – показывает список ресурсов в выбранной ячейке календаря.
 * Получает все данные и колбэки через props.
 *
 * @param {object} props
 * @param {string} props.selectedDay – дата в формате YYYY-MM-DD
 * @param {Array} props.dayResources – массив ресурсов этого дня
 * @param {boolean} props.isAdmin – флаг администратора
 * @param {function} props.onClose – закрыть окно
 * @param {function} props.onBooking – начать бронирование ресурса (получает объект ресурса)
 * @param {function} props.onEditResource – редактировать ресурс (получает объект ресурса)
 * @param {function} props.onDeleteResource – удалить ресурс (получает объект ресурса)
 * @param {function} props.onAddResource – создать новый ресурс на этот день (только для админа)
 */
function DayModal({
  selectedDay,
  dayResources,
  isAdmin,
  onClose,
  onBooking,
  onEditResource,
  onDeleteResource,
  onAddResource
}) {
  // Цветной кружок статуса (дублируется из Calendar, но для независимости компонента лучше оставить)
  const StatusDot = ({ status, isActive = true }) => {
    let color;
    if (!isActive) {
      color = '#BDBDBD';
    } else if (status === 'free') {
      color = '#4CAF50';
    } else if (status === 'partial') {
      color = '#FF9800';
    } else if (status === 'full') {
      color = '#F44336';
    } else if (status === 'expired') {
      color = '#9E9E9E';
    } else {
      color = '#BDBDBD';
    }
    return <span className="status-dot" style={{ backgroundColor: color }} />;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content day-modal" onClick={e => e.stopPropagation()}>
        <h2>{new Date(selectedDay).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}</h2>
        {dayResources.length === 0 ? (
          isAdmin ? (
            <div>
              <p>Нет ресурсов</p>
              <button className="submit-btn" onClick={() => { onClose(); onAddResource(); }}>
                Создать ресурс на этот день
              </button>
            </div>
          ) : (
            <p>Нет доступных ресурсов</p>
          )
        ) : (
          <ul className="resource-day-list">
            {dayResources.map(r => (
              <li key={r.id} className={!r.is_active ? 'inactive' : ''}>
                <StatusDot status={r.status} isActive={r.is_active} />
                <span className="resource-info">
                  <strong>{r.name}</strong> ({r.type || 'не указан'})
                  {!r.is_active && <em className="inactive-label"> (Неактивен)</em>}
                  {r.status === 'expired' && <em className="expired-label"> (истёк)</em>}
                </span>
                <div className="resource-actions">
                  {r.is_active && r.status !== 'expired' && (
                    <button className="submit-btn" onClick={() => onBooking(r)}>Забронировать</button>
                  )}
                  {isAdmin && (
                    <>
                      <button className="complete-book-btn" onClick={() => { onClose(); onEditResource(r); }}>Редактировать</button>
                      <button className="cancel-book-btn" onClick={() => { onClose(); onDeleteResource(r); }}>Удалить</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default DayModal;