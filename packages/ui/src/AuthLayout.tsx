import type { ReactNode } from 'react'
import { EnvironmentBadge } from './EnvironmentBadge'
import { environmentLabel } from './environment'
import { useLook } from './look'

function EnvironmentBanner() {
  if (!environmentLabel) return null

  return (
    <div role="note" className="bg-red-600 px-4 py-2 text-center text-sm font-bold tracking-wide text-white uppercase">
      {environmentLabel} · Entorno de pruebas, no es producción
    </div>
  )
}

/** Centered card for sign-in, password and invitation pages. */
export function AuthLayout({ appName, title, children }: { appName: string; title: string; children: ReactNode }) {
  const look = useLook()

  if (look === 'family') {
    return (
      <div className="flex min-h-dvh flex-col bg-gradient-to-b from-emerald-50 to-white font-sans text-gray-900">
        <EnvironmentBanner />
        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-sm">
            <div className="mb-8 flex flex-col items-center text-center">
              <img src="/favicon.svg" alt="" className="mb-3 size-14 rounded-2xl shadow-lg shadow-emerald-600/20" />
              <p className="mb-1 text-xs tracking-[0.3em] text-gray-400 uppercase">MultiFamBank</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
                <EnvironmentBadge />
              </div>
              <p className="mt-1 text-sm text-gray-500">{appName}</p>
            </div>
            <div
              className={`flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ${environmentLabel ? 'border-2 border-red-500' : 'border border-gray-100'}`}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 font-sans text-slate-900">
      <EnvironmentBanner />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <p className="text-center text-sm font-medium text-brand-700">MultiFamBank · {appName}</p>
          <div className="mt-1 mb-6 flex flex-wrap items-center justify-center gap-3">
            <h1 className="text-center text-2xl font-semibold">{title}</h1>
            <EnvironmentBadge />
          </div>
          <div className={`rounded-xl bg-white p-6 shadow-sm ${environmentLabel ? 'border-2 border-red-500' : 'border border-slate-200'}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
