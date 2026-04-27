import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function LoginSignup() {
  // --- Состояния для переключения табов ---
  const [activeTab, setActiveTab] = useState('login');
  const navigate = useNavigate();

  // --- Поля для входа ---
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // --- Поля для регистрации ---
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');

  // --- Состояния для ошибок и загрузки ---
  const [loginError, setLoginError] = useState('');
  const [signupError, setSignupError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);

  // --- Обработчик входа ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError(''); // сбрасываем предыдущую ошибку
    setLoginLoading(true); // включаем индикатор загрузки

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Сервер вернул ошибку (400, 401 и т.д.)
        throw new Error(data.error || 'Ошибка входа');
      }

      // Успешно: сохраняем токен и данные пользователя
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/dashboard');
    } catch (err) {
      // Обрабатываем как сетевые ошибки, так и сообщения от сервера
      setLoginError(err.message || 'Не удалось подключиться к серверу');
    } finally {
      setLoginLoading(false);
    }
  };

  // --- Обработчик регистрации ---
  const handleSignup = async (e) => {
    e.preventDefault();
    setSignupError('');

    // Проверка совпадения паролей (на клиенте)
    if (signupPassword !== signupConfirm) {
      setSignupError('Пароли не совпадают');
      return;
    }

    setSignupLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: signupName,
          email: signupEmail,
          password: signupPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка регистрации');
      }

      // Регистрация успешна – сразу логинимся (сохраняем токен)
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/dashboard');
    } catch (err) {
      setSignupError(err.message || 'Не удалось подключиться к серверу');
    } finally {
      setSignupLoading(false);
    }
  };

  // --- Рендер ---
  return (
    <div className="page-wrapper">
      <div className="auth-card">
        <h1 className="logo">ResourceHub</h1>

        {/* Переключатель табов */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => { setActiveTab('login'); setLoginError(''); setSignupError(''); }}
          >
            Login
          </button>
          <button
            className={`tab ${activeTab === 'signup' ? 'active' : ''}`}
            onClick={() => { setActiveTab('signup'); setLoginError(''); setSignupError(''); }}
          >
            Sign Up
          </button>
        </div>

        {/* ======== Форма Входа ======== */}
        {activeTab === 'login' && (
          <form onSubmit={handleLogin} className="auth-form">
            <div className="field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>

            {/* Блок ошибки входа */}
            {loginError && <div className="error-message">{loginError}</div>}

            <button type="submit" className="submit-btn" disabled={loginLoading}>
              {loginLoading ? 'Signing In...' : 'Sign In'}
            </button>
            <a href="#" className="forgot-link" onClick={(e) => e.preventDefault()}>
              Forgot password?
            </a>
          </form>
        )}

        {/* ======== Форма Регистрации ======== */}
        {activeTab === 'signup' && (
          <form onSubmit={handleSignup} className="auth-form">
            <div className="field">
              <label htmlFor="signup-name">Full Name</label>
              <input
                id="signup-name"
                type="text"
                placeholder="Alex Johnson"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="signup-email">Email</label>
              <input
                id="signup-email"
                type="email"
                placeholder="you@example.com"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="signup-password">Password</label>
              <input
                id="signup-password"
                type="password"
                placeholder="••••••••"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="signup-confirm">Confirm Password</label>
              <input
                id="signup-confirm"
                type="password"
                placeholder="••••••••"
                value={signupConfirm}
                onChange={(e) => setSignupConfirm(e.target.value)}
                required
              />
            </div>

            {/* Блок ошибки регистрации */}
            {signupError && <div className="error-message">{signupError}</div>}

            <button type="submit" className="submit-btn" disabled={signupLoading}>
              {signupLoading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        )}
      </div>

      {/* Иллюстрация */}
      <div className="illustration" aria-hidden="true">
        <svg viewBox="0 0 400 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="120" y="100" width="160" height="20" rx="3" fill="#B0BEC5" />
          <rect x="145" y="125" width="25" height="30" rx="4" fill="#CFD8DC" />
          <rect x="230" y="125" width="25" height="30" rx="4" fill="#CFD8DC" />
          <rect x="160" y="60" width="80" height="40" rx="4" fill="#37474F" />
          <rect x="170" y="65" width="60" height="30" rx="2" fill="#546E7A" />
          <rect x="130" y="120" width="6" height="15" fill="#90A4AE" />
          <rect x="264" y="120" width="6" height="15" fill="#90A4AE" />
          <circle cx="310" cy="80" r="12" fill="#ECEFF1" stroke="#B0BEC5" strokeWidth="2" />
          <path d="M310 73 L310 80 L315 80" stroke="#607D8B" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
}

export default LoginSignup;