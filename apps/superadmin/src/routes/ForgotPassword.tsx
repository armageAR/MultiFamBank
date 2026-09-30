import { forgotPassword, toApiError, type ApiError } from '@multifambank/api-client'
import { Alert, AuthLayout, Button, TextField } from '@multifambank/ui'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { api } from '../api'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      setSent(await forgotPassword(api, email))
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout appName="Plataforma" title="Restablecer contraseña">
      {sent ? (
        <Alert tone="success">{sent}</Alert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && !error.fields.email && <Alert tone="error">{error.message}</Alert>}
          <TextField
            label="Email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error?.fields.email}
          />
          <Button type="submit" className="w-full" loading={submitting}>
            Enviarme un link
          </Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm">
        <Link to="/ingresar" className="text-brand-700 hover:underline">
          Volver a ingresar
        </Link>
      </p>
    </AuthLayout>
  )
}
