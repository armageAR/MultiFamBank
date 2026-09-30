import { createApiClient, createTokenStore } from '@multifambank/api-client'

export const tokenStore = createTokenStore('mfb.superadmin.token')

export const api = createApiClient({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  getToken: tokenStore.get,
  // Protected pages redirect to sign-in once the session is gone; public pages keep working.
  onUnauthorized: () => tokenStore.clear(),
})
