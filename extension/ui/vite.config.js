import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8001',
      '/rooms': 'http://localhost:8001',
      '/register': 'http://localhost:8001',
      '/next-question': 'http://localhost:8001',
      '/submit-answer': 'http://localhost:8001',
      '/results': 'http://localhost:8001',
    },
  },
  build: {
    outDir: 'dist',
  },
})
