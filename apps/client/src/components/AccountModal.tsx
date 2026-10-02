import { toApiError, updateProfile, type ApiError, type User } from '@multifambank/api-client'
import { useAuth } from '@multifambank/auth'
import { Alert, Button, Modal, TextField } from '@multifambank/ui'
import { useState, type FormEvent } from 'react'
import { api } from '../api'

/** FamBank's "Mi cuenta": email and password; the name is managed by the bank administrator. */
export function AccountModal({ user, onClose }: { user: User; onClose: () => void }) {
  const { refresh } = useAuth()
  const [email, setEmail] = useState(user.email)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [current, setCurrent] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const changed = email.trim().toLowerCase() !== user.email || password !== ''

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await updateProfile(api, {
        current_password: current,
        ...(email.trim().toLowerCase() !== user.email ? { email } : {}),
        ...(password ? { password, password_confirmation: confirmation } : {}),
      })
      await refresh()
      setDone(password ? 'Datos actualizados. Las sesiones en otros dispositivos se cerraron.' : 'Email actualizado.')
      setPassword('')
      setConfirmation('')
      setCurrent('')
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Mi cuenta" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <div>
          <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">Nombre</p>
          <p className="mt-1 text-sm text-gray-900">{user.name}</p>
          <p className="text-xs text-gray-500">El nombre lo administra el administrador de tu banco.</p>
        </div>
        {done && <Alert tone="success">{done}</Alert>}
        {error && !error.fields.email && !error.fields.password && !error.fields.current_password && <Alert tone="error">{error.message}</Alert>}
        <TextField
          label="Email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error?.fields.email}
        />
        <TextField
          label="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          hint="Dejala vacía para no cambiarla. Mínimo 8 caracteres."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error?.fields.password}
        />
        {password && (
          <TextField label="Repetir contraseña nueva" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
        )}
        <TextField
          label="Contraseña actual"
          type="password"
          autoComplete="current-password"
          hint="Para confirmar que sos vos."
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          error={error?.fields.current_password}
        />
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cerrar
          </Button>
          <Button type="submit" className="flex-1" loading={saving} disabled={!changed || !current}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
