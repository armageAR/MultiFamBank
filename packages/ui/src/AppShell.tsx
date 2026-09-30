import type { ReactNode } from 'react'

interface AppShellProps {
  title: string
  subtitle?: string
  children: ReactNode
}

export function AppShell({ title, subtitle, children }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-slate-50 font-sans text-slate-900">
      <header className="bg-brand-900 px-4 py-5 text-white">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-medium text-brand-100">MultiFamBank</p>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-brand-100">{subtitle}</p>}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  )
}
