// Vite replaces these at build time in every app that bundles this package.
interface ImportMetaEnv {
  readonly VITE_APP_ENV?: string
  /** Cloudflare Turnstile site key; without it public forms have no human check. */
  readonly VITE_TURNSTILE_SITE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
