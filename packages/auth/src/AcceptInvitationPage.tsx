import { acceptInvitation, fetchInvitation, toApiError, type ApiError, type InvitationDetails } from '@multifambank/api-client'
import { useAuth } from './session'
import { Alert, AuthLayout, Button, TextField, useLinkClass } from '@multifambank/ui'
import { useQuery } from '@tanstack/react-query'
import type { AxiosInstance } from 'axios'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

const expiryFormat = new Intl.DateTimeFormat('es-AR', { dateStyle: 'long', timeStyle: 'short' })

interface AcceptInvitationProps {
  appName: string
  api: AxiosInstance
  /** Where to go once accepted, e.g. bank setup for administrators. */
  next: string
  title: string
  /** First paragraph, given the invitation (e.g. names the bank for clients). */
  intro: (details: InvitationDetails) => string
}

/** Accepting an invitation: new people register, existing identities confirm with their password. */
export function AcceptInvitationPage({ appName, api, next, title, intro }: AcceptInvitationProps) {
  const { token = '' } = useParams()
  const link = useLinkClass()
  const invitation = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => fetchInvitation(api, token),
    retry: false,
  })

  if (invitation.isPending) {
    return (
      <AuthLayout appName={appName} title="Invitación">
        <p className="text-center text-sm text-gray-500">Cargando invitación…</p>
      </AuthLayout>
    )
  }

  if (invitation.isError) {
    const error = toApiError(invitation.error)
    return (
      <AuthLayout appName={appName} title="Invitación">
        <Alert tone="error">{error.status === 404 ? 'El link de invitación no es válido. Revisá que esté completo.' : error.message}</Alert>
      </AuthLayout>
    )
  }

  const details = invitation.data

  if (details.state !== 'pending') {
    return (
      <AuthLayout appName={appName} title="Invitación">
        {details.state === 'accepted' ? (
          <div className="space-y-4">
            <Alert tone="info">Esta invitación ya fue aceptada.</Alert>
            <Link to="/ingresar" className={`block text-center text-sm ${link}`}>
              Ir a ingresar
            </Link>
          </div>
        ) : (
          <Alert tone="error">
            {details.state === 'expired'
              ? 'Esta invitación venció. Pedile al administrador de la plataforma que te la reenvíe.'
              : 'Esta invitación ya no es válida.'}
          </Alert>
        )}
      </AuthLayout>
    )
  }

  return <AcceptForm token={token} details={details} api={api} appName={appName} next={next} title={title} intro={intro} />
}

function AcceptForm({ token, details, api, appName, next, title, intro }: AcceptInvitationProps & { token: string; details: InvitationDetails }) {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState(details.name)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result = await acceptInvitation(
        api,
        token,
        details.has_account ? { password } : { name, password, password_confirmation: confirmation },
      )
      signIn(result.token, result.user)
      navigate(next, { replace: true })
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const general = error && !error.fields.name && !error.fields.password ? error.message : null

  return (
    <AuthLayout appName={appName} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <p className="text-sm text-gray-700">{intro(details)}</p>
        <p className="text-xs text-gray-500">Vence: {expiryFormat.format(new Date(details.expires_at))}</p>
        <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
          Email: <strong className="break-all text-gray-900">{details.email}</strong>
        </p>

        {general && <Alert tone="error">{general}</Alert>}

        {details.has_account ? (
          <>
            <p className="text-xs text-gray-500">Ya tenés una cuenta en MultiFamBank. Ingresá tu contraseña actual para aceptar.</p>
            <TextField
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={error?.fields.password}
            />
          </>
        ) : (
          <>
            <TextField
              label="Tu nombre"
              autoComplete="name"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={error?.fields.name}
            />
            <TextField
              label="Contraseña"
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
          </>
        )}

        <Button type="submit" className="w-full" loading={submitting}>
          Aceptar invitación
        </Button>
      </form>
    </AuthLayout>
  )
}
