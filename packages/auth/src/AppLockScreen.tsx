import type { User } from '@multifambank/api-client'
import { Alert, AuthLayout, Button, useLinkClass } from '@multifambank/ui'
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

const coverClass = 'm-0 h-dvh max-h-none w-full max-w-none overflow-y-auto bg-transparent p-0 backdrop:bg-white'

/**
 * Keeps a modal <dialog> on top of everything. Browsers draw modal dialogs in the top layer and
 * ignore an ancestor's visibility or inert there, so a dialog the app opens later (e.g. from a
 * notification link) would land above; it is put back on top whenever another dialog opens.
 */
function useTopmostDialog(ref: RefObject<HTMLDialogElement | null>) {
  // Before paint, so the app behind never shows for a frame.
  useLayoutEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [ref])

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      const dialog = ref.current
      const opened = mutations.some((m) => m.target !== dialog && m.target instanceof HTMLDialogElement && m.target.open)
      if (!dialog || !opened) return
      dialog.close()
      dialog.showModal()
    })
    observer.observe(document.documentElement, { subtree: true, attributeFilter: ['open'] })
    return () => observer.disconnect()
  }, [ref])

  return {
    // Escape must not dismiss it; if the browser closes it anyway, it opens again.
    onCancel: (event: { preventDefault: () => void }) => event.preventDefault(),
    onClose: () => {
      const dialog = ref.current
      if (dialog?.isConnected && !dialog.open) dialog.showModal()
    },
  }
}

/**
 * Full-screen lock shown on top of the app. Phones only show the biometric prompt after a tap, so
 * unlocking starts from a button.
 */
export function AppLockScreen({ user, onUnlock, onUsePassword }: { user: User | null; onUnlock: () => Promise<boolean>; onUsePassword: () => Promise<void> }) {
  const link = useLinkClass()
  const ref = useRef<HTMLDialogElement>(null)
  const handlers = useTopmostDialog(ref)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)

  async function unlock() {
    setVerifying(true)
    setError(null)
    try {
      if (!(await onUnlock())) setError('No se pudo verificar que seas vos. Probá de nuevo.')
    } catch {
      // Canceled, timed out, or the saved key was deleted from the phone.
      setError('No se pudo verificar que seas vos. Probá de nuevo o ingresá con tu contraseña.')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <dialog ref={ref} aria-label="App bloqueada" {...handlers} className={coverClass}>
      <AuthLayout appName={user ? `Hola, ${user.name}` : 'App bloqueada'} title="Desbloqueá la app">
        <p className="text-center text-sm text-gray-600">Usá tu huella, tu cara o el bloqueo de pantalla del teléfono.</p>
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="button" className="w-full" loading={verifying} onClick={unlock} autoFocus>
          Desbloquear
        </Button>
        <p className="text-center text-sm">
          <button
            type="button"
            className={link}
            disabled={leaving}
            onClick={() => {
              setLeaving(true)
              void onUsePassword()
            }}
          >
            {leaving ? 'Cerrando sesión…' : 'Ingresar con contraseña'}
          </button>
        </p>
        <p className="text-center text-xs text-gray-500">Se cierra la sesión en este dispositivo y volvés a ingresar con tu email y contraseña; para eso necesitás conexión.</p>
      </AuthLayout>
    </dialog>
  )
}

/** Blank screen while the app is in the background, so the phone's app switcher shows nothing. */
export function PrivacyCover() {
  const ref = useRef<HTMLDialogElement>(null)
  const handlers = useTopmostDialog(ref)
  // Covering moves focus into the dialog. Read while rendering, before the dialog opens.
  const [previous] = useState(() => document.activeElement)

  // Given back on the next frame, once the app behind is no longer inert.
  useEffect(
    () => () => {
      requestAnimationFrame(() => {
        if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true })
      })
    },
    [previous],
  )

  return <dialog ref={ref} aria-label="App oculta" {...handlers} className={coverClass} />
}
