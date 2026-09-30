import type { AxiosInstance } from 'axios'
import type {
  AdminBank,
  AuthResponse,
  BankStatus,
  CreateBankResponse,
  HealthResponse,
  InvitationDetails,
  PlatformBankList,
  User,
} from './types'

export async function fetchHealth(client: AxiosInstance): Promise<HealthResponse> {
  const { data } = await client.get<HealthResponse>('/health')
  return data
}

// Authentication

export async function login(client: AxiosInstance, email: string, password: string): Promise<AuthResponse> {
  const { data } = await client.post<AuthResponse>('/auth/login', { email, password })
  return data
}

export async function fetchMe(client: AxiosInstance): Promise<User> {
  const { data } = await client.get<{ data: User }>('/auth/me')
  return data.data
}

export async function logout(client: AxiosInstance): Promise<void> {
  await client.post('/auth/logout')
}

export async function forgotPassword(client: AxiosInstance, email: string): Promise<string> {
  const { data } = await client.post<{ message: string }>('/auth/forgot-password', { email })
  return data.message
}

export interface ResetPasswordInput {
  token: string
  email: string
  password: string
  password_confirmation: string
}

export async function resetPassword(client: AxiosInstance, input: ResetPasswordInput): Promise<string> {
  const { data } = await client.post<{ message: string }>('/auth/reset-password', input)
  return data.message
}

// Platform (superadmin)

export interface BankListParams {
  status?: BankStatus
  search?: string
  page?: number
}

export async function listPlatformBanks(client: AxiosInstance, params: BankListParams = {}): Promise<PlatformBankList> {
  const { data } = await client.get<PlatformBankList>('/platform/banks', { params })
  return data
}

export async function createPlatformBank(
  client: AxiosInstance,
  input: { admin_email: string; admin_name: string },
): Promise<CreateBankResponse> {
  const { data } = await client.post<CreateBankResponse>('/platform/banks', input)
  return data
}

// Invitations

export async function fetchInvitation(client: AxiosInstance, token: string): Promise<InvitationDetails> {
  const { data } = await client.get<InvitationDetails>(`/invitations/${encodeURIComponent(token)}`)
  return data
}

export interface AcceptInvitationInput {
  name?: string
  password: string
  password_confirmation?: string
}

export async function acceptInvitation(client: AxiosInstance, token: string, input: AcceptInvitationInput): Promise<AuthResponse> {
  const { data } = await client.post<AuthResponse>(`/invitations/${encodeURIComponent(token)}/accept`, input)
  return data
}

// Bank administration

export async function fetchAdminBank(client: AxiosInstance): Promise<AdminBank> {
  const { data } = await client.get<{ data: AdminBank }>('/admin/bank')
  return data.data
}

export async function updateAdminBank(client: AxiosInstance, input: { name: string; timezone: string }): Promise<AdminBank> {
  const { data } = await client.put<{ data: AdminBank }>('/admin/bank', input)
  return data.data
}
