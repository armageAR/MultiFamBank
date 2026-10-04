import { Alert, Button } from '@multifambank/ui'
import { useState } from 'react'
import { useAuth } from './session'

/** "Mi cuenta" switch for the fingerprint/face lock; hidden on devices that cannot do it. */
export function AppLockSetting() {
  const { appLock } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!appLock.available && !appLock.enabled) return null

  async function enable() {
    setBusy(true)
    setError(null)
    try {
      await appLock.enable()
    } catch (err) {
      setError(err instanceof DOMException && err.name === 'NotAllowedError' ? 'Se canceló la activación.' : 'No se pudo activar en este dispositivo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-100 p-3">
      <div>
        <p className="text-sm font-medium text-gray-900">Desbloqueo con huella o cara</p>
        <p className="text-xs text-gray-500">
          {appLock.enabled
            ? 'Activo en este dispositivo: se pide al abrir la app y al volver después de 2 minutos.'
            : 'Pedí tu huella, tu cara o el bloqueo de pantalla del teléfono al abrir la app en este dispositivo.'}
        </p>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {appLock.enabled ? (
        <Button type="button" variant="secondary" onClick={appLock.disable}>
          Desactivar
        </Button>
      ) : (
        <Button type="button" variant="secondary" loading={busy} onClick={enable}>
          Activar
        </Button>
      )}
    </div>
  )
}
