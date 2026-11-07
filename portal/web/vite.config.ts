import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development the API runs separately (uv run uvicorn ... --port 8000); Vite forwards /api to it.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
