import { login, toApiError, type ApiError } from '@multifambank/api-client'
import { Alert, AuthLayout, Button, TextField } from '@multifambank/ui'
import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router'
import { api } from '../api'
import { useAuth } from '@multifambank/auth'

export function Login() {
  const { user, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result = await login(api, email, password)
      signIn(result.token, result.user)
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout appName="Plataforma" title="Ingresar">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && !error.fields.email && !error.fields.password && <Alert tone="error">{error.message}</Alert>}
        <TextField
          label="Email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error?.fields.email}
        />
        <TextField
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error?.fields.password}
        />
        <Button type="submit" className="w-full" loading={submitting}>
          Ingresar
        </Button>
        <p className="text-center text-sm">
          <Link to="/olvide-contrasena" className="text-brand-700 hover:underline">
            Olvidé mi contraseña
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
