import type { ReactNode } from 'react'
import { useLook, type Look } from './look'

type Tone = 'info' | 'success' | 'warning' | 'error'

const tones: Record<Look, Record<Tone, string>> = {
  platform: {
    info: 'rounded-lg border-brand-100 bg-brand-50 text-brand-900 text-sm',
    success: 'rounded-lg border-emerald-200 bg-emerald-50 text-emerald-900 text-sm',
    warning: 'rounded-lg border-amber-200 bg-amber-50 text-amber-900 text-sm',
    error: 'rounded-lg border-red-200 bg-red-50 text-red-900 text-sm',
  },
  family: {
    info: 'rounded-xl border-gray-200 bg-gray-50 text-gray-700 text-xs',
    success: 'rounded-xl border-emerald-200 bg-emerald-50 text-emerald-700 text-xs',
    warning: 'rounded-xl border-amber-200 bg-amber-50 text-amber-700 text-xs',
    error: 'rounded-xl border-red-200 bg-red-50 text-red-600 text-xs',
  },
}

export function Alert({ tone = 'info', title, children }: { tone?: Tone; title?: string; children?: ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`border px-4 py-3 ${tones[useLook()][tone]}`}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-1' : undefined}>{children}</div>}
    </div>
  )
}
