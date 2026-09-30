import { createPlatformBank, toApiError, type ApiError, type CreateBankResponse } from '@multifambank/api-client'
import { Alert, Button, Card, TextField } from '@multifambank/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { api } from '../api'

export function NewBank() {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<CreateBankResponse | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      setCreated(await createPlatformBank(api, { admin_email: email, admin_name: name }))
      await queryClient.invalidateQueries({ queryKey: ['platform-banks'] })
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setCreated(null)
    setEmail('')
    setName('')
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link to="/" className="text-sm text-brand-700 hover:underline">
        ← Bancos
      </Link>
      <h2 className="text-xl font-semibold">Nuevo banco</h2>

      {created ? (
        <Created result={created} onCreateAnother={reset} />
      ) : (
        <Card>
          <p className="mb-4 text-sm text-slate-600">
            Creamos el banco pendiente de configuración e invitamos a su administrador por email. El administrador define su
            contraseña (o ingresa con la que ya tiene) y completa los datos del banco.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && !error.fields.admin_email && !error.fields.admin_name && <Alert tone="error">{error.message}</Alert>}
            <TextField
              label="Email del administrador"
              type="email"
              autoComplete="off"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={error?.fields.admin_email}
            />
            <TextField
              label="Nombre del administrador"
              autoComplete="off"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={error?.fields.admin_name}
            />
            <Button type="submit" loading={submitting}>
              Crear banco e invitar
            </Button>
          </form>
        </Card>
      )}
    </div>
  )
}

function Created({ result, onCreateAnother }: { result: CreateBankResponse; onCreateAnother: () => void }) {
  const [copied, setCopied] = useState(false)
  const { admin } = result.data

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Card>
      <div className="space-y-4">
        {result.invitation_url ? (
          <Alert tone="success" title="Banco creado">
            La invitación para <strong>{admin.email}</strong> está lista.
          </Alert>
        ) : result.email_sent ? (
          <Alert tone="success" title="Banco creado">
            Enviamos la invitación a <strong>{admin.email}</strong>.
          </Alert>
        ) : (
          <Alert tone="warning" title="Banco creado, pero el email no se envió">
            Hubo un problema al enviar la invitación a <strong>{admin.email}</strong>.
          </Alert>
        )}

        {result.invitation_url && (
          <div className="space-y-2">
            <p className="text-sm text-slate-700">
              El envío de emails todavía no está configurado en este entorno, así que no se mandó ningún email. Compartí este link con{' '}
              {admin.name ?? 'el administrador'}; se puede usar una sola vez.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-slate-100 px-3 py-2 text-xs whitespace-nowrap">
                {result.invitation_url}
              </code>
              <Button variant="secondary" onClick={() => copy(result.invitation_url!)}>
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Link
            to="/"
            className="inline-flex items-center rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
          >
            Ver bancos
          </Link>
          <Button variant="secondary" onClick={onCreateAnother}>
            Crear otro
          </Button>
        </div>
      </div>
    </Card>
  )
}
