import { StatusBadge } from './StatusBadge'

export type BankStatusValue = 'pending_configuration' | 'active' | 'paused' | 'deactivated'

const statuses: Record<BankStatusValue, { label: string; tone: 'ok' | 'warning' | 'error' | 'neutral' }> = {
  pending_configuration: { label: 'Pendiente de configuración', tone: 'warning' },
  active: { label: 'Activo', tone: 'ok' },
  paused: { label: 'Pausado', tone: 'neutral' },
  deactivated: { label: 'Desactivado', tone: 'error' },
}

export const bankStatusLabels: Record<BankStatusValue, string> = Object.fromEntries(
  Object.entries(statuses).map(([status, { label }]) => [status, label]),
) as Record<BankStatusValue, string>

export function BankStatusBadge({ status }: { status: BankStatusValue }) {
  const { label, tone } = statuses[status]
  return <StatusBadge tone={tone} label={label} />
}
