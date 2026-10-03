import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { appEnvironment, environmentBranding } from '../../packages/ui/branding/vite-plugin.ts'

// The public FamBank page: one static page whose only request is the access form.
export default defineConfig(({ mode }) => {
  const environment = appEnvironment(loadEnv(mode, process.cwd(), 'VITE_'))

  return {
    plugins: [react(), tailwindcss(), environmentBranding(environment, 'emerald')],
    server: { port: 5176, strictPort: true },
  }
})
