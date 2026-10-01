import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { appEnvironment, environmentBranding, environmentLabel } from '../../packages/ui/branding/vite-plugin.ts'

export default defineConfig(({ mode }) => {
  const environment = appEnvironment(loadEnv(mode, process.cwd(), 'VITE_'))
  const label = environmentLabel(environment)

  return {
    plugins: [
      react(),
      tailwindcss(),
      environmentBranding(environment),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          id: '/client/',
          name: `${label ? `[${label}] ` : ''}MultiFamBank · Mi banco`,
          short_name: `${label ? `${label} ` : ''}MFB Cliente`,
          lang: 'es',
          start_url: '/',
          display: 'standalone',
          theme_color: '#1e3a8a',
          background_color: '#f8fafc',
          icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
        },
        workbox: { navigateFallback: '/index.html' },
      }),
    ],
    server: { port: 5173, strictPort: true },
  }
})
