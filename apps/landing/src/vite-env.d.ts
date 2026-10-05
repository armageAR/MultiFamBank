/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_APP_ENV?: string
  /** Cloudflare Turnstile site key; without it the access form has no human check. */
  readonly VITE_TURNSTILE_SITE_KEY?: string
  /** Sign-in pages of the bank (admin) and client apps, linked from the header. */
  readonly VITE_ADMIN_APP_URL?: string
  readonly VITE_CLIENT_APP_URL?: string
}
