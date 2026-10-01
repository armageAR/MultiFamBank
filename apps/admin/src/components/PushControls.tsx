import { usePushNotifications } from '@multifambank/auth'
import { Alert } from '@multifambank/ui'
import { api } from '../api'

const pill = 'rounded-lg border px-2 py-1.5 text-xs transition-colors'

/** FamBank's header control: activate notifications, or send a test once active. */
export function PushControls() {
  const push = usePushNotifications(api)

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
        <button
          type="button"
          onClick={push.test}
          title="Notificaciones activas · tocá para enviar una prueba"
          className={`${pill} border-emerald-200 text-emerald-600`}
        >
          notif. activas
        </button>
      )}
      {push.message && (
        <div className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-md" onClick={push.dismiss}>
          <Alert tone="info">{push.message}</Alert>
        </div>
      )}
    </>
  )
}
