/** Number formatting as in the original FamBank (es-AR). */
export function formatNumber(value: string | number, decimals = 2): string {
  return Number(value).toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export const formatUsd = (value: string | number) => `USD ${formatNumber(value)}`
export const formatArs = (value: string | number) => `$ ${formatNumber(value, 0)}`

const dateFormat = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const dateTimeFormat = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function formatDate(value: string | null | undefined, empty = '—'): string {
  return value ? dateFormat.format(new Date(value)) : empty
}

export function formatDateTime(value: string | null | undefined, empty = '—'): string {
  return value ? dateTimeFormat.format(new Date(value)).replace(',', '') : empty
}

/** "2026-09-15T12:00" for <input type="datetime-local">, in the browser's timezone. */
export function toDateTimeLocal(value: string | Date): string {
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export type OperationTypeValue = 'savings_deposit' | 'savings_withdrawal' | 'expense'
export type OperationStatusValue = 'pending' | 'confirmed' | 'rejected' | 'canceled'

/** Labels per audience; whose money moves is always spelled out, never only colored. */
export const operationLabels: Record<OperationTypeValue, { admin: string; client: string; source: { admin: string; client: string } }> = {
  savings_deposit: { admin: 'Depósito', client: 'Depósito', source: { admin: 'Ahorros del cliente', client: 'Mis ahorros' } },
  savings_withdrawal: { admin: 'Retiro', client: 'Retiro', source: { admin: 'Ahorros del cliente', client: 'Mis ahorros' } },
  expense: { admin: 'Gasto', client: 'Gasto', source: { admin: 'Dinero del banco', client: 'Dinero del banco' } },
}

export const operationStatusLabels: Record<OperationStatusValue, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  rejected: 'Rechazada',
  canceled: 'Cancelada',
}
