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
      environmentBranding(environment, 'sky'),
      VitePWA({
        registerType: 'autoUpdate',
        // Custom worker (src/sw.ts) so it can show push notifications.
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        injectManifest: { globPatterns: ['**/*.{js,css,html,svg,webmanifest}'] },
        manifest: {
          id: '/admin/',
          name: `${label ? `[${label}] ` : ''}MultiFamBank · Administración del banco`,
          short_name: `${label ? `${label} ` : ''}MFB Admin`,
          lang: 'es',
          start_url: '/',
          display: 'standalone',
          theme_color: '#ffffff',
          background_color: '#f8fafc',
          icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
        },
      }),
    ],
    server: { port: 5174, strictPort: true },
  }
})
