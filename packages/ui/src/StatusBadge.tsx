type Tone = 'ok' | 'warning' | 'error' | 'neutral'

const tones: Record<Tone, string> = {
  ok: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-800',
  neutral: 'bg-slate-100 text-slate-700',
}

export function StatusBadge({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-medium ${tones[tone]}`}>
      {label}
    </span>
  )
}
