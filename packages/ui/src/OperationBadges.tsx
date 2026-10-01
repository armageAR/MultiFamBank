import { operationLabels, operationStatusLabels, type OperationStatusValue, type OperationTypeValue } from './format'
import { StatusBadge } from './StatusBadge'

const typeStyles: Record<OperationTypeValue, string> = {
  savings_deposit: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  savings_withdrawal: 'border-red-200 bg-red-50 text-red-600',
  expense: 'border-amber-200 bg-amber-100 text-amber-700',
}

/** Type plus whose money it is, e.g. "Gasto · Dinero del banco". */
export function OperationTypeBadge({ type, audience }: { type: OperationTypeValue; audience: 'admin' | 'client' }) {
  const label = operationLabels[type]
  return (
    <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-xs whitespace-nowrap ${typeStyles[type]}`}>
      {label[audience]} · {label.source[audience]}
    </span>
  )
}

const statusTones = { pending: 'warning', confirmed: 'ok', rejected: 'error', canceled: 'neutral' } as const

export function OperationStatusBadge({ status }: { status: OperationStatusValue }) {
  return <StatusBadge tone={statusTones[status]} label={operationStatusLabels[status]} />
}
