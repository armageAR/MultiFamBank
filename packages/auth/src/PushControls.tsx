import { Alert } from '@multifambank/ui'
import type { AxiosInstance } from 'axios'
import { useEffect, useId, useRef, useState } from 'react'
import { usePushNotifications } from './push'

const pill = 'rounded-lg border px-2 py-1.5 text-xs transition-colors'

/**
 * FamBank's header control for Web Push: activate on this device, or, once active, a small menu
 * to send a test notification or deactivate them.
 */
export function PushControls({ api }: { api: AxiosInstance }) {
  const push = usePushNotifications(api)
  const [open, setOpen] = useState(false)
  const menu = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // Only this panel closes; an open dialog behind it stays open.
      event.stopPropagation()
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  return (
    <>
      {push.status === 'loading' && <span className="px-2 text-xs text-gray-500">…</span>}
      {push.status === 'unsupported' && <span className="px-2 text-xs text-gray-500">sin push</span>}
      {push.status === 'denied' && <span className="px-2 text-xs text-red-600">notif. bloqueadas</span>}
      {(push.status === 'unsubscribed' || push.status === 'unavailable') && (
        <button type="button" onClick={push.subscribe} className={`${pill} border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-600`}>
          activar notif.
        </button>
      )}
      {push.status === 'subscribed' && (
        <div className="relative" ref={menu}>
          <button
            ref={trigger}
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen(!open)}
            className={`${pill} border-emerald-200 text-emerald-600`}
          >
            notif. activas ▾
          </button>
          {open && (
            <div id={panelId} className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-xl border border-gray-100 bg-white text-sm shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  void push.test()
                }}
                className="block w-full px-4 py-2.5 text-left text-gray-700 hover:bg-gray-50"
              >
                Enviar prueba
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  void push.unsubscribe()
                }}
                className="block w-full px-4 py-2.5 text-left text-red-600 hover:bg-gray-50"
              >
                Desactivar
              </button>
            </div>
          )}
        </div>
      )}
      {push.message && (
        <div className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-md">
          <Alert tone="info">
            <div className="flex items-start justify-between gap-3">
              <span>{push.message}</span>
              <button type="button" onClick={push.dismiss} aria-label="Cerrar" className="shrink-0">
                ✕
              </button>
            </div>
          </Alert>
        </div>
      )}
    </>
  )
}
