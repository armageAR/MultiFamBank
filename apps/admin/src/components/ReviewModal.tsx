import { confirmOperation, rejectOperation, toApiError, updateOperation, type ApiError, type Operation, type OperationEdit } from '@multifambank/api-client'
import { Alert, Button, formatArs, Modal, operationLabels, parseAmount, TextField, toAmountInput, toDateTimeLocal } from '@multifambank/ui'
import { useState } from 'react'
import { api } from '../api'
import { localToIso } from '../amounts'
import { useExchangeRates, useRefreshAdminData } from '../queries'
import { type OperationDraft } from '../operationDraft'
import { OperationFields } from './OperationFields'

/** Everything about a pending request can change before confirming: type, amount, comment, date and rate. */
export function ReviewModal({ operation, onClose }: { operation: Operation; onClose: () => void }) {
  const refresh = useRefreshAdminData()
  const rates = useExchangeRates()
  const [draft, setDraft] = useState<OperationDraft>({
    type: operation.type,
    amount: toAmountInput(operation.amount_ars),
    description: operation.description ?? '',
    rate: toAmountInput(operation.exchange_rate),
    occurredAt: operation.occurred_at ? toDateTimeLocal(operation.occurred_at) : '',
  })
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState<'save' | 'confirm' | 'reject' | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  function changes(): OperationEdit | null {
    const amount = parseAmount(draft.amount)
    const rate = draft.type === 'expense' ? null : parseAmount(draft.rate, 4)
    const fields: Record<string, string> = {}
    if (!amount) fields.amount_ars = 'Ingresá un monto válido.'
    if (draft.type !== 'expense' && !rate) fields.exchange_rate = 'Ingresá la cotización.'
    if (draft.type === 'expense' && !draft.description.trim()) fields.description = 'Para un gasto hay que explicar para qué es la plata.'
    if (Object.keys(fields).length) {
      setError({ message: Object.values(fields)[0], fields })
      return null
    }
    return {
      type: draft.type,
      amount_ars: amount!,
      description: draft.description.trim() || null,
      exchange_rate: rate,
      occurred_at: localToIso(draft.occurredAt),
    }
  }

  async function run(action: 'save' | 'confirm' | 'reject') {
    const edits = action === 'reject' ? {} : changes()
    if (edits === null) return
    setBusy(action)
    setError(null)
    try {
      if (action === 'save') await updateOperation(api, operation.id, edits)
      if (action === 'confirm') await confirmOperation(api, operation.id, edits)
      if (action === 'reject') await rejectOperation(api, operation.id, reason.trim() || undefined)
      await refresh()
      onClose()
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setBusy(null)
    }
  }

  const requested = operation.requested

  return (
    <Modal title={`Pedido · ${operation.client?.name ?? ''}`} onClose={onClose}>
      <p className="text-xs text-gray-500">
        Pidió: {operationLabels[requested.type].admin} de {formatArs(requested.amount_ars)}
        {requested.description ? ` — “${requested.description}”` : ''}
      </p>
      {error && !Object.keys(error.fields).some((f) => ['type', 'amount_ars', 'description', 'exchange_rate', 'occurred_at'].includes(f)) && (
        <Alert tone="error">{error.message}</Alert>
      )}

      {rejecting ? (
        <>
          <TextField label="Motivo del rechazo (opcional)" maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setRejecting(false)}>
              Volver
            </Button>
            <Button variant="danger" className="flex-1" loading={busy === 'reject'} onClick={() => run('reject')}>
              Rechazar pedido
            </Button>
          </div>
        </>
      ) : (
        <>
          <OperationFields
            draft={draft}
            onChange={setDraft}
            errors={error?.fields ?? {}}
            rates={rates.data}
            dateHint="Vacía: se usa el momento en que confirmes."
          />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" loading={busy === 'save'} onClick={() => run('save')}>
              Guardar
            </Button>
            <Button variant="danger" className="flex-1" onClick={() => setRejecting(true)}>
              Rechazar
            </Button>
            <Button className="flex-1" loading={busy === 'confirm'} onClick={() => run('confirm')}>
              Confirmar
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}
