import type { Look } from './look'

/** Shared by TextField and SelectField so every control in a look matches. */
export const fieldStyles: Record<Look, { label: string; control: string; invalid: string; valid: string; hint: string; error: string }> = {
  platform: {
    label: 'mb-1 block text-sm font-medium text-slate-700',
    control: 'w-full rounded-lg border bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-brand-600',
    invalid: 'border-red-500',
    valid: 'border-slate-300',
    hint: 'mt-1 text-sm text-slate-500',
    error: 'mt-1 text-sm text-red-700',
  },
  family: {
    label: 'mb-1.5 block text-xs font-medium tracking-wide text-gray-500 uppercase',
    control:
      'w-full rounded-xl border bg-gray-50 px-4 py-3 text-base text-gray-900 transition-colors placeholder:text-gray-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none',
    invalid: 'border-red-300',
    valid: 'border-gray-200',
    hint: 'mt-1 text-xs text-gray-500',
    error: 'mt-1 text-xs text-red-500',
  },
}
