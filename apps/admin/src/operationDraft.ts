import type { ExchangeRates, OperationType } from '@multifambank/api-client'

export interface OperationDraft {
  type: OperationType
  amount: string
  description: string
  rate: string
  /** datetime-local value; empty means "when it is confirmed". */
  occurredAt: string
}

/** The rate a new savings operation starts from, as in FamBank: deposits blue sell, withdrawals blue buy. */
export function suggestedRate(type: OperationType, rates: ExchangeRates | undefined): string {
  if (!rates || type === 'expense') return ''
  return type === 'savings_deposit' ? rates.blue.sell : rates.blue.buy
}
