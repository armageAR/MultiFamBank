import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        id: '/admin/',
        name: 'MultiFamBank · Administración del banco',
        short_name: 'MFB Admin',
        lang: 'es',
        start_url: '/',
        display: 'standalone',
        theme_color: '#14532d',
        background_color: '#f8fafc',
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: { navigateFallback: '/index.html' },
    }),
  ],
  server: { port: 5174, strictPort: true },
})
