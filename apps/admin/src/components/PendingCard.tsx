import { confirmOperation, rejectOperation, toApiError, type Operation } from '@multifambank/api-client'
import { Alert, Button, formatArs, formatDateTime, formatUsd, Modal, operationLabels, OperationTypeBadge, TextField } from '@multifambank/ui'
import { useState } from 'react'
import { api } from '../api'
import { useRefreshAdminData } from '../queries'

interface Props {
  operation: Operation
  readOnly: boolean
  onReview: (operation: Operation) => void
  onError: (message: string) => void
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

/** A pending request, as FamBank's card: who, how much, and quick review, reject or confirm. */
export function PendingCard({ operation, readOnly, onReview, onError }: Props) {
  const refresh = useRefreshAdminData()
  const [confirming, setConfirming] = useState(false)
  const [rejecting, setRejecting] = useState(false)

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
          <p className="truncate text-lg font-bold text-gray-900">{operation.client?.name}</p>
          <p className="text-xs text-gray-500">Pedido el {formatDateTime(operation.created_at)}</p>
        </div>
        <OperationTypeBadge type={operation.type} audience="admin" />
      </div>
      <div className="text-right">
        <p className="text-2xl font-bold text-gray-900">{formatArs(operation.amount_ars)}</p>
        {operation.amount_usd && operation.exchange_rate && (
          <p className="text-xs text-gray-500">
            ≈ {formatUsd(operation.amount_usd)} a {formatArs(operation.exchange_rate)}
          </p>
        )}
      </div>
      {operation.description && <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700">{operation.description}</p>}
      {!readOnly && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onReview(operation)}
            aria-label="Revisar"
            title="Revisar"
            className="flex shrink-0 items-center justify-center rounded-xl border border-gray-200 px-3.5 text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
          >
            <EyeIcon />
          </button>
          <button
            type="button"
            onClick={() => setRejecting(true)}
            disabled={confirming}
            className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-40"
          >
            Rechazar
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
      {rejecting && <RejectModal operation={operation} onClose={() => setRejecting(false)} />}
    </div>
  )
}

/** Rejecting cannot be undone: confirm it, with an optional reason the client will see. */
function RejectModal({ operation, onClose }: { operation: Operation; onClose: () => void }) {
  const refresh = useRefreshAdminData()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reject() {
    setBusy(true)
    setError(null)
    try {
      await rejectOperation(api, operation.id, reason.trim() || undefined)
      await refresh()
      onClose()
    } catch (err) {
      setError(toApiError(err).message)
      setBusy(false)
    }
  }

  return (
    <Modal title="Rechazar pedido" onClose={onClose}>
      <p className="text-sm text-gray-700">
        {operationLabels[operation.type].admin} de <strong>{formatArs(operation.amount_ars)}</strong> pedido por <strong>{operation.client?.name}</strong>. El
        cliente va a ver que se rechazó.
      </p>
      <TextField label="Motivo del rechazo (opcional)" maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} />
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="danger" className="flex-1" loading={busy} onClick={reject}>
          Rechazar pedido
        </Button>
      </div>
    </Modal>
  )
}
