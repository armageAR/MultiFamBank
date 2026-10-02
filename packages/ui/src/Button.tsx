import type { ButtonHTMLAttributes } from 'react'
import { useLook, type Look } from './look'

type Variant = 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost'

const base: Record<Look, string> = {
  platform:
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed',
  family:
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-40',
}

const variants: Record<Look, Record<Variant, string>> = {
  platform: {
    primary: 'bg-brand-700 text-white hover:bg-brand-900 disabled:bg-slate-400',
    secondary: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:text-slate-400',
    danger: 'bg-red-700 text-white hover:bg-red-800 disabled:bg-slate-400',
    warning: 'bg-amber-500 text-white hover:bg-amber-600 disabled:bg-slate-400',
    ghost: 'text-current underline-offset-4 hover:underline',
  },
  family: {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-500',
    secondary: 'border border-gray-200 bg-white font-normal text-gray-600 hover:border-gray-300 hover:text-gray-900',
    danger: 'bg-red-600 text-white hover:bg-red-500',
    warning: 'bg-amber-500 text-white hover:bg-amber-400',
    ghost: 'font-normal text-current underline-offset-4 hover:underline',
  },
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
}

export function Button({ variant = 'primary', loading = false, disabled, className = '', children, ...props }: ButtonProps) {
  const look = useLook()

  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${base[look]} ${variants[look][variant]} ${className}`}
    >
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  )
}
