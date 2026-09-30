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
    if (axios.isAxiosError(error) && error.response?.status === 401 && getToken?.()) onUnauthorized?.()
    return Promise.reject(error)
  })

  return client
}
