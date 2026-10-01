import { useLook, type Look } from './look'

type Tone = 'ok' | 'warning' | 'error' | 'neutral'

const tones: Record<Look, Record<Tone, string>> = {
  platform: {
    ok: 'rounded-full px-2.5 py-0.5 text-sm font-medium bg-emerald-100 text-emerald-800',
    warning: 'rounded-full px-2.5 py-0.5 text-sm font-medium bg-amber-100 text-amber-800',
    error: 'rounded-full px-2.5 py-0.5 text-sm font-medium bg-red-100 text-red-800',
    neutral: 'rounded-full px-2.5 py-0.5 text-sm font-medium bg-slate-100 text-slate-700',
  },
  family: {
    ok: 'rounded-md border px-1.5 py-0.5 text-xs border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'rounded-md border px-1.5 py-0.5 text-xs border-amber-200 bg-amber-100 text-amber-700',
    error: 'rounded-md border px-1.5 py-0.5 text-xs border-red-200 bg-red-50 text-red-600',
    neutral: 'rounded-md border px-1.5 py-0.5 text-xs border-gray-200 bg-gray-100 text-gray-600',
  },
}

export function StatusBadge({ tone, label }: { tone: Tone; label: string }) {
  return <span className={`inline-flex whitespace-nowrap ${tones[useLook()][tone]}`}>{label}</span>
}
