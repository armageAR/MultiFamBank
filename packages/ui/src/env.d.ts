// Vite replaces these at build time in every app that bundles this package.
interface ImportMetaEnv {
  readonly VITE_APP_ENV?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
