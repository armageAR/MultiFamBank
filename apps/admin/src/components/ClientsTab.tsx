import {
  fetchAdminClients,
  resendClientInvitation,
  revokeClientInvitation,
  setClientActive,
  toApiError,
  type AdminClient,
  type ClientInvitation,
  type InvitationResult,
} from '@multifambank/api-client'
import { Alert, Button, formatCountdown, formatDate, formatDateTime, formatUsd, Modal, StatusBadge, useCountdown } from '@multifambank/ui'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api'
import { keys, useRefreshAdminData } from '../queries'
import { EditClientModal, InvitationLink, InviteModal, NewOperationModal, PasswordModal } from './ClientModals'
import { HistoryModal } from './HistoryModal'

type Dialog = { kind: 'invite' } | { kind: 'edit' | 'password' | 'history' | 'operation'; client: AdminClient } | null

const action =
  'rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900'

interface InvitationRowProps {
  invitation: ClientInvitation
  readOnly: boolean
  onError: (message: string) => void
  /** The new link outlives this row: resending replaces the invitation, so the list re-renders. */
  onResent: (result: InvitationResult) => void
}

function InvitationRow({ invitation, readOnly, onError, onResent }: InvitationRowProps) {
  const refresh = useRefreshAdminData()
  const [confirmingRevoke, setConfirmingRevoke] = useState(false)
  const [busy, setBusy] = useState(false)
  // At most one email every 5 minutes to the same person (the server enforces it too).
  const wait = useCountdown(invitation.resend_available_at)

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    try {
      await fn()
      await refresh()
    } catch (error) {
      onError(toApiError(error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex flex-col gap-2 border-b border-gray-100 py-3 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">{invitation.name}</p>
          <p className="truncate text-xs text-gray-500">{invitation.email}</p>
        </div>
        <StatusBadge
          tone={invitation.state === 'expired' ? 'error' : 'warning'}
          label={invitation.state === 'expired' ? 'Vencida' : `Vence ${formatDate(invitation.expires_at)}`}
        />
      </div>
      {!readOnly && (
        <div className="flex gap-2">
          <button
            type="button"
            className={`${action} disabled:cursor-not-allowed disabled:opacity-50`}
            disabled={wait > 0 || busy}
            title={wait > 0 ? 'Para no mandar muchos emails seguidos, se puede reenviar cada 5 minutos.' : undefined}
            onClick={() => run(async () => onResent(await resendClientInvitation(api, invitation.id)))}
          >
            {wait > 0 ? `Reenviar en ${formatCountdown(wait)}` : 'Reenviar'}
          </button>
          <button type="button" className={action} disabled={busy} onClick={() => setConfirmingRevoke(true)}>
            Anular
          </button>
        </div>
      )}
      {confirmingRevoke && (
        <Modal title="Anular invitación" onClose={() => setConfirmingRevoke(false)}>
          <p className="text-sm text-gray-700">
            ¿Anular la invitación de <strong>{invitation.name}</strong> ({invitation.email})? El link que recibió deja de funcionar. Podés
            invitarla de nuevo más adelante.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmingRevoke(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              loading={busy}
              onClick={() => run(() => revokeClientInvitation(api, invitation.id)).then(() => setConfirmingRevoke(false))}
            >
              Anular invitación
            </Button>
          </div>
        </Modal>
      )}
    </li>
  )
}

/** FamBank's member card: identity, balance, last activity, and actions. */
function ClientCard({
  client,
  readOnly,
  onOpen,
  onError,
}: {
  client: AdminClient
  readOnly: boolean
  onOpen: (d: Dialog) => void
  onError: (m: string) => void
}) {
  const refresh = useRefreshAdminData()
  const active = client.status === 'active'

  async function toggle() {
    try {
      await setClientActive(api, client.membership_id, !active)
      await refresh()
    } catch (error) {
      onError(toApiError(error).message)
    }
  }

  return (
    <div className={`flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm ${active ? '' : 'opacity-70'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">{client.name}</p>
            {!active && <StatusBadge tone="neutral" label="Dado de baja" />}
            {client.pending_requests > 0 && (
              <StatusBadge tone="warning" label={`${client.pending_requests} pendiente${client.pending_requests > 1 ? 's' : ''}`} />
            )}
          </div>
          <p className="truncate text-xs text-gray-500">{client.email}</p>
        </div>
        <div className="text-right">
          <p className="text-base font-bold text-emerald-700">{formatUsd(client.balance_usd)}</p>
          {Number(client.reserved_usd) > 0 && <p className="text-xs text-gray-500">disp. {formatUsd(client.available_usd)}</p>}
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Última actividad: {formatDateTime(client.last_seen_at, 'nunca')} · cliente desde {formatDate(client.member_since)}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={action} onClick={() => onOpen({ kind: 'history', client })}>
          Historial
        </button>
        {!readOnly && active && (
          <>
            <button type="button" className={action} onClick={() => onOpen({ kind: 'operation', client })}>
              Nueva operación
            </button>
            {client.manageable && (
              <button type="button" className={action} onClick={() => onOpen({ kind: 'edit', client })}>
                Editar
              </button>
            )}
            <button type="button" className={action} onClick={() => onOpen({ kind: 'password', client })}>
              Contraseña
            </button>
          </>
        )}
        {!readOnly && (
          <button type="button" className={action} onClick={toggle}>
            {active ? 'Dar de baja' : 'Reactivar'}
          </button>
        )}
      </div>
    </div>
  )
}

export function ClientsTab({ readOnly }: { readOnly: boolean }) {
  const clients = useQuery({ queryKey: keys.clients, queryFn: () => fetchAdminClients(api) })
  const [dialog, setDialog] = useState<Dialog>(null)
  const [error, setError] = useState<string | null>(null)
  const [resent, setResent] = useState<InvitationResult | null>(null)

  return (
    <div className="flex flex-col gap-4">
      {!readOnly && <Button onClick={() => setDialog({ kind: 'invite' })}>+ Invitar cliente</Button>}
      {error && (
        <div onClick={() => setError(null)}>
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {clients.isPending ? (
        <p className="text-center text-sm text-gray-500">Cargando…</p>
      ) : clients.isError ? (
        <Alert tone="error">{toApiError(clients.error).message}</Alert>
      ) : (
        <>
          {clients.data.invitations.length > 0 && (
            <section className="rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
              <h2 className="text-xs tracking-wide text-gray-500 uppercase">Invitaciones pendientes</h2>
              <ul>
                {clients.data.invitations.map((invitation) => (
                  <InvitationRow key={invitation.id} invitation={invitation} readOnly={readOnly} onError={setError} onResent={setResent} />
                ))}
              </ul>
            </section>
          )}
          {clients.data.clients.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Todavía no hay clientes. Invitá al primero.</p>
          ) : (
            clients.data.clients.map((client) => (
              <ClientCard key={client.membership_id} client={client} readOnly={readOnly} onOpen={setDialog} onError={setError} />
            ))
          )}
        </>
      )}

      {/* Write dialogs close themselves when the bank pauses or the device goes offline. */}
      {!readOnly && dialog?.kind === 'invite' && <InviteModal onClose={() => setDialog(null)} />}
      {!readOnly && dialog?.kind === 'edit' && <EditClientModal client={dialog.client} onClose={() => setDialog(null)} />}
      {!readOnly && dialog?.kind === 'password' && <PasswordModal client={dialog.client} onClose={() => setDialog(null)} />}
      {!readOnly && dialog?.kind === 'operation' && <NewOperationModal client={dialog.client} onClose={() => setDialog(null)} />}
      {resent && (
        <Modal title="Invitación reenviada" onClose={() => setResent(null)}>
          <InvitationLink result={resent} />
          <p className="text-xs text-gray-500">El link anterior ya no funciona.</p>
          <Button variant="secondary" onClick={() => setResent(null)}>
            Listo
          </Button>
        </Modal>
      )}
      {/* The fresh row, so the balance follows corrections made from the history. */}
      {dialog?.kind === 'history' && (
        <HistoryModal
          client={clients.data?.clients.find((client) => client.membership_id === dialog.client.membership_id) ?? dialog.client}
          readOnly={readOnly}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}
