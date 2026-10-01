import { fetchAdminBank, toApiError, updateAdminBank, type AdminBank, type ApiError } from '@multifambank/api-client'
import { useAuth } from '@multifambank/auth'
import { Alert, AuthLayout, Button, SelectField, TextField } from '@multifambank/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { api } from '../api'
import { timezoneOptions } from '../timezones'

export function BankSetup() {
  const { user, isLoading } = useAuth()
  const bank = useQuery({ queryKey: ['admin-bank'], queryFn: () => fetchAdminBank(api), enabled: Boolean(user?.administered_bank) })

  if (isLoading) return <p className="p-6 text-center text-sm text-gray-400">Cargando…</p>
  if (!user) return <Navigate to="/ingresar" replace />
  // Paused banks are read-only; the home page explains why.
  if (!user.administered_bank || user.administered_bank.status === 'paused') return <Navigate to="/" replace />

  return (
    <AuthLayout appName="Administración" title="Datos de tu banco">
      {bank.isPending ? (
        <p className="text-center text-sm text-gray-400">Cargando…</p>
      ) : bank.isError ? (
        <Alert tone="error">{toApiError(bank.error).message}</Alert>
      ) : (
        <SetupForm bank={bank.data} />
      )}
    </AuthLayout>
  )
}

function SetupForm({ bank }: { bank: AdminBank }) {
  const { refresh } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState(bank.name ?? '')
  const [timezone, setTimezone] = useState(bank.timezone)
  const [error, setError] = useState<ApiError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const updated = await updateAdminBank(api, { name, timezone })
      queryClient.setQueryData(['admin-bank'], updated)
      await refresh()
      navigate('/', { replace: true })
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const general = error && !error.fields.name && !error.fields.timezone ? error.message : null
  const isFirstSetup = bank.status === 'pending_configuration'

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <p className="text-sm text-gray-700">
        {isFirstSetup
          ? 'Último paso: completá los datos de tu banco. Al guardar, el banco queda activo y vas a poder invitar clientes.'
          : 'Actualizá los datos de tu banco.'}
      </p>
      {general && <Alert tone="error">{general}</Alert>}
      <TextField
        label="Nombre del banco"
        required
        maxLength={120}
        placeholder="Por ejemplo: Banco de la familia Pérez"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={error?.fields.name}
      />
      <SelectField
        label="Zona horaria"
        value={timezone}
        onChange={(e) => setTimezone(e.target.value)}
        error={error?.fields.timezone}
        hint="Se usa para cerrar los reportes mensuales."
      >
        {timezoneOptions(bank.timezone).map((zone) => (
          <option key={zone} value={zone}>
            {zone.replaceAll('_', ' ')}
          </option>
        ))}
      </SelectField>
      <Button type="submit" className="w-full" loading={submitting}>
        {isFirstSetup ? 'Guardar y activar el banco' : 'Guardar'}
      </Button>
    </form>
  )
}
