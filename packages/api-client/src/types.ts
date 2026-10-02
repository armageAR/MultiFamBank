export type BankStatus = 'pending_configuration' | 'active' | 'paused' | 'deactivated'
export type InvitationState = 'pending' | 'accepted' | 'expired' | 'revoked'

export interface HealthResponse {
  status: 'ok' | 'degraded'
  app: string
  database: 'ok' | 'unavailable'
  time: string
}

export interface User {
  id: number
  name: string
  email: string
  is_superadmin: boolean
  administered_bank: { id: number; name: string | null; status: BankStatus } | null
}

export interface AuthResponse {
  token: string
  user: User
}

export interface PlatformBank {
  id: number
  name: string | null
  status: BankStatus
  timezone: string
  admin: { email: string; name: string | null; accepted: boolean }
  invitation: {
    state: InvitationState
    expires_at: string
    last_sent_at: string | null
    accepted_at: string | null
    resend_available_at: string
  } | null
  created_at: string
  activated_at: string | null
  paused_at: string | null
  deactivated_at: string | null
}

export type BankLifecycleAction = 'pause' | 'resume' | 'deactivate' | 'reactivate'

export interface PlatformBankClient {
  id: number
  name: string
  email: string
  status: 'active' | 'removed'
  member_since: string
  last_seen_at: string | null
}

export interface PlatformBankDetail extends PlatformBank {
  admin: PlatformBank['admin'] & { last_seen_at: string | null }
  clients: PlatformBankClient[]
}

export interface UpdateAdminResponse {
  data: PlatformBankDetail
  /** Set when a pending administrator's email changed and a new invitation was issued. */
  email_sent: boolean | null
  invitation_url: string | null
}

export interface PlatformBankList {
  data: PlatformBank[]
  counts: Record<BankStatus, number>
  meta: { current_page: number; last_page: number; per_page: number; total: number }
}

export interface CreateBankResponse {
  data: PlatformBank
  email_sent: boolean
  /** Present only while the API has no email delivery configured. */
  invitation_url: string | null
}

export interface InvitationDetails {
  type: 'bank_admin' | 'bank_client'
  state: InvitationState
  email: string
  name: string
  expires_at: string
  bank: { name: string | null; status: BankStatus }
  has_account: boolean
}

export interface AdminBank {
  id: number
  name: string | null
  timezone: string
  status: BankStatus
  activated_at: string | null
}

// ── Operations ────────────────────────────────────────────────────────────────

export type OperationType = 'savings_deposit' | 'savings_withdrawal' | 'expense'
export type OperationStatus = 'pending' | 'confirmed' | 'rejected' | 'canceled'

export interface Operation {
  id: string
  type: OperationType
  funding_source: 'client_savings' | 'bank_funds'
  status: OperationStatus
  amount_ars: string
  exchange_rate: string | null
  amount_usd: string | null
  description: string | null
  occurred_at: string | null
  created_at: string
  confirmed_at: string | null
  rejected_at: string | null
  rejection_reason: string | null
  canceled_at: string | null
  requested: { type: OperationType; amount_ars: string; description: string | null }
  changed_by_admin: boolean
  recorded_by_admin: boolean
  client: { membership_id: number; name: string } | null
}

export interface Paginated<T> {
  data: T[]
  meta: { current_page: number; last_page: number; per_page: number; total: number }
}

export interface OperationEdit {
  type?: OperationType
  amount_ars?: string
  description?: string | null
  occurred_at?: string | null
  exchange_rate?: string | null
}

export interface NewOperation {
  type: OperationType
  amount_ars: string
  description?: string | null
  exchange_rate?: string | null
  occurred_at?: string | null
}

export interface ExchangeRates {
  blue: { buy: string; sell: string }
  oficial: { buy: string; sell: string }
  fetched_at: string
}

// ── Bank administration ───────────────────────────────────────────────────────

export interface AdminClient {
  membership_id: number
  name: string
  email: string
  status: 'active' | 'removed'
  member_since: string
  last_seen_at: string | null
  balance_usd: string
  reserved_usd: string
  available_usd: string
  pending_requests: number
  manageable: boolean
}

export interface ClientInvitation {
  id: number
  email: string
  name: string
  state: InvitationState
  expires_at: string
  last_sent_at: string | null
  /** Another email to this person can be sent from this moment (5-minute pause). */
  resend_available_at: string
}

export interface InvitationResult {
  data: ClientInvitation
  email_sent: boolean
  invitation_url: string | null
}

export interface AdminDashboard {
  balance_usd: string
  reserved_usd: string
  available_usd: string
  clients: number
  pending_requests: number
  month: string
  month_expenses_ars: string
  exchange_rates: ExchangeRates | null
}

export interface ExpenseReport {
  month: string
  timezone: string
  total_ars: string
  by_client: {
    membership_id: number
    name: string
    total_ars: string
    expenses: { money_request_id: string; occurred_at: string; amount_ars: string; description: string | null }[]
  }[]
  savings: { deposits_ars: string; deposits_usd: string; withdrawals_ars: string; withdrawals_usd: string }
}

// ── Client ────────────────────────────────────────────────────────────────────

export interface ClientBank {
  bank: { id: number; name: string | null; status: BankStatus }
  balance_usd: string
  reserved_usd: string
  available_usd: string
}
