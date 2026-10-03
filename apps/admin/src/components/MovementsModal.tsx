import { fetchAdminClients, fetchMovementsReport, toApiError } from '@multifambank/api-client'
import { Alert, formatArs, formatUsd, Modal, SelectField } from '@multifambank/ui'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api'
import { keys } from '../queries'

const pad = (n: number) => String(n).padStart(2, '0')
const day = (date: Date) => `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`
const when = (value: string) => {
  const date = new Date(value)
  return `${day(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function lastDay(month: string) {
  const [year, m] = month.split('-').map(Number)
  return day(new Date(year, m, 0))
}

/** Every movement of the month: bank expenses with their total, and savings from opening to closing balance. */
export function MovementsModal({ month, monthLabel, onClose }: { month: string; monthLabel: string; onClose: () => void }) {
  const [membershipId, setMembershipId] = useState<number | undefined>(undefined)
  const clients = useQuery({ queryKey: keys.clients, queryFn: () => fetchAdminClients(api) })
  const report = useQuery({ queryKey: keys.movements(month, membershipId), queryFn: () => fetchMovementsReport(api, month, membershipId) })
  const showClient = membershipId === undefined

  return (
    <Modal title={`Movimientos · ${monthLabel}`} onClose={onClose}>
      <SelectField
        label="Cliente"
        value={membershipId ?? ''}
        onChange={(e) => setMembershipId(e.target.value ? Number(e.target.value) : undefined)}
      >
        <option value="">Todos los clientes</option>
        {clients.data?.clients.map((client) => (
          <option key={client.membership_id} value={client.membership_id}>
            {client.name}
          </option>
        ))}
      </SelectField>

      {report.isPending ? (
        <p className="text-center text-sm text-gray-500">Cargando…</p>
      ) : report.isError ? (
        <Alert tone="error">{toApiError(report.error).message}</Alert>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3 border-b border-gray-100 pb-2">
              <h3 className="text-xs font-semibold tracking-wide text-amber-700 uppercase">Gastos · dinero del banco</h3>
              <p className="text-right text-base font-bold whitespace-nowrap text-gray-900">{formatArs(report.data.expenses.total_ars)}</p>
            </div>
            {report.data.expenses.items.length === 0 ? (
              <p className="text-sm text-gray-500">No hubo gastos este mes.</p>
            ) : (
              <ul className="flex flex-col">
                {report.data.expenses.items.map((item) => (
                  <li key={item.money_request_id} className="flex items-start justify-between gap-3 border-b border-gray-50 py-2 last:border-0">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">
                        {when(item.occurred_at)}
                        {showClient && ` · ${item.client}`}
                      </p>
                      <p className="text-sm text-gray-900">{item.description}</p>
                    </div>
                    <p className="text-right text-sm font-semibold whitespace-nowrap text-gray-900">{formatArs(item.amount_ars)}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-baseline justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2 text-amber-800">
              <span className="text-sm">Total de gastos</span>
              <span className="text-right font-bold whitespace-nowrap">{formatArs(report.data.expenses.total_ars)}</span>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="border-b border-gray-100 pb-2 text-xs font-semibold tracking-wide text-emerald-700 uppercase">Ahorros · depósitos y retiros</h3>
            <div className="flex items-baseline justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2">
              <span className="text-sm text-gray-700">Saldo inicial al 01/{month.slice(5)}</span>
              <span className="text-right font-bold whitespace-nowrap text-gray-900">{formatUsd(report.data.savings.opening_usd)}</span>
            </div>
            {report.data.savings.items.length === 0 ? (
              <p className="text-sm text-gray-500">No hubo depósitos ni retiros este mes.</p>
            ) : (
              <ul className="flex flex-col">
                {report.data.savings.items.map((item) => {
                  const deposit = item.type === 'deposit'
                  return (
                    <li key={item.money_request_id} className="flex items-start justify-between gap-3 border-b border-gray-50 py-2 last:border-0">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">
                          {when(item.occurred_at)}
                          {showClient && ` · ${item.client}`}
                        </p>
                        <p className={`text-sm font-medium ${deposit ? 'text-emerald-700' : 'text-red-600'}`}>{deposit ? 'Depósito' : 'Retiro'}</p>
                        {item.description && <p className="text-sm text-gray-700">{item.description}</p>}
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <p className={`text-sm font-semibold ${deposit ? 'text-emerald-700' : 'text-red-600'}`}>
                          {deposit ? '+' : '−'} {formatUsd(item.amount_usd)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatArs(item.amount_ars)} a {formatArs(item.exchange_rate)}
                        </p>
                        <p className="text-xs text-gray-500">Saldo {formatUsd(item.balance_usd)}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="flex flex-col gap-1 rounded-xl bg-emerald-50 px-3 py-2 text-sm">
              <p className="flex justify-between gap-3 text-emerald-700">
                <span>Depósitos</span>
                <span className="whitespace-nowrap">+ {formatUsd(report.data.savings.deposits_usd)}</span>
              </p>
              <p className="flex justify-between gap-3 text-red-600">
                <span>Retiros</span>
                <span className="whitespace-nowrap">− {formatUsd(report.data.savings.withdrawals_usd)}</span>
              </p>
              <p className="flex justify-between gap-3 border-t border-emerald-100 pt-1 font-bold text-gray-900">
                <span>Saldo final al {lastDay(month)}</span>
                <span className="whitespace-nowrap">{formatUsd(report.data.savings.closing_usd)}</span>
              </p>
            </div>
          </section>
        </>
      )}
    </Modal>
  )
}
