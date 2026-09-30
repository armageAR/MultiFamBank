import { createPlatformBank, toApiError, type ApiError, type CreateBankResponse } from '@multifambank/api-client'
import { Alert, Button, Card, TextField } from '@multifambank/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { api } from '../api'
import { InvitationResult } from '../components/InvitationResult'

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
  return (
    <Card>
      <div className="space-y-4">
        <InvitationResult result={result} title="Banco creado" />
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
