import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

export type AppEnvironment = 'production' | 'staging' | 'development'

/** Reads VITE_APP_ENV (set per Railway environment); anything unset is local development. */
export function appEnvironment(env: Record<string, string>): AppEnvironment {
  const value = env.VITE_APP_ENV
  return value === 'production' || value === 'staging' ? value : 'development'
}

export function environmentLabel(environment: AppEnvironment): string | null {
  return environment === 'production' ? null : environment === 'staging' ? 'Staging' : 'Local'
}

/**
 * Makes non-production builds unmistakable: the favicon (also used by PWA manifests as
 * /favicon.svg) gets a red "S", and the page title is prefixed with the environment. The icon's
 * background follows the app's palette.
 */
const navyBackground = '<rect width="64" height="64" rx="14" fill="#1e3a8a"/>'

/** "navy" for the platform app; "emerald" matches the original FamBank in the family apps. */
export type IconPalette = 'navy' | 'emerald'

const backgrounds: Record<IconPalette, string> = {
  navy: navyBackground,
  emerald:
    '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#34d399"/><stop offset="100%" stop-color="#059669"/></linearGradient></defs>' +
    '<rect width="64" height="64" rx="14" fill="url(#bg)"/>',
}

export function environmentBranding(environment: AppEnvironment, palette: IconPalette = 'navy'): Plugin {
  const file = environment === 'production' ? 'bank.svg' : 'bank-staging.svg'
  const source = readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8')
  if (!source.includes(navyBackground)) throw new Error(`${file}: background rect not found`)
  const icon = source.replace(navyBackground, backgrounds[palette])
  const label = environmentLabel(environment)

  return {
    name: 'multifambank-environment-branding',
    // Dev server: serve the icon at the same URL the build emits.
    configureServer(server) {
      server.middlewares.use('/favicon.svg', (_req, res) => {
        res.setHeader('Content-Type', 'image/svg+xml')
        res.end(icon)
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'favicon.svg', source: icon })
    },
    transformIndexHtml(html) {
      return label ? html.replace(/<title>(.*?)<\/title>/, `<title>[${label}] $1</title>`) : html
    },
  }
}
