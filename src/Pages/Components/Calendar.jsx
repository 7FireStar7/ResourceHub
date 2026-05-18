import './Calendar.css';

/**
 * Презентационный компонент календаря.
 * Получает все данные и колбэки через props.
 *
 * @param {object} props
 * @param {Array} props.cells – массив ячеек { day, dateStr, resources } или null
 * @param {number} props.numWeeks – количество недель в отображаемом месяце
 * @param {Date} props.currentDate – текущая дата (для навигации)
 * @param {function} props.onChangeMonth – callback(смещение) для переключения месяца
 * @param {function} props.onDayClick – callback(дата-строка) при клике на ячейку дня
 */
function Calendar({ cells, numWeeks, currentDate, onChangeMonth, onDayClick }) {
  // Цветной кружок статуса
  const StatusDot = ({ status, isActive = true }) => {
    let color;
    if (!isActive) {
      color = '#BDBDBD'; // серый для неактивных
    } else if (status === 'free') {
      color = '#4CAF50'; // зелёный
    } else if (status === 'partial') {
      color = '#FF9800'; // оранжевый
    } else if (status === 'full') {
      color = '#F44336'; // красный
    } else if (status === 'expired') {
      color = '#9E9E9E'; // истёкший
    } else {
      color = '#BDBDBD';
    }
    return <span className="status-dot" style={{ backgroundColor: color }} />;
  };

  return (
    <div className="calendar-container">
      {/* Навигация по месяцам */}
      <div className="calendar-nav">
        <button onClick={() => onChangeMonth(-1)}>&lt;</button>
        <h3>
          {currentDate.toLocaleDateString('ru', { month: 'long', year: 'numeric' })}
        </h3>
        <button onClick={() => onChangeMonth(1)}>&gt;</button>
      </div>

      {/* Сетка календаря */}
      <div className="calendar-grid">
        {/* Заголовки дней недели */}
        <div className="calendar-header">
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
            <div key={day} className="calendar-cell header">{day}</div>
          ))}
        </div>

        {/* Тело календаря */}
        <div
          className="calendar-body"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gridTemplateRows: `repeat(${numWeeks}, 1fr)`
          }}
        >
          {cells.map((cell, idx) => (
            <div
              key={idx}
              className={`calendar-cell ${cell ? 'clickable' : 'empty'}`}
              onClick={cell ? () => onDayClick(cell.dateStr) : undefined}
            >
              {cell && (
                <>
                  <div className="day-number">{cell.day}</div>
                  <div className="resource-list">
                    {cell.resources.slice(0, 3).map(r => (
                      <div key={r.id} className={`resource-item ${!r.is_active ? 'inactive' : ''}`}>
                        <StatusDot status={r.status} isActive={r.is_active} />
                        <span className="resource-name">{r.name}</span>
                      </div>
                    ))}
                    {cell.resources.length > 3 && (
                      <div className="more-resources">+{cell.resources.length - 3}</div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Calendar;