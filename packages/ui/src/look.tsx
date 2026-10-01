import { createContext, useContext, type ReactNode } from 'react'

/**
 * "platform" is the superadmin's navy look; "family" replicates the original FamBank styling
 * (emerald accents, white cards, large inputs) for the administrator and client apps.
 */
export type Look = 'platform' | 'family'

const LookContext = createContext<Look>('platform')

export function LookProvider({ look, children }: { look: Look; children: ReactNode }) {
  return <LookContext.Provider value={look}>{children}</LookContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLook(): Look {
  return useContext(LookContext)
}

const linkClasses: Record<Look, string> = {
  platform: 'text-brand-700 hover:underline',
  family: 'text-emerald-600 hover:underline',
}

/** Text link color for the current look. */
// eslint-disable-next-line react-refresh/only-export-components
export function useLinkClass(): string {
  return linkClasses[useLook()]
}
