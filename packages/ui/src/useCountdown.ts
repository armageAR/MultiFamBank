import { useEffect, useState } from 'react'

/**
 * Seconds left until the given instant (0 once it has passed). Computed from the current time on
 * every render, so a new target is right immediately; a timer only re-renders once per second.
 */
export function useCountdown(until: string | null | undefined): number {
  const target = until ? new Date(until).getTime() : 0
  const [, setTick] = useState(0)
  const remaining = Math.max(0, Math.ceil((target - Date.now()) / 1000))

  useEffect(() => {
    if (target <= Date.now()) return
    const id = setInterval(() => {
      setTick((tick) => tick + 1)
      if (Date.now() >= target) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [target])

  return remaining
}

/** 272 → "4:32" */
export function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
