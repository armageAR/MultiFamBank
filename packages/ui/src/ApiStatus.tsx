import { StatusBadge } from './StatusBadge'

interface ApiStatusProps {
  isLoading: boolean
  isError: boolean
  database?: 'ok' | 'unavailable'
}

/** Shows whether the app can reach the API and the API can reach its database. */
export function ApiStatus({ isLoading, isError, database }: ApiStatusProps) {
  if (isLoading) return <StatusBadge tone="neutral" label="Conectando con la API…" />
  if (isError) return <StatusBadge tone="error" label="API no disponible" />
  if (database !== 'ok') return <StatusBadge tone="warning" label="API conectada, base de datos no disponible" />
  return <StatusBadge tone="ok" label="API y base de datos conectadas" />
}
