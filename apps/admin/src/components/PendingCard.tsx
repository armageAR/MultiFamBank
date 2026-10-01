import { confirmOperation, toApiError, type Operation } from '@multifambank/api-client'
import { formatArs, formatDateTime, formatUsd, OperationTypeBadge } from '@multifambank/ui'
import { useState } from 'react'
import { api } from '../api'
import { useRefreshAdminData } from '../queries'

interface Props {
  operation: Operation
  readOnly: boolean
  onReview: (operation: Operation) => void
  onError: (message: string) => void
}

/** A pending request, as FamBank's card: who, what, how much, and quick confirm. */
export function PendingCard({ operation, readOnly, onReview, onError }: Props) {
  const refresh = useRefreshAdminData()
  const [confirming, setConfirming] = useState(false)

  async function confirm() {
    setConfirming(true)
    try {
      await confirmOperation(api, operation.id)
      await refresh()
    } catch (error) {
      onError(toApiError(error).message)
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{operation.client?.name}</p>
          <p className="text-xs text-gray-500">Pedido el {formatDateTime(operation.created_at)}</p>
        </div>
        <OperationTypeBadge type={operation.type} audience="admin" />
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xl font-bold text-gray-900">{formatArs(operation.amount_ars)}</p>
          {operation.amount_usd && (
            <p className="text-xs text-gray-500">
              ≈ {formatUsd(operation.amount_usd)} a $ {Number(operation.exchange_rate).toLocaleString('es-AR')}
            </p>
          )}
        </div>
      </div>
      {operation.description && <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700">{operation.description}</p>}
      {!readOnly && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onReview(operation)}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
          >
            Revisar
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={confirming}
            className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
          >
            {confirming ? 'Confirmando…' : 'Confirmar'}
          </button>
        </div>
      )}
    </div>
  )
}
