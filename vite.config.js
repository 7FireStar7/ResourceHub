import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,               // явно указываем порт фронтенда
    proxy: {
      '/api': 'http://localhost:3001'  // все запросы на /api уходят на бэкенд
    }
  }
});