/// <reference path="./env.d.ts" />
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

/** The parts of Cloudflare Turnstile's browser API that the forms use. */
declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
  }
}

const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY
const scriptUrl = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let scriptLoad: Promise<void> | null = null

function loadScript(): Promise<void> {
  scriptLoad ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = scriptUrl
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptLoad = null
      reject(new Error('Turnstile did not load'))
    }
    document.head.appendChild(script)
  })
  return scriptLoad
}

export interface TurnstileState {
  /** False when no site key is configured: the form is sent without the check. */
  enabled: boolean
  /** Token for the next request; empty until the check passes. */
  token: string
  failed: boolean
  /** Tokens are single-use: get a new one after every request that used it. */
  reset: () => void
  /** Once the form is sent the widget is no longer needed. */
  remove: () => void
}

/**
 * Cloudflare Turnstile widget rendered into `container`; usually it passes without any click. Used by
 * the landing page's access form and by every app's sign-in and forgotten-password forms.
 */
export function useTurnstile(container: RefObject<HTMLDivElement | null>): TurnstileState {
  const widget = useRef<string | null>(null)
  const [token, setToken] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!siteKey) return
    let cancelled = false

    loadScript()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile) return
        widget.current = window.turnstile.render(container.current, {
          sitekey: siteKey,
          language: 'es',
          theme: 'light',
          size: 'flexible',
          callback: (value: string) => {
            setToken(value)
            setFailed(false)
          },
          'expired-callback': () => setToken(''),
          'timeout-callback': () => setToken(''),
          'error-callback': () => {
            setToken('')
            setFailed(true)
          },
        })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      if (widget.current) window.turnstile?.remove(widget.current)
      widget.current = null
    }
  }, [container])

  const reset = useCallback(() => {
    setToken('')
    if (widget.current) window.turnstile?.reset(widget.current)
  }, [])

  const remove = useCallback(() => {
    if (widget.current) window.turnstile?.remove(widget.current)
    widget.current = null
  }, [])

  return { enabled: Boolean(siteKey), token, failed, reset, remove }
}
