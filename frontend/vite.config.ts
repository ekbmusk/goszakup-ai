import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://77.42.43.153:8008',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://77.42.43.153:8008',
        changeOrigin: true,
      },
    },
  },
})
