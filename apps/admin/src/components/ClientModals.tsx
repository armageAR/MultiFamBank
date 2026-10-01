import {
  inviteClient,
  recordOperation,
  sendClientPasswordReset,
  setClientPassword,
  toApiError,
  updateClient,
  type AdminClient,
  type ApiError,
  type InvitationResult,
} from '@multifambank/api-client'
import { Alert, Button, Modal, TextField } from '@multifambank/ui'
import { useState, type FormEvent } from 'react'
import { api } from '../api'
import { localToIso, parseAmount } from '../amounts'
import { useExchangeRates, useRefreshAdminData } from '../queries'
import { suggestedRate, type OperationDraft } from '../operationDraft'
import { OperationFields } from './OperationFields'

function ErrorBanner({ error, fields }: { error: ApiError | null; fields: string[] }) {
  if (!error || fields.some((field) => error.fields[field])) return null
  return <Alert tone="error">{error.message}</Alert>
}

/** Shows the invitation link while email delivery is not configured, as in the platform app. */
export function InvitationLink({ result }: { result: InvitationResult }) {
  const [copied, setCopied] = useState(false)

  if (!result.invitation_url) {
    return result.email_sent ? (
      <Alert tone="success">Le enviamos la invitación a {result.data.email}.</Alert>
    ) : (
      <Alert tone="warning">No se pudo enviar el email a {result.data.email}. Probá reenviarla.</Alert>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Alert tone="success">Invitación lista para {result.data.email}. El envío de emails todavía no está configurado: compartile este link (sirve una sola vez).</Alert>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-xl bg-gray-50 px-3 py-2 text-xs whitespace-nowrap">{result.invitation_url}</code>
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(result.invitation_url!)
              setCopied(true)
            } catch {
              setCopied(false)
            }
          }}
        >
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
    </div>
  )
}

export function InviteModal({ onClose }: { onClose: () => void }) {
  const refresh = useRefreshAdminData()
  const [form, setForm] = useState({ name: '', email: '' })
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<InvitationResult | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      setResult(await inviteClient(api, form))
      await refresh()
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Invitar cliente" onClose={onClose}>
      {result ? (
        <>
          <InvitationLink result={result} />
          <Button variant="secondary" onClick={onClose}>
            Listo
          </Button>
        </>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
          <p className="text-xs text-gray-500">Le llega un link para crear su cuenta, o para sumarse con la que ya tiene si es cliente de otro banco.</p>
          <ErrorBanner error={error} fields={['name', 'email']} />
          <TextField label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={error?.fields.name} />
          <TextField
            label="Email"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            error={error?.fields.email}
          />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" loading={loading} disabled={!form.name || !form.email}>
              Invitar
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}

export function EditClientModal({ client, onClose }: { client: AdminClient; onClose: () => void }) {
  const refresh = useRefreshAdminData()
  const [form, setForm] = useState({ name: client.name, email: client.email })
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await updateClient(api, client.membership_id, form)
      await refresh()
      onClose()
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title={`Editar · ${client.name}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <ErrorBanner error={error} fields={['name', 'email']} />
        <TextField label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={error?.fields.name} />
        <TextField
          label="Email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          value={form.email}
          hint="Si cambia el email, va a tener que volver a ingresar con el nuevo."
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          error={error?.fields.email}
        />
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" loading={loading} disabled={!form.name || !form.email}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export function PasswordModal({ client, onClose }: { client: AdminClient; onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState<'set' | 'reset' | null>(null)

  async function run(action: 'set' | 'reset') {
    setBusy(action)
    setError(null)
    try {
      setDone(
        action === 'set'
          ? await setClientPassword(api, client.membership_id, { password, password_confirmation: confirmation })
          : await sendClientPasswordReset(api, client.membership_id),
      )
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal title={`Contraseña · ${client.name}`} onClose={onClose}>
      {done ? (
        <>
          <Alert tone="success">{done}</Alert>
          <Button variant="secondary" onClick={onClose}>
            Listo
          </Button>
        </>
      ) : (
        <>
          <ErrorBanner error={error} fields={['password']} />
          {client.manageable ? (
            <>
              <TextField
                label="Contraseña nueva"
                type="password"
                autoComplete="off"
                data-1p-ignore
                hint="Mínimo 8 caracteres. Se cierran sus sesiones abiertas."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={error?.fields.password}
              />
              <TextField
                label="Repetir contraseña"
                type="password"
                autoComplete="off"
                data-1p-ignore
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
              <Button loading={busy === 'set'} disabled={!password || !confirmation} onClick={() => run('set')}>
                Cambiar contraseña
              </Button>
              <p className="text-center text-xs text-gray-500">o</p>
            </>
          ) : (
            <p className="text-xs text-gray-500">
              {client.name} también usa MultiFamBank en otro banco, así que solo puede cambiar su contraseña desde un link.
            </p>
          )}
          <Button variant="secondary" loading={busy === 'reset'} onClick={() => run('reset')}>
            Enviarle un link para restablecerla
          </Button>
        </>
      )}
    </Modal>
  )
}

/** An operation that already happened outside the app; it is confirmed at once (as in FamBank). */
export function NewOperationModal({ client, onClose }: { client: AdminClient; onClose: () => void }) {
  const refresh = useRefreshAdminData()
  const rates = useExchangeRates()
  const [draft, setDraft] = useState<OperationDraft>({ type: 'savings_deposit', amount: '', description: '', rate: '', occurredAt: '' })
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(false)
  const rate = draft.rate || suggestedRate(draft.type, rates.data)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const amount = parseAmount(draft.amount)
    const parsedRate = draft.type === 'expense' ? null : parseAmount(rate)
    if (!amount) return setError({ message: 'Ingresá un monto válido.', fields: { amount_ars: 'Ingresá un monto válido.' } })
    if (draft.type !== 'expense' && !parsedRate) return setError({ message: 'Ingresá la cotización.', fields: { exchange_rate: 'Ingresá la cotización.' } })

    setLoading(true)
    setError(null)
    try {
      await recordOperation(api, client.membership_id, {
        type: draft.type,
        amount_ars: amount,
        description: draft.description.trim() || null,
        exchange_rate: parsedRate,
        occurred_at: localToIso(draft.occurredAt),
      })
      await refresh()
      onClose()
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title={`Nueva operación · ${client.name}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <p className="text-xs text-gray-500">Para registrar algo que ya pasó: queda confirmado en el momento.</p>
        <ErrorBanner error={error} fields={['type', 'amount_ars', 'description', 'exchange_rate', 'occurred_at']} />
        <OperationFields
          draft={{ ...draft, rate }}
          onChange={setDraft}
          errors={error?.fields ?? {}}
          rates={rates.data}
          dateHint="Vacía: ahora."
        />
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" loading={loading}>
            Registrar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
