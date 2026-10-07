import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Base path for GitHub Pages: '/serum2vital/' when building for production, '/' in local dev
  base: process.env.VITE_BASE ?? (command === 'build' ? '/serum2vital/' : '/'),

  plugins: [
    react(),
    tailwindcss(),
  ],

  // Web Workers support
  worker: {
    format: 'es',
  },

  build: {
    chunkSizeWarningLimit: 2000,
  },
}))
