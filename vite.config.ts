import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(() => {
  // For GitHub Pages we set BASE_PATH="/<repo>/" in CI.
  const base = (process.env.BASE_PATH ?? '/').replace(/([^/])$/, '$1/')

  return {
    base,
    plugins: [react()],
  }
})
