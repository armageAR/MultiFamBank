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
  } | null
  created_at: string
  activated_at: string | null
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
