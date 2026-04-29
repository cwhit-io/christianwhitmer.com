import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/cms/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/cms/login': 'http://localhost:3000',
      '/cms/logout': 'http://localhost:3000',
      '/cms/session': 'http://localhost:3000',
      '/posts': 'http://localhost:3000',
      '/media': 'http://localhost:3000',
    },
  },
})
