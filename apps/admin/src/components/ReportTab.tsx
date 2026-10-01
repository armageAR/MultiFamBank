import { fetchExpenseReport, toApiError } from '@multifambank/api-client'
import { Alert, Card, formatArs, formatDate, formatUsd } from '@multifambank/ui'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api'
import { keys } from '../queries'

function shift(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(year, m - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const currentMonth = () => shift(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`, 0)
const label = (month: string) => {
  const text = new Date(`${month}-15T12:00:00`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Bank-funded expenses of a month, by client; the clients' own savings movements are shown apart. */
export function ReportTab() {
  const [month, setMonth] = useState(currentMonth)
  const [open, setOpen] = useState<number | null>(null)
  const report = useQuery({ queryKey: keys.report(month), queryFn: () => fetchExpenseReport(api, month) })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-1 shadow-sm">
        <button type="button" onClick={() => setMonth(shift(month, -1))} className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:text-gray-900" aria-label="Mes anterior">
          ‹
        </button>
        <p className="text-sm font-semibold text-gray-900">{label(month)}</p>
        <button
          type="button"
          onClick={() => setMonth(shift(month, 1))}
          disabled={month >= currentMonth()}
          className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:text-gray-900 disabled:opacity-30"
          aria-label="Mes siguiente"
        >
          ›
        </button>
      </div>

      {report.isPending ? (
        <p className="text-center text-sm text-gray-500">Cargando…</p>
      ) : report.isError ? (
        <Alert tone="error">{toApiError(report.error).message}</Alert>
      ) : (
        <>
          <Card title="Gastos pagados por el banco">
            <p className="text-2xl font-bold text-gray-900">{formatArs(report.data.total_ars)}</p>
            {report.data.by_client.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">No hubo gastos este mes.</p>
            ) : (
              <ul className="mt-3 flex flex-col">
                {report.data.by_client.map((client) => (
                  <li key={client.membership_id} className="border-t border-gray-100 py-2">
                    <button
                      type="button"
                      onClick={() => setOpen(open === client.membership_id ? null : client.membership_id)}
                      aria-expanded={open === client.membership_id}
                      className="flex w-full items-center justify-between gap-2 text-left"
                    >
                      <span className="text-sm text-gray-900">{client.name}</span>
                      <span className="text-sm font-semibold text-gray-900">{formatArs(client.total_ars)}</span>
                    </button>
                    {open === client.membership_id && (
                      <ul className="mt-2 flex flex-col gap-1">
                        {client.expenses.map((expense) => (
                          <li key={expense.money_request_id} className="flex justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-xs">
                            <span className="text-gray-700">
                              {formatDate(expense.occurred_at)} · {expense.description}
                            </span>
                            <span className="shrink-0 text-gray-900">{formatArs(expense.amount_ars)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Movimientos de ahorros (no son gastos)">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-emerald-50 px-4 py-3">
                <p className="text-xs text-emerald-700">Depósitos</p>
                <p className="text-base font-bold text-emerald-700">{formatArs(report.data.savings.deposits_ars)}</p>
                <p className="text-xs text-emerald-700">{formatUsd(report.data.savings.deposits_usd)}</p>
              </div>
              <div className="rounded-xl bg-gray-50 px-4 py-3">
                <p className="text-xs text-gray-500">Retiros</p>
                <p className="text-base font-bold text-gray-900">{formatArs(report.data.savings.withdrawals_ars)}</p>
                <p className="text-xs text-gray-500">{formatUsd(report.data.savings.withdrawals_usd)}</p>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
