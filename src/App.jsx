import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginSignup from './pages/LoginSignup';
import Dashboard from './pages/Dashboard';
import './App.css';   // <-- вот эта строка подключает стили

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginSignup />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;