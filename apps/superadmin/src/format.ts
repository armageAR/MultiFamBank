const dateFormat = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export function formatDate(value: string | null | undefined): string {
  return value ? dateFormat.format(new Date(value)) : '—'
}

const dateTimeFormat = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function formatDateTime(value: string | null | undefined, empty = '—'): string {
  return value ? dateTimeFormat.format(new Date(value)).replace(',', '') : empty
}
