import axios from 'axios'

export interface ApiError {
  message: string
  /** First message per field, from Laravel 422 responses. */
  fields: Record<string, string>
  status?: number
}

export function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const data = error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined

    if (!error.response) {
      return { message: 'No pudimos conectarnos con el servidor. Revisá tu conexión.', fields: {} }
    }

    const fields = Object.fromEntries(Object.entries(data?.errors ?? {}).map(([field, messages]) => [field, messages[0] ?? '']))
    const fallback = status === 429 ? 'Demasiados intentos. Esperá un minuto y volvé a probar.' : 'Ocurrió un error inesperado.'
    const message = status === 422 ? (Object.values(fields)[0] ?? data?.message ?? fallback) : (data?.message ?? fallback)

    return { message, fields, status }
  }

  return { message: 'Ocurrió un error inesperado.', fields: {} }
}
