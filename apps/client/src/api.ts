import { createApiClient, createTokenStore } from '@multifambank/api-client'

export const tokenStore = createTokenStore('mfb.client.token')

export const api = createApiClient({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  getToken: tokenStore.get,
  onUnauthorized: () => tokenStore.clear(),
})
