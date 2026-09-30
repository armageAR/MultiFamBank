import { resetPassword, toApiError, type ApiError } from '@multifambank/api-client'
import { Alert, AuthLayout, Button, TextField } from '@multifambank/ui'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api } from '../api'

export function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const email = params.get('email') ?? ''
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      setDone(await resetPassword(api, { token, email, password, password_confirmation: confirmation }))
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (!token || !email) {
    return (
      <AuthLayout appName="Plataforma" title="Definir contraseña">
        <Alert tone="error">El link está incompleto. Abrí nuevamente el link que recibiste.</Alert>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout appName="Plataforma" title="Definir contraseña">
      {done ? (
        <div className="space-y-4">
          <Alert tone="success">{done}</Alert>
          <Link to="/ingresar" className="block text-center text-sm text-brand-700 hover:underline">
            Ir a ingresar
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && !error.fields.password && <Alert tone="error">{error.message}</Alert>}
          <p className="text-sm text-slate-600">
            Cuenta: <strong>{email}</strong>
          </p>
          <TextField
            label="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            hint="Mínimo 8 caracteres."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error?.fields.password}
          />
          <TextField
            label="Repetir contraseña"
            type="password"
            autoComplete="new-password"
            required
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
          <Button type="submit" className="w-full" loading={submitting}>
            Guardar contraseña
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
