const dateFormat = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export function formatDate(value: string | null | undefined): string {
  return value ? dateFormat.format(new Date(value)) : '—'
}
