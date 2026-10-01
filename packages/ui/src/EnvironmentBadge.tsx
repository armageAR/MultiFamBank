import { environmentLabel } from './environment'

/** Loud red marker for non-production builds; renders nothing in production. */
export function EnvironmentBadge({ className = '' }: { className?: string }) {
  if (!environmentLabel) return null

  return (
    <span
      className={`inline-flex items-center rounded-md bg-red-600 px-3 py-1 text-sm font-extrabold tracking-widest text-white uppercase shadow-sm ring-2 ring-white/70 ${className}`}
    >
      {environmentLabel}
    </span>
  )
}
