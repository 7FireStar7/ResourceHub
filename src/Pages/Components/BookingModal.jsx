import './BookingModal.css';

function BookingModal({
  selectedResource,
  bookingDate,
  onDateChange,
  startTime,
  onStartTimeChange,
  endTime,
  onEndTimeChange,
  purpose,
  onPurposeChange,
  slots,
  bookingError,
  bookingLoading,
  onSubmit,
  onClose
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>Бронирование: {selectedResource.name}</h2>
        <form onSubmit={onSubmit} className="booking-form">
          <div className="field">
            <label>Дата</label>
            <input type="date" value={bookingDate} onChange={e => onDateChange(e.target.value)} required />
          </div>
          {selectedResource.available_from && selectedResource.available_until && (
            <div className="availability-info">
              Доступное время:{' '}
              <strong>
                с {new Date(selectedResource.available_from).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}{' '}
                до {new Date(selectedResource.available_until).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
              </strong>
            </div>
          )}
          <div className="field">
            <label>Время начала</label>
            <input type="time" value={startTime} onChange={e => onStartTimeChange(e.target.value)} required />
          </div>
          <div className="field">
            <label>Время окончания</label>
            <input type="time" value={endTime} onChange={e => onEndTimeChange(e.target.value)} required />
          </div>
          <div className="field">
            <label>Цель (необязательно)</label>
            <input type="text" placeholder="Совещание, встреча..." value={purpose} onChange={e => onPurposeChange(e.target.value)} />
          </div>
          {bookingError && <p className="error-message">{bookingError}</p>}
          {bookingDate && (
            <div className="slots-info">
              <h4>Занятые слоты на {bookingDate}:</h4>
              {slots.length === 0 ? (
                <p>На этот день броней нет</p>
              ) : (
                <ul>
                  {slots.map((s, i) => (
                    <li key={i}>
                      {new Date(s.start_time).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })} –{' '}
                      {new Date(s.end_time).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                      {s.purpose && ` (${s.purpose})`}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="modal-actions">
            <button type="submit" className="submit-btn" disabled={bookingLoading}>
              {bookingLoading ? 'Создаётся...' : 'Забронировать'}
            </button>
            <button type="button" className="cancel-btn" onClick={onClose}>Отмена</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BookingModal;