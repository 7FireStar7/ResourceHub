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

  // ---------- Календарь ----------
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState({});

  // ---------- Бронирование ----------
  const [showModal, setShowModal] = useState(false);
  const [selectedResource, setSelectedResource] = useState(null);
  const [bookingDate, setBookingDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [purpose, setPurpose] = useState('');
  const [slots, setSlots] = useState([]);
  const [bookingError, setBookingError] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  // ---------- Админка: управление ресурсами ----------
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [resForm, setResForm] = useState({
    name: '', description: '', type: '', capacity: '', is_active: true,
    available_from: '', available_until: ''
  });
  const [resFormError, setResFormError] = useState('');
  const [resFormLoading, setResFormLoading] = useState(false);

  // ---------- Модальное окно дня ----------
  const [showDayModal, setShowDayModal] = useState(false);
  const [dayResources, setDayResources] = useState([]);
  const [selectedDay, setSelectedDay] = useState('');

  const token = localStorage.getItem('token');
  const headers = token ? { Authorization: 'Bearer ' + token } : {};

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

  // ---------- Календарь: загрузка статуса месяца ----------
  useEffect(() => {
    if (activeTab !== 'resources') return;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/resources/status?year=${year}&month=${month}`, { headers });
        if (!res.ok) throw new Error('Ошибка загрузки статуса');
        const data = await res.json();
        setCalendarData(data);
      } catch (err) {
        console.error(err);
        setCalendarData({});
      }
    };
    fetchStatus();
  }, [currentDate, activeTab, token]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/', { replace: true });
  };

  const changeMonth = (delta) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
  };

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (year, month) => {
    const d = new Date(year, month, 1);
    return (d.getDay() + 6) % 7;
  };

  const handleDayClick = (dayStr) => {
    let resourcesForDay = calendarData.days?.[dayStr] || [];
    if (user.is_admin) {
      setSelectedDay(dayStr);
      setDayResources(resourcesForDay);
      setShowDayModal(true);
    } else {
      const available = resourcesForDay.filter(r => r.is_active && r.status !== 'expired');
      if (available.length > 0) {
        setSelectedDay(dayStr);
        setDayResources(available);
        setShowDayModal(true);
      }
    }
  };

  const startBookingFromDay = (resource) => {
    setShowDayModal(false);
    setSelectedResource(resource);
    setBookingDate(selectedDay);
    setStartTime('');
    setEndTime('');
    setPurpose('');
    setSlots([]);
    setBookingError('');
    setShowModal(true);
  };

  const openBooking = (resource, date = null) => {
    setSelectedResource(resource);
    setBookingDate(date || '');
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

  // ---------- Бронирование: создание ----------
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
      setMyBookings(prev => [data, ...prev]);
      setCurrentDate(new Date(currentDate)); // <-- обновляем календарь
      setShowModal(false);
    } catch (err) {
      setBookingError(err.message);
    } finally {
      setBookingLoading(false);
    }
  };

  // ---------- Отмена бронирования ----------
  const cancelBooking = async (bookingId) => {
    if (!confirm('Вы уверены, что хотите отменить это бронирование?')) return;
    try {
      await fetch(`/api/bookings/${bookingId}`, { method: 'DELETE', headers });
      setMyBookings(prev => prev.filter(b => b.id !== bookingId));
      setCurrentDate(new Date(currentDate)); // <-- обновляем календарь
    } catch (err) {
      alert(err.message);
    }
  };

  // ---------- Завершение бронирования ----------
  const completeBooking = async (bookingId) => {
    if (!confirm('Завершить это бронирование досрочно?')) return;
    try {
      await fetch(`/api/bookings/${bookingId}/complete`, { method: 'PUT', headers });
      setMyBookings(prev => prev.filter(b => b.id !== bookingId));
      setCurrentDate(new Date(currentDate)); // <-- обновляем календарь
    } catch (err) {
      alert(err.message);
    }
  };

  // ---------- Админские функции для ресурсов ----------
  const openAddResource = (initialDate = null) => {
    setEditingResource(null);
    const now = new Date();
    const fromStr = initialDate ? `${initialDate}T00:00` : now.toISOString().slice(0, 16);
    const toStr = initialDate ? `${initialDate}T23:59` : new Date(now.getTime() + 3600000).toISOString().slice(0, 16);
    setResForm({
      name: '', description: '', type: '', capacity: '', is_active: true,
      available_from: fromStr,
      available_until: toStr
    });
    setResFormError('');
    setShowResourceModal(true);
  };

  const openEditResource = (resource) => {
    setEditingResource(resource);
    setResForm({
      name: resource.name,
      description: resource.description || '',
      type: resource.type || '',
      capacity: resource.capacity || '',
      is_active: resource.is_active,
      available_from: resource.available_from ? new Date(resource.available_from).toISOString().slice(0, 16) : '',
      available_until: resource.available_until ? new Date(resource.available_until).toISOString().slice(0, 16) : '',
    });
    setResFormError('');
    setShowResourceModal(true);
  };

  const handleResourceSubmit = async (e) => {
    e.preventDefault();
    if (!resForm.name.trim()) {
      setResFormError('Название обязательно');
      return;
    }
    setResFormLoading(true);
    setResFormError('');
    const payload = {
      name: resForm.name,
      description: resForm.description,
      type: resForm.type,
      capacity: resForm.capacity ? parseInt(resForm.capacity) : null,
      is_active: resForm.is_active,
      available_from: resForm.available_from || null,
      available_until: resForm.available_until || null,
    };
    const method = editingResource ? 'PUT' : 'POST';
    const url = editingResource ? `/api/resources/${editingResource.id}` : '/api/resources';

    try {
      const res = await fetch(url, {
        method,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сохранения');
      const updatedRes = await fetch('/api/resources', { headers });
      setResources(await updatedRes.json());
      setShowResourceModal(false);
      setCurrentDate(new Date(currentDate)); // <-- обновляем календарь
    } catch (err) {
      setResFormError(err.message);
    } finally {
      setResFormLoading(false);
    }
  };

  const deleteResource = async (id, name) => {
    if (!confirm(`Удалить ресурс "${name}"? Это также удалит все связанные бронирования.`)) return;
    try {
      await fetch(`/api/resources/${id}`, { method: 'DELETE', headers });
      setResources(prev => prev.filter(r => r.id !== id));
      setCurrentDate(new Date(currentDate)); // <-- обновляем календарь
    } catch (err) {
      alert(err.message);
    }
  };

  const autoResize = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  if (!user) return null;

  const isAdmin = user.is_admin;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const totalDays = daysInMonth(year, month);
  const startOffset = firstDayOfWeek(year, month);
  const numWeeks = Math.ceil((startOffset + totalDays) / 7);

  const cells = [];
  for (let i = 0; i < numWeeks * 7; i++) {
    const dayIndex = i - startOffset + 1;
    const isValidDay = dayIndex >= 1 && dayIndex <= totalDays;
    if (isValidDay) {
      const day = dayIndex;
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const resourcesList = calendarData.days?.[dateStr] || [];
      cells.push({ day, dateStr, resources: resourcesList });
    } else {
      cells.push(null);
    }
  }

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
    <div className="dashboard-wrapper">
      <header className="dashboard-header">
        <h1>
          Добро пожаловать, {user.full_name}
          {isAdmin && <span className="admin-badge">Админ</span>}
        </h1>
        <button onClick={handleLogout} className="logout-btn">Выйти</button>
      </header>

      <div className="dashboard-tabs">
        <button className={`dash-tab ${activeTab === 'resources' ? 'active' : ''}`}
                onClick={() => setActiveTab('resources')}>Ресурсы</button>
        <button className={`dash-tab ${activeTab === 'bookings' ? 'active' : ''}`}
                onClick={() => setActiveTab('bookings')}>Мои брони</button>
        {isAdmin && (
          <button className={`dash-tab ${activeTab === 'admin' ? 'active' : ''}`}
                  onClick={() => setActiveTab('admin')}>Управление</button>
        )}
      </div>

      <div className="dashboard-content">
        {loading ? (
          <p>Загрузка...</p>
        ) : error ? (
          <p className="error-message">{error}</p>
        ) : (
          <>
            {activeTab === 'resources' && (
              <div className="calendar-container">
                <div className="calendar-nav">
                  <button onClick={() => changeMonth(-1)}>&lt;</button>
                  <h3>
                    {currentDate.toLocaleDateString('ru', { month: 'long', year: 'numeric' })}
                  </h3>
                  <button onClick={() => changeMonth(1)}>&gt;</button>
                </div>
                <div className="calendar-grid">
                  <div className="calendar-header">
                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
                      <div key={day} className="calendar-cell header">{day}</div>
                    ))}
                  </div>
                  <div className="calendar-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: `repeat(${numWeeks}, 1fr)` }}>
                    {cells.map((cell, idx) => (
                      <div
                        key={idx}
                        className={`calendar-cell ${cell ? 'clickable' : 'empty'}`}
                        onClick={cell ? () => handleDayClick(cell.dateStr) : undefined}
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
            )}

            {activeTab === 'bookings' && (
              <div>
                <h2>Мои бронирования</h2>
                {myBookings.length === 0 ? (
                  <p>У вас пока нет активных бронирований.</p>
                ) : (
                  <div className="bookings-list">
                    {myBookings.map(b => (
                      <div key={b.id} className="booking-item">
                        <h3>{b.resource_name}</h3>
                        <p>
                          <strong>С:</strong> {new Date(b.start_time).toLocaleString()}<br />
                          <strong>По:</strong> {new Date(b.end_time).toLocaleString()}
                        </p>
                        <p><strong>Статус:</strong> {b.status}</p>
                        {b.purpose && <p><strong>Цель:</strong> {b.purpose}</p>}
                        <div className="booking-actions">
                          <button className="cancel-book-btn" onClick={() => cancelBooking(b.id)}>Отменить</button>
                          <button className="complete-book-btn" onClick={() => completeBooking(b.id)}>Завершить</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'admin' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2>Управление ресурсами</h2>
                  <button className="submit-btn"
                    style={{ width: 'auto', padding: '0.6rem 1.2rem' }}
                    onClick={() => openAddResource()}>Добавить ресурс</button>
                </div>
                {resources.length === 0 ? (
                  <p>Ресурсы отсутствуют. Создайте первый.</p>
                ) : (
                  <div className="resources-grid" style={{ marginTop: '1rem' }}>
                    {resources.map(res => (
                      <div key={res.id} className="resource-card">
                        <h3>{res.name}</h3>
                        <p><strong>Тип:</strong> {res.type || '—'}</p>
                        <p><strong>Вместимость:</strong> {res.capacity || '—'}</p>
                        <p><strong>Описание:</strong> {res.description || '—'}</p>
                        <p><strong>Доступность:</strong> {res.available_from ? new Date(res.available_from).toLocaleString() : '—'} – {res.available_until ? new Date(res.available_until).toLocaleString() : '—'}</p>
                        <span className={`status ${res.is_active ? 'active' : 'inactive'}`}>
                          {res.is_active ? 'Активен' : 'Неактивен'}
                        </span>
                        <div className="booking-actions" style={{ marginTop: '0.8rem' }}>
                          <button className="complete-book-btn" onClick={() => openEditResource(res)}>Редактировать</button>
                          <button className="cancel-book-btn" onClick={() => deleteResource(res.id, res.name)}>Удалить</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Модальное окно дня (список ресурсов) */}
      {showDayModal && (
        <div className="modal-overlay" onClick={() => setShowDayModal(false)}>
          <div className="modal-content day-modal" onClick={e => e.stopPropagation()}>
            <h2>{new Date(selectedDay).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}</h2>
            {dayResources.length === 0 ? (
              isAdmin ? (
                <div>
                  <p>Нет ресурсов</p>
                  <button className="submit-btn" onClick={() => { setShowDayModal(false); openAddResource(selectedDay); }}>
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
                        <button className="submit-btn" onClick={() => startBookingFromDay(r)}>Забронировать</button>
                      )}
                      {isAdmin && (
                        <>
                          <button className="complete-book-btn" onClick={() => { setShowDayModal(false); openEditResource(r); }}>Редактировать</button>
                          <button className="cancel-book-btn" onClick={() => { setShowDayModal(false); deleteResource(r.id, r.name); }}>Удалить</button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Модальное окно бронирования */}
      {showModal && selectedResource && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Бронирование: {selectedResource.name}</h2>
            <form onSubmit={handleBookingSubmit} className="booking-form">
              <div className="field">
                <label>Дата</label>
                <input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} required />
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
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
              </div>
              <div className="field">
                <label>Время окончания</label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required />
              </div>
              <div className="field">
                <label>Цель (необязательно)</label>
                <input type="text" placeholder="Совещание, встреча..." value={purpose} onChange={e => setPurpose(e.target.value)} />
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

      {/* Модальное окно создания/редактирования ресурса */}
      {showResourceModal && (
        <div className="modal-overlay" onClick={() => setShowResourceModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>{editingResource ? 'Редактировать ресурс' : 'Новый ресурс'}</h2>
            <form onSubmit={handleResourceSubmit} className="booking-form">
              <div className="field">
                <label>Название *</label>
                <input type="text" value={resForm.name} onChange={e => setResForm({ ...resForm, name: e.target.value })} required />
              </div>
              <div className="field">
                <label>Тип</label>
                <input type="text" placeholder="переговорка, оборудование..." value={resForm.type}
                       onChange={e => setResForm({ ...resForm, type: e.target.value })} />
              </div>
              <div className="field">
                <label>Вместимость</label>
                <input type="number" value={resForm.capacity} onChange={e => setResForm({ ...resForm, capacity: e.target.value })} />
              </div>
              <div className="field">
                <label>Описание</label>
                <textarea rows={3} value={resForm.description} onChange={e => { setResForm({ ...resForm, description: e.target.value }); autoResize(e); }}
                          style={{ minHeight: '5rem' }} />
              </div>
              <div className="field">
                <label>Доступность с</label>
                <input type="datetime-local" value={resForm.available_from}
                       onChange={e => setResForm({ ...resForm, available_from: e.target.value })} />
              </div>
              <div className="field">
                <label>Доступность по</label>
                <input type="datetime-local" value={resForm.available_until}
                       onChange={e => setResForm({ ...resForm, available_until: e.target.value })} />
              </div>
              <div className="field">
                <label>
                  <input type="checkbox" checked={resForm.is_active}
                         onChange={e => setResForm({ ...resForm, is_active: e.target.checked })} />
                  {' '}Активен
                </label>
              </div>
              {resFormError && <p className="error-message">{resFormError}</p>}
              <div className="modal-actions">
                <button type="submit" className="submit-btn" disabled={resFormLoading}>
                  {resFormLoading ? 'Сохранение...' : editingResource ? 'Сохранить' : 'Создать'}
                </button>
                <button type="button" className="cancel-btn" onClick={() => setShowResourceModal(false)}>Отмена</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;