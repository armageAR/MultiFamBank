import type { ReactNode } from 'react'

/** Centered card for sign-in, password and invitation pages. */
export function AuthLayout({ appName, title, children }: { appName: string; title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10 font-sans text-slate-900">
      <div className="w-full max-w-md">
        <p className="text-center text-sm font-medium text-brand-700">MultiFamBank · {appName}</p>
        <h1 className="mt-1 mb-6 text-center text-2xl font-semibold">{title}</h1>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
      </div>
    </div>
  )
}
