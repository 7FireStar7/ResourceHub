import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('resources');
  const [resources, setResources] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [selectedResource, setSelectedResource] = useState(null);
  const [bookingDate, setBookingDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [purpose, setPurpose] = useState('');
  const [slots, setSlots] = useState([]);
  const [bookingError, setBookingError] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  const token = localStorage.getItem('token');
  const headers = token ? { 'Authorization': 'Bearer ' + token } : {};

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!token || !userData) {
      navigate('/', { replace: true });
      return;
    }
    setUser(JSON.parse(userData));

    const fetchData = async () => {
      setLoading(true);
      try {
        const [resRes, bookRes] = await Promise.all([
          fetch('/api/resources', { headers }),
          fetch('/api/bookings/me', { headers }),
        ]);
        if (!resRes.ok) throw new Error('Ошибка загрузки ресурсов');
        if (!bookRes.ok) throw new Error('Ошибка загрузки бронирований');
        setResources(await resRes.json());
        // Показываем только активные брони
        const allBookings = await bookRes.json();
        setMyBookings(allBookings.filter(b => b.status === 'active'));
      } catch (err) {
        setError(err.message);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/', { replace: true });
  };

  const openBooking = (resource) => {
    setSelectedResource(resource);
    setBookingDate('');
    setStartTime('');
    setEndTime('');
    setPurpose('');
    setSlots([]);
    setBookingError('');
    setShowModal(true);
  };

  const loadSlots = async (date) => {
    if (!date || !selectedResource) return;
    try {
      const res = await fetch(`/api/resources/${selectedResource.id}/slots?date=${date}`, { headers });
      if (!res.ok) throw new Error('Ошибка загрузки слотов');
      setSlots(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (bookingDate) loadSlots(bookingDate);
  }, [bookingDate, selectedResource]);

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!bookingDate || !startTime || !endTime) {
      setBookingError('Заполните дату и время');
      return;
    }
    const startISO = new Date(`${bookingDate}T${startTime}`).toISOString();
    const endISO = new Date(`${bookingDate}T${endTime}`).toISOString();

    if (new Date(startISO) >= new Date(endISO)) {
      setBookingError('Время начала должно быть раньше окончания');
      return;
    }

    setBookingLoading(true);
    setBookingError('');
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource_id: selectedResource.id,
          start_time: startISO,
          end_time: endISO,
          purpose,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка создания бронирования');

      // Добавляем новую активную бронь в список
      setMyBookings(prev => [data, ...prev]);
      setShowModal(false);
    } catch (err) {
      setBookingError(err.message);
    } finally {
      setBookingLoading(false);
    }
  };

  // Отмена бронирования
  const cancelBooking = async (bookingId) => {
    if (!confirm('Вы уверены, что хотите отменить это бронирование?')) return;
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'DELETE',
        headers: { ...headers },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка при отмене');
      // Удаляем бронь из локального списка
      setMyBookings(prev => prev.filter(b => b.id !== bookingId));
    } catch (err) {
      alert(err.message);
    }
  };

  // Завершить бронирование досрочно
  const completeBooking = async (bookingId) => {
    if (!confirm('Завершить это бронирование досрочно?')) return;
    try {
      const res = await fetch(`/api/bookings/${bookingId}/complete`, {
        method: 'PUT',
        headers: { ...headers },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка при завершении');
      // Удаляем бронь из списка
      setMyBookings(prev => prev.filter(b => b.id !== bookingId));
    } catch (err) {
      alert(err.message);
    }
  };

  if (!user) return null;

  return (
    <div className="dashboard-wrapper">
      <header className="dashboard-header">
        <h1>Добро пожаловать, {user.full_name}!</h1>
        <button onClick={handleLogout} className="logout-btn">Выйти</button>
      </header>

      <div className="dashboard-tabs">
        <button className={`dash-tab ${activeTab === 'resources' ? 'active' : ''}`} onClick={() => setActiveTab('resources')}>Переговорки</button>
        <button className={`dash-tab ${activeTab === 'bookings' ? 'active' : ''}`} onClick={() => setActiveTab('bookings')}>Мои брони</button>
      </div>

      <div className="dashboard-content">
        {loading ? <p>Загрузка...</p> : error ? <p className="error-message">{error}</p> : (
          activeTab === 'resources' ? (
            <div>
              <h2>Доступные ресурсы</h2>
              {resources.length === 0 ? (
                <p>Нет доступных переговорок.</p>
              ) : (
                <div className="resources-grid">
                  {resources.map((res) => (
                    <div key={res.id} className="resource-card">
                      <h3>{res.name}</h3>
                      <p><strong>Тип:</strong> {res.type || 'Не указан'}</p>
                      <p><strong>Вместимость:</strong> {res.capacity || '—'} чел.</p>
                      <p><strong>Описание:</strong> {res.description || 'Нет описания'}</p>
                      <span className={`status ${res.is_active ? 'active' : 'inactive'}`}>
                        {res.is_active ? 'Активен' : 'Неактивен'}
                      </span>
                      <button className="book-btn" onClick={() => openBooking(res)}>Забронировать</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <h2>Мои бронирования</h2>
              {myBookings.length === 0 ? (
                <p>У вас пока нет активных бронирований.</p>
              ) : (
                <div className="bookings-list">
                  {myBookings.map((b) => (
                    <div key={b.id} className="booking-item">
                      <h3>{b.resource_name}</h3>
                      <p><strong>С:</strong> {new Date(b.start_time).toLocaleString()}<br />
                      <strong>По:</strong> {new Date(b.end_time).toLocaleString()}</p>
                      <p><strong>Статус:</strong> {b.status}</p>
                      {b.purpose && <p><strong>Цель:</strong> {b.purpose}</p>}

                      <div className="booking-actions">
                        <button className="cancel-book-btn" onClick={() => cancelBooking(b.id)}>
                          Отменить
                        </button>
                        <button className="complete-book-btn" onClick={() => completeBooking(b.id)}>
                          Завершить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        )}
      </div>

      {showModal && selectedResource && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Бронирование: {selectedResource.name}</h2>
            <form onSubmit={handleBookingSubmit} className="booking-form">
              <div className="field">
                <label>Дата</label>
                <input type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} required />
              </div>
              <div className="field">
                <label>Время начала</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
              </div>
              <div className="field">
                <label>Время окончания</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
              </div>
              <div className="field">
                <label>Цель (необязательно)</label>
                <input type="text" placeholder="Совещание, встреча..." value={purpose} onChange={(e) => setPurpose(e.target.value)} />
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
                <button type="button" className="cancel-btn" onClick={() => setShowModal(false)}>Отмена</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;