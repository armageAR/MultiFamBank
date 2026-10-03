import { useState, useSyncExternalStore } from 'react'

/** Chromium's install event; not in the DOM typings. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// The browser announces installability once, possibly before React mounts: keep it from page load.
let deferred: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installed = true
    notify()
  })
  window.matchMedia('(display-mode: standalone)').addEventListener('change', notify)
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Opened as an installed app (home screen or desktop window), not in a browser tab. */
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** iPhone and iPad (iPadOS reports itself as a Mac with touch); installing there is manual. */
function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

type Mode = 'button' | 'ios' | null

function currentMode(): Mode {
  if (installed || isStandalone()) return null
  if (deferred) return 'button'
  return isIos() ? 'ios' : null
}

const DISMISS_KEY = 'mfb.install.dismissedAt'
const DISMISS_DAYS = 30

function dismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY))
    return at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000
  } catch {
    return false
  }
}

/**
 * Offers installing the app when it is used in a browser: a button where the browser supports it
 * (Chrome, Edge, Android), instructions on iPhone, nothing when already installed or not possible.
 */
export function InstallPrompt() {
  const mode = useSyncExternalStore(subscribe, currentMode, () => null)
  const [hidden, setHidden] = useState(dismissedRecently)

  if (!mode || hidden) return null

  function dismiss() {
    setHidden(true)
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // Without storage it simply shows again next time.
    }
  }

  async function install() {
    const event = deferred
    if (!event) return
    deferred = null
    await event.prompt()
    const { outcome } = await event.userChoice
    if (outcome === 'dismissed') dismiss()
    notify()
  }

  return (
    <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900">
      <img src="/favicon.svg" alt="" className="mt-0.5 size-8 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Instalá la app</p>
        {mode === 'button' ? (
          <p className="text-xs">Se abre como una app, más rápido, y te llegan los avisos.</p>
        ) : (
          <p className="text-xs">
            Tocá <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba) y elegí <strong>Agregar a inicio</strong>. Así se abre como una app y
            te llegan los avisos.
          </p>
        )}
        {mode === 'button' && (
          <button
            type="button"
            onClick={() => void install()}
            className="mt-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            Instalar
          </button>
        )}
      </div>
      <button type="button" onClick={dismiss} aria-label="Ahora no" className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100">
        <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true" fill="currentColor">
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>
    </div>
  )
}
