import type { ReactNode } from 'react'
import { EnvironmentBadge } from './EnvironmentBadge'
import { environmentLabel } from './environment'

/** Centered card for sign-in, password and invitation pages. */
export function AuthLayout({ appName, title, children }: { appName: string; title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 font-sans text-slate-900">
      {environmentLabel && (
        <div role="note" className="bg-red-600 px-4 py-2 text-center text-sm font-bold tracking-wide text-white uppercase">
          {environmentLabel} · Entorno de pruebas, no es producción
        </div>
      )}
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <p className="text-center text-sm font-medium text-brand-700">MultiFamBank · {appName}</p>
          <div className="mt-1 mb-6 flex flex-wrap items-center justify-center gap-3">
            <h1 className="text-center text-2xl font-semibold">{title}</h1>
            <EnvironmentBadge />
          </div>
          <div
            className={`rounded-xl bg-white p-6 shadow-sm ${environmentLabel ? 'border-2 border-red-500' : 'border border-slate-200'}`}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
