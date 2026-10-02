import { useEffect, useState } from 'react'

/** Seconds left until the given instant (0 once it has passed), updated every second. */
export function useCountdown(until: string | null | undefined): number {
  const target = until ? new Date(until).getTime() : 0
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (target <= Date.now()) return
    const id = setInterval(() => {
      setNow(Date.now())
      if (Date.now() >= target) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [target])

  return Math.max(0, Math.ceil((target - now) / 1000))
}

/** 272 → "4:32" */
export function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
