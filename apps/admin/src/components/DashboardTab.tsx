import { fetchAdminDashboard, fetchExchangeRates, toApiError } from '@multifambank/api-client'
import { Alert, Card, formatArs, formatUsd } from '@multifambank/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api'
import { keys } from '../queries'

const monthName = (month: string) => {
  const text = new Date(`${month}-15T12:00:00`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function Quote({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-4 py-3">
      <p className="text-right text-xs text-gray-500">{label}</p>
      <p className="text-right text-xl font-bold whitespace-nowrap text-gray-900">{formatArs(value)}</p>
    </div>
  )
}

export function DashboardTab() {
  const queryClient = useQueryClient()
  const dashboard = useQuery({ queryKey: keys.dashboard, queryFn: () => fetchAdminDashboard(api) })
  const rates = dashboard.data?.exchange_rates ?? null

  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  async function refreshRates() {
    setRefreshing(true)
    setRefreshError(null)
    try {
      queryClient.setQueryData(keys.rates, await fetchExchangeRates(api, true))
      await queryClient.invalidateQueries({ queryKey: keys.dashboard })
    } catch (error) {
      setRefreshError(toApiError(error).message)
    } finally {
      setRefreshing(false)
    }
  }

  if (dashboard.isPending) return <p className="text-center text-sm text-gray-500">Cargando…</p>
  if (dashboard.isError) return <Alert tone="error">{toApiError(dashboard.error).message}</Alert>

  const data = dashboard.data
  const totalArs = rates ? Number(data.balance_usd) * Number(rates.blue.buy) : null

  return (
    <div className="flex flex-col gap-4">
      <Card title="Ahorros de los clientes">
        <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
          <div className="rounded-xl bg-emerald-50 px-4 py-3 text-right">
            <p className="mb-1 text-xs text-emerald-700">Dólares</p>
            <p className="text-lg font-bold whitespace-nowrap text-emerald-700">{formatUsd(data.balance_usd)}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3 text-right">
            <p className="mb-1 text-xs text-gray-500">
              Pesos <span className="text-gray-500">(blue compra)</span>
            </p>
            <p className="text-lg font-bold whitespace-nowrap text-gray-900">{totalArs !== null ? formatArs(totalArs) : '—'}</p>
          </div>
        </div>
        {Number(data.reserved_usd) > 0 && (
          <p className="mt-3 text-xs text-gray-500">
            {formatUsd(data.reserved_usd)} reservados por retiros pendientes · disponible {formatUsd(data.available_usd)}
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        <Card title="Gastos del banco">
          <p className="text-right text-xl font-bold whitespace-nowrap text-gray-900">{formatArs(data.month_expenses_ars)}</p>
          <p className="mt-1 text-right text-xs text-gray-500">{monthName(data.month)}</p>
        </Card>
        <Card title="Clientes">
          <p className="text-xl font-bold text-gray-900">{data.clients}</p>
          <p className="mt-1 text-xs text-gray-500">{data.pending_requests} pedidos pendientes</p>
        </Card>
      </div>

      <Card title="Cotizaciones">
        {rates ? (
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-gray-500">Dólar blue</p>
                <button type="button" onClick={refreshRates} disabled={refreshing} className="text-xs text-gray-500 transition-colors hover:text-emerald-600 disabled:opacity-50">
                  {refreshing ? 'actualizando…' : 'actualizar'}
                </button>
              </div>
              {refreshError && <p className="mb-2 text-xs text-red-600">{refreshError}</p>}
              <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
                <Quote label="Compra" value={rates.blue.buy} />
                <Quote label="Venta" value={rates.blue.sell} />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs text-gray-500">Dólar oficial</p>
              <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
                <Quote label="Compra" value={rates.oficial.buy} />
                <Quote label="Venta" value={rates.oficial.sell} />
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-red-600">No se pudo obtener la cotización.</p>
        )}
      </Card>
    </div>
  )
}
