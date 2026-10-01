/// <reference path="./env.d.ts" />

export type AppEnvironment = 'production' | 'staging' | 'development'

/** Set per Railway environment through VITE_APP_ENV; unset means local development. */
export const appEnvironment: AppEnvironment =
  import.meta.env.VITE_APP_ENV === 'production' || import.meta.env.VITE_APP_ENV === 'staging'
    ? import.meta.env.VITE_APP_ENV
    : 'development'

/** "Staging" or "Local"; null in production, which shows no marker. */
export const environmentLabel: string | null =
  appEnvironment === 'production' ? null : appEnvironment === 'staging' ? 'Staging' : 'Local'
