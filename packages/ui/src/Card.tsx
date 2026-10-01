import type { ReactNode } from 'react'
import { useLook } from './look'

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  if (useLook() === 'family') {
    return (
      <section className="rounded-2xl border border-gray-100 bg-white px-5 py-5 shadow-sm">
        {title && <h2 className="mb-3 text-xs tracking-wide text-gray-500 uppercase">{title}</h2>}
        {children}
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {title && <h2 className="mb-3 text-lg font-semibold">{title}</h2>}
      {children}
    </section>
  )
}
