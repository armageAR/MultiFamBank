import type { ReactNode } from 'react'
import { EnvironmentBadge } from './EnvironmentBadge'
import { environmentLabel } from './environment'
import { InstallPrompt } from './InstallPrompt'

interface FamilyShellProps {
  /** Small uppercase line above the name, e.g. the bank's name. */
  eyebrow: string
  name: string
  /** Role badge next to the name, e.g. "Admin". */
  badge?: string
  actions?: ReactNode
  children: ReactNode
}

/** Header and page frame of the original FamBank, for the administrator and client apps. */
export function FamilyShell({ eyebrow, name, badge, actions, children }: FamilyShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-gray-50 font-sans text-gray-900">
      <h1 className="sr-only">
        {name} · {eyebrow}
      </h1>
      <header className={`border-b border-gray-100 bg-white px-5 py-4 ${environmentLabel ? 'border-t-8 border-t-red-600' : ''}`}>
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
            <img src="/favicon.svg" alt="" className="size-9 shrink-0 rounded-xl" />
            <div className="min-w-0">
              <p className="truncate text-xs tracking-[0.2em] text-gray-500 uppercase">{eyebrow}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-gray-900">{name}</p>
                {badge && (
                  <span className="rounded-md border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">{badge}</span>
                )}
                <EnvironmentBadge className="px-2 py-0.5 text-xs" />
              </div>
            </div>
          </div>
          {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-5 pb-8">
        <InstallPrompt />
        {children}
      </main>
    </div>
  )
}

/** Small outlined header button, like FamBank's "Salir". */
export function HeaderButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
    >
      {children}
    </button>
  )
}
