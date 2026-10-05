import { forgotPassword, login, resetPassword, toApiError, type ApiError } from '@multifambank/api-client'
import { Alert, AuthLayout, Button, TextField, useLinkClass, useTurnstile, type TurnstileState } from '@multifambank/ui'
import type { AxiosInstance } from 'axios'
import { useRef, useState, type FormEvent, type RefObject } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { useAuth } from './session'

interface PageProps {
  /** Shown above the title, e.g. "Plataforma" or "Administración". */
  appName: string
  api: AxiosInstance
}

/** Paths shared by every frontend. */
const paths = { login: '/ingresar', forgot: '/olvide-contrasena' }

/**
 * Why the form cannot be sent yet: Cloudflare Turnstile is still checking. If it could not run, the
 * form is sent without a token and the API decides (it accepts it while the check is switched off).
 */
function humanCheckError(turnstile: TurnstileState): ApiError | null {
  if (!turnstile.enabled || turnstile.token || turnstile.failed) return null
  return { message: 'Esperá a que termine la verificación de seguridad y volvé a tocar el botón.', fields: {} }
}

/** Cloudflare Turnstile: confirms a person is sending the form, usually without a click. */
function HumanCheck({ turnstile, container }: { turnstile: TurnstileState; container: RefObject<HTMLDivElement | null> }) {
  return turnstile.enabled ? <div ref={container} className="min-h-[65px]" /> : null
}

export function LoginPage({ appName, api }: PageProps) {
  const link = useLinkClass()
  const { user, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const humanCheck = useRef<HTMLDivElement>(null)
  const turnstile = useTurnstile(humanCheck)

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const pending = humanCheckError(turnstile)
    if (pending) {
      setError(pending)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const result = await login(api, email, password, turnstile.token)
      signIn(result.token, result.user)
    } catch (err) {
      // The token was used; a retry needs a new one.
      turnstile.reset()
      setError(toApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout appName={appName} title="Ingresar">
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
        <HumanCheck turnstile={turnstile} container={humanCheck} />
        <Button type="submit" className="w-full" loading={submitting}>
          Ingresar
        </Button>
        <p className="text-center text-sm">
          <Link to={paths.forgot} className={link}>
            Olvidé mi contraseña
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}

export function ForgotPasswordPage({ appName, api }: PageProps) {
  const link = useLinkClass()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const humanCheck = useRef<HTMLDivElement>(null)
  const turnstile = useTurnstile(humanCheck)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const pending = humanCheckError(turnstile)
    if (pending) {
      setError(pending)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const message = await forgotPassword(api, email, turnstile.token)
      turnstile.remove()
      setSent(message)
    } catch (err) {
      turnstile.reset()
      setError(toApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout appName={appName} title="Restablecer contraseña">
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
          <HumanCheck turnstile={turnstile} container={humanCheck} />
          <Button type="submit" className="w-full" loading={submitting}>
            Enviarme un link
          </Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm">
        <Link to={paths.login} className={link}>
          Volver a ingresar
        </Link>
      </p>
    </AuthLayout>
  )
}

/** Opened from the emailed link (or the superadmin:create link): ?token=…&email=… */
export function ResetPasswordPage({ appName, api }: PageProps) {
  const link = useLinkClass()
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
      <AuthLayout appName={appName} title="Definir contraseña">
        <Alert tone="error">El link está incompleto. Abrí nuevamente el link que recibiste.</Alert>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout appName={appName} title="Definir contraseña">
      {done ? (
        <div className="space-y-4">
          <Alert tone="success">{done}</Alert>
          <Link to={paths.login} className={`block text-center text-sm ${link}`}>
            Ir a ingresar
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && !error.fields.password && <Alert tone="error">{error.message}</Alert>}
          <p className="text-sm text-slate-600">
            Cuenta: <strong className="break-all">{email}</strong>
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
