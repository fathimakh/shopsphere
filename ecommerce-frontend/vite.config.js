import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Ports are part of the shared contract (docs/API_CONTRACT.md §1) and
  // match the backend CORS allow-list, so fail fast instead of drifting.
  server: { port: 5175, strictPort: true },
  preview: { port: 4173, strictPort: true },
})
