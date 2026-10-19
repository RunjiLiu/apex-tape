import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Local `vite` stays at `/`. Production builds (and GitHub Pages) use `/apex-tape/`.
// Set VITE_BASE to override either one.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: process.env.VITE_BASE ?? (command === 'build' ? '/apex-tape/' : '/'),
  server: {
    host: '0.0.0.0',
    port: 4327,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4331,
    strictPort: true,
  },
}))
