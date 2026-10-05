/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_APP_ENV?: string
  /** Cloudflare Turnstile site key; without it the access form has no human check. */
  readonly VITE_TURNSTILE_SITE_KEY?: string
}

/** The parts of Cloudflare Turnstile's browser API that the access form uses. */
interface Window {
  turnstile?: {
    render: (container: HTMLElement, options: Record<string, unknown>) => string
    reset: (widgetId: string) => void
    remove: (widgetId: string) => void
  }
}
