import type { AxiosInstance } from 'axios'
import type {
  AdminBank,
  AdminClient,
  AdminDashboard,
  ClientBank,
  ClientInvitation,
  ExchangeRates,
  ExpenseReport,
  InvitationResult,
  NewOperation,
  Operation,
  OperationEdit,
  Paginated,
  AuthResponse,
  BankLifecycleAction,
  BankStatus,
  CreateBankResponse,
  HealthResponse,
  InvitationDetails,
  PlatformBankDetail,
  PlatformBankList,
  UpdateAdminResponse,
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

export async function fetchPlatformBank(client: AxiosInstance, bankId: number): Promise<PlatformBankDetail> {
  const { data } = await client.get<{ data: PlatformBankDetail }>(`/platform/banks/${bankId}`)
  return data.data
}

export async function updatePlatformBankAdmin(
  client: AxiosInstance,
  bankId: number,
  input: { name: string; email: string },
): Promise<UpdateAdminResponse> {
  const { data } = await client.patch<UpdateAdminResponse>(`/platform/banks/${bankId}/admin`, input)
  return data
}

/** Pause, resume, deactivate or reactivate a bank. */
export async function changePlatformBankStatus(
  client: AxiosInstance,
  bankId: number,
  action: BankLifecycleAction,
): Promise<PlatformBankDetail> {
  const { data } = await client.post<{ data: PlatformBankDetail }>(`/platform/banks/${bankId}/status`, { action })
  return data.data
}

/** The superadmin chooses the password; the administrator is signed out everywhere. */
export async function setPlatformBankAdminPassword(
  client: AxiosInstance,
  bankId: number,
  input: { password: string; password_confirmation: string },
): Promise<string> {
  const { data } = await client.put<{ message: string }>(`/platform/banks/${bankId}/admin/password`, input)
  return data.message
}

/** Issues a new administrator invitation for a bank nobody has accepted yet; earlier links stop working. */
export async function resendAdminInvitation(client: AxiosInstance, bankId: number): Promise<CreateBankResponse> {
  const { data } = await client.post<CreateBankResponse>(`/platform/banks/${bankId}/admin-invitation`)
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

// Exchange rates and push

export async function fetchExchangeRates(client: AxiosInstance, refresh = false): Promise<ExchangeRates> {
  const { data } = await client.get<{ data: ExchangeRates }>('/exchange-rates', { params: refresh ? { refresh: 1 } : {} })
  return data.data
}

export async function fetchPushPublicKey(client: AxiosInstance): Promise<string | null> {
  const { data } = await client.get<{ key: string | null }>('/push/public-key')
  return data.key
}

export async function savePushSubscription(client: AxiosInstance, subscription: PushSubscriptionJSON): Promise<void> {
  await client.post('/push/subscriptions', subscription)
}

export async function deletePushSubscription(client: AxiosInstance, endpoint: string): Promise<void> {
  await client.delete('/push/subscriptions', { data: { endpoint } })
}

export async function sendTestPush(client: AxiosInstance): Promise<string> {
  const { data } = await client.post<{ message: string }>('/push/test')
  return data.message
}

// Bank administration

export async function fetchAdminDashboard(client: AxiosInstance): Promise<AdminDashboard> {
  const { data } = await client.get<{ data: AdminDashboard }>('/admin/dashboard')
  return data.data
}

export async function fetchExpenseReport(client: AxiosInstance, month: string): Promise<ExpenseReport> {
  const { data } = await client.get<{ data: ExpenseReport }>('/admin/reports/expenses', { params: { month } })
  return data.data
}

export async function fetchAdminClients(client: AxiosInstance): Promise<{ clients: AdminClient[]; invitations: ClientInvitation[] }> {
  const { data } = await client.get<{ data: { clients: AdminClient[]; invitations: ClientInvitation[] } }>('/admin/clients')
  return data.data
}

export async function inviteClient(client: AxiosInstance, input: { email: string; name: string }): Promise<InvitationResult> {
  const { data } = await client.post<InvitationResult>('/admin/clients/invitations', input)
  return data
}

export async function resendClientInvitation(client: AxiosInstance, invitationId: number): Promise<InvitationResult> {
  const { data } = await client.post<InvitationResult>(`/admin/clients/invitations/${invitationId}/resend`)
  return data
}

export async function revokeClientInvitation(client: AxiosInstance, invitationId: number): Promise<void> {
  await client.delete(`/admin/clients/invitations/${invitationId}`)
}

export async function updateClient(client: AxiosInstance, membershipId: number, input: { name: string; email: string }): Promise<AdminClient> {
  const { data } = await client.patch<{ data: AdminClient }>(`/admin/clients/${membershipId}`, input)
  return data.data
}

export async function setClientPassword(
  client: AxiosInstance,
  membershipId: number,
  input: { password: string; password_confirmation: string },
): Promise<string> {
  const { data } = await client.put<{ message: string }>(`/admin/clients/${membershipId}/password`, input)
  return data.message
}

export async function sendClientPasswordReset(client: AxiosInstance, membershipId: number): Promise<string> {
  const { data } = await client.post<{ message: string }>(`/admin/clients/${membershipId}/password-reset`)
  return data.message
}

export async function setClientActive(client: AxiosInstance, membershipId: number, active: boolean): Promise<AdminClient> {
  const { data } = await client.post<{ data: AdminClient }>(`/admin/clients/${membershipId}/${active ? 'reactivate' : 'deactivate'}`)
  return data.data
}

export async function fetchClientOperations(client: AxiosInstance, membershipId: number, page = 1): Promise<Paginated<Operation>> {
  const { data } = await client.get<Paginated<Operation>>(`/admin/clients/${membershipId}/operations`, { params: { page } })
  return data
}

export async function recordOperation(client: AxiosInstance, membershipId: number, input: NewOperation): Promise<Operation> {
  const { data } = await client.post<{ data: Operation }>(`/admin/clients/${membershipId}/operations`, input)
  return data.data
}

export async function fetchPendingOperations(client: AxiosInstance): Promise<Operation[]> {
  const { data } = await client.get<{ data: Operation[] }>('/admin/operations/pending')
  return data.data
}

export async function updateOperation(client: AxiosInstance, id: string, input: OperationEdit): Promise<Operation> {
  const { data } = await client.patch<{ data: Operation }>(`/admin/operations/${id}`, input)
  return data.data
}

export async function confirmOperation(client: AxiosInstance, id: string, input: OperationEdit = {}): Promise<Operation> {
  const { data } = await client.post<{ data: Operation }>(`/admin/operations/${id}/confirm`, input)
  return data.data
}

export async function rejectOperation(client: AxiosInstance, id: string, reason?: string): Promise<Operation> {
  const { data } = await client.post<{ data: Operation }>(`/admin/operations/${id}/reject`, { reason })
  return data.data
}

export async function changeOperationDate(client: AxiosInstance, id: string, occurredAt: string): Promise<Operation> {
  const { data } = await client.put<{ data: Operation }>(`/admin/operations/${id}/date`, { occurred_at: occurredAt })
  return data.data
}

// Client

export async function fetchClientBanks(client: AxiosInstance): Promise<ClientBank[]> {
  const { data } = await client.get<{ data: ClientBank[] }>('/client/banks')
  return data.data
}

export async function fetchMyOperations(client: AxiosInstance, bankId: number, page = 1): Promise<Paginated<Operation>> {
  const { data } = await client.get<Paginated<Operation>>(`/client/banks/${bankId}/operations`, { params: { page } })
  return data
}

export async function requestOperation(client: AxiosInstance, bankId: number, input: NewOperation & { id: string }): Promise<Operation> {
  const { data } = await client.post<{ data: Operation }>(`/client/banks/${bankId}/operations`, input)
  return data.data
}

export async function cancelMyOperation(client: AxiosInstance, bankId: number, id: string): Promise<Operation> {
  const { data } = await client.post<{ data: Operation }>(`/client/banks/${bankId}/operations/${id}/cancel`)
  return data.data
}

/** Own email and/or password, confirmed with the current password. */
export async function updateProfile(
  client: AxiosInstance,
  input: { current_password: string; email?: string; password?: string; password_confirmation?: string },
): Promise<User> {
  const { data } = await client.put<{ data: User }>('/auth/profile', input)
  return data.data
}
