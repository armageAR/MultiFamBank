import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { appEnvironment, environmentBranding } from '../../packages/ui/branding/vite-plugin.ts'

export default defineConfig(({ mode }) => {
  const environment = appEnvironment(loadEnv(mode, process.cwd(), 'VITE_'))

  return {
    plugins: [
      react(),
      tailwindcss(),
      environmentBranding(environment),
    ],
    server: { port: 5175, strictPort: true },
  }
})
