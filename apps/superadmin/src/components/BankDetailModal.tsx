import {
  fetchPlatformBank,
  setPlatformBankAdminPassword,
  toApiError,
  updatePlatformBankAdmin,
  type ApiError,
  type PlatformBankDetail,
  type UpdateAdminResponse,
} from '@multifambank/api-client'
import { Alert, BankStatusBadge, Button, Card, Modal, TextField } from '@multifambank/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent, type ReactNode } from 'react'
import { api } from '../api'
import { formatDate, formatDateTime } from '../format'
import { InvitationResult } from './InvitationResult'

export function BankDetailModal({ bankId, onClose }: { bankId: number; onClose: () => void }) {
  const bank = useQuery({ queryKey: ['platform-bank', bankId], queryFn: () => fetchPlatformBank(api, bankId) })

  return (
    <Modal title={bank.data ? (bank.data.name ?? 'Banco sin configurar') : 'Banco'} onClose={onClose}>
      {bank.isPending ? (
        <p className="py-6 text-center text-slate-500">Cargando…</p>
      ) : bank.isError ? (
        <Alert tone="error">{toApiError(bank.error).message}</Alert>
      ) : (
        <>
          <BankSection bank={bank.data} />
          <AdminSection bank={bank.data} />
          <ClientsSection bank={bank.data} />
        </>
      )}
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  )
}

function BankSection({ bank }: { bank: PlatformBankDetail }) {
  return (
    <Card title="Banco">
      <dl className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre">{bank.name ?? <span className="text-slate-500 italic">Sin configurar</span>}</Field>
        <Field label="Estado">
          <BankStatusBadge status={bank.status} />
        </Field>
        <Field label="Zona horaria">{bank.timezone.replaceAll('_', ' ')}</Field>
        <Field label="Creado">{formatDate(bank.created_at)}</Field>
        <Field label="Activado">{formatDate(bank.activated_at)}</Field>
      </dl>
    </Card>
  )
}

type AdminMode = 'view' | 'edit' | 'password'

function AdminSection({ bank }: { bank: PlatformBankDetail }) {
  const [mode, setMode] = useState<AdminMode>('view')
  const [notice, setNotice] = useState<ReactNode>(null)
  const { admin, invitation } = bank

  function open(next: AdminMode) {
    setNotice(null)
    setMode(next)
  }

  function done(message: ReactNode) {
    setMode('view')
    setNotice(message)
  }

  return (
    <Card title="Administrador">
      <div className="space-y-4">
        {notice}
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">{admin.name ?? '—'}</Field>
          <Field label="Email">{admin.email}</Field>
          <Field label="Invitación">
            {admin.accepted
              ? `Aceptada el ${formatDate(invitation?.accepted_at)}`
              : invitation?.state === 'expired'
                ? `Vencida el ${formatDate(invitation.expires_at)}`
                : `Pendiente · vence ${formatDate(invitation?.expires_at)}`}
          </Field>
          <Field label="Última actividad">{admin.accepted ? formatDateTime(admin.last_seen_at, 'Nunca') : '—'}</Field>
        </dl>

        {mode === 'view' && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => open('edit')}>
              Editar nombre y email
            </Button>
            {admin.accepted && (
              <Button variant="secondary" onClick={() => open('password')}>
                Cambiar contraseña
              </Button>
            )}
          </div>
        )}

        {mode === 'edit' && (
          <EditAdminForm
            bank={bank}
            onCancel={() => setMode('view')}
            onSaved={(result) =>
              done(
                result.invitation_url || result.email_sent !== null ? (
                  <InvitationResult result={{ ...result, email_sent: result.email_sent ?? false }} title="Datos guardados, invitación nueva" />
                ) : (
                  <Alert tone="success">Datos del administrador actualizados.</Alert>
                ),
              )
            }
          />
        )}

        {mode === 'password' && (
          <PasswordForm bank={bank} onCancel={() => setMode('view')} onSaved={(message) => done(<Alert tone="success">{message}</Alert>)} />
        )}
      </div>
    </Card>
  )
}

function EditAdminForm({
  bank,
  onCancel,
  onSaved,
}: {
  bank: PlatformBankDetail
  onCancel: () => void
  onSaved: (result: UpdateAdminResponse) => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(bank.admin.name ?? '')
  const [email, setEmail] = useState(bank.admin.email)
  const [error, setError] = useState<ApiError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result = await updatePlatformBankAdmin(api, bank.id, { name, email })
      queryClient.setQueryData(['platform-bank', bank.id], result.data)
      await queryClient.invalidateQueries({ queryKey: ['platform-banks'] })
      onSaved(result)
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4" noValidate>
      <Alert tone="warning">
        {bank.admin.accepted
          ? 'El nombre y el email son la identidad de esta persona en MultiFamBank: el cambio aplica también si es cliente de otros bancos, y va a tener que ingresar con el email nuevo.'
          : 'Si cambiás el email, la invitación anterior deja de funcionar y se genera una nueva para el email nuevo.'}
      </Alert>
      {error && !error.fields.name && !error.fields.email && <Alert tone="error">{error.message}</Alert>}
      <TextField label="Nombre" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} error={error?.fields.name} />
      <TextField
        label="Email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error?.fields.email}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={submitting}>
          Guardar
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

function PasswordForm({ bank, onCancel, onSaved }: { bank: PlatformBankDetail; onCancel: () => void; onSaved: (message: string) => void }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      onSaved(await setPlatformBankAdminPassword(api, bank.id, { password, password_confirmation: confirmation }))
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4" noValidate>
      <Alert tone="warning">
        Se cierran todas las sesiones de {bank.admin.name ?? 'esta persona'}. La contraseña es la misma para todos sus accesos, también como
        cliente de otros bancos. Comunicásela por un canal seguro.
      </Alert>
      {error && !error.fields.password && <Alert tone="error">{error.message}</Alert>}
      <TextField
        label="Contraseña nueva"
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
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={submitting}>
          Cambiar contraseña
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

function ClientsSection({ bank }: { bank: PlatformBankDetail }) {
  const clients = bank.clients

  return (
    <Card title={`Clientes (${clients.length})`}>
      {clients.length === 0 ? (
        <p className="text-slate-600">Este banco todavía no tiene clientes.</p>
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-600">
              <tr>
                <th scope="col" className="px-2 py-2 font-medium">Nombre</th>
                <th scope="col" className="px-2 py-2 font-medium">Email</th>
                <th scope="col" className="px-2 py-2 font-medium">Estado</th>
                <th scope="col" className="px-2 py-2 font-medium whitespace-nowrap">Cliente desde</th>
                <th scope="col" className="px-2 py-2 font-medium whitespace-nowrap">Última actividad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map((client) => (
                <tr key={client.id}>
                  <td className="px-2 py-2">{client.name}</td>
                  <td className="px-2 py-2 break-all text-slate-600">{client.email}</td>
                  <td className="px-2 py-2">{client.status === 'active' ? 'Activo' : 'Dado de baja'}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{formatDate(client.member_since)}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{formatDateTime(client.last_seen_at, 'Nunca')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
