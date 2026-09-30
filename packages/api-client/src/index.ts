import axios, { type AxiosInstance } from 'axios'

export interface ApiClientOptions {
  baseURL: string
  getToken?: () => string | null
}

export function createApiClient({ baseURL, getToken }: ApiClientOptions): AxiosInstance {
  const client = axios.create({
    baseURL: `${baseURL.replace(/\/$/, '')}/api`,
    headers: { Accept: 'application/json' },
  })

  client.interceptors.request.use((config) => {
    const token = getToken?.()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })

  return client
}

export interface HealthResponse {
  status: 'ok' | 'degraded'
  app: string
  database: 'ok' | 'unavailable'
  time: string
}

export async function fetchHealth(client: AxiosInstance): Promise<HealthResponse> {
  const { data } = await client.get<HealthResponse>('/health')
  return data
}
