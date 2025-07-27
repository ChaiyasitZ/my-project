import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Allow external hosts
    port: 5173,
    strictPort: true,
    // Allow specific hosts
    allowedHosts: [
      'localhost',
      '.localhost',
      '8db6a36773dd.ngrok-free.app'
    ],
    // Proxy API requests to backend
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
