import { fetchExchangeRates } from '@multifambank/api-client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'

export const keys = {
  dashboard: ['admin', 'dashboard'] as const,
  pending: ['admin', 'pending'] as const,
  clients: ['admin', 'clients'] as const,
  history: (membershipId: number) => ['admin', 'history', membershipId] as const,
  report: (month: string) => ['admin', 'report', month] as const,
  rates: ['exchange-rates'] as const,
}

export function useExchangeRates() {
  return useQuery({ queryKey: keys.rates, queryFn: () => fetchExchangeRates(api), staleTime: 5 * 60_000, retry: false })
}

/** After any write, everything derived from balances or operations is refreshed. */
export function useRefreshAdminData() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['admin'] })
}
