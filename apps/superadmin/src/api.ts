import { createApiClient } from '@multifambank/api-client'

export const api = createApiClient({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
})
