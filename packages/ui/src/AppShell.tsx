import type { ReactNode } from 'react'

interface AppShellProps {
  title: string
  subtitle?: string
  /** Right side of the header, e.g. the signed-in user and a sign-out button. */
  actions?: ReactNode
  children: ReactNode
}

export function AppShell({ title, subtitle, actions, children }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-slate-50 font-sans text-slate-900">
      <header className="bg-brand-900 px-4 py-5 text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-brand-100">MultiFamBank</p>
            <h1 className="text-2xl font-semibold">{title}</h1>
            {subtitle && <p className="mt-1 text-brand-100">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-3 text-sm">{actions}</div>}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  )
}
