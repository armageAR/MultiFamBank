import axios, { type AxiosInstance } from 'axios'

export interface ApiClientOptions {
  baseURL: string
  getToken?: () => string | null
  /** Called when the API rejects the stored token. */
  onUnauthorized?: () => void
}

export function createApiClient({ baseURL, getToken, onUnauthorized }: ApiClientOptions): AxiosInstance {
  const client = axios.create({
    baseURL: `${baseURL.replace(/\/$/, '')}/api`,
    headers: { Accept: 'application/json' },
  })

  client.interceptors.request.use((config) => {
    const token = getToken?.()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })

  client.interceptors.response.use(undefined, (error) => {
    // Only when the rejected token is still the stored one: a late answer for a session that already
    // ended must not end the one that replaced it.
    const current = getToken?.()
    if (axios.isAxiosError(error) && error.response?.status === 401 && current && error.config?.headers?.Authorization === `Bearer ${current}`) {
      onUnauthorized?.()
    }
    return Promise.reject(error)
  })

  return client
}
