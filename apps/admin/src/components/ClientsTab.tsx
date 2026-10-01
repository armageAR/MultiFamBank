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
import { Alert, Button, formatDate, formatDateTime, formatUsd, StatusBadge } from '@multifambank/ui'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api'
import { keys, useRefreshAdminData } from '../queries'
import { EditClientModal, InvitationLink, InviteModal, NewOperationModal, PasswordModal } from './ClientModals'
import { HistoryModal } from './HistoryModal'

type Dialog = { kind: 'invite' } | { kind: 'edit' | 'password' | 'history' | 'operation'; client: AdminClient } | null

const action = 'rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900'

function InvitationRow({ invitation, readOnly, onError }: { invitation: ClientInvitation; readOnly: boolean; onError: (m: string) => void }) {
  const refresh = useRefreshAdminData()
  const [result, setResult] = useState<InvitationResult | null>(null)

  async function run(fn: () => Promise<unknown>) {
    try {
      await fn()
      await refresh()
    } catch (error) {
      onError(toApiError(error).message)
    }
  }

  return (
    <li className="flex flex-col gap-2 border-b border-gray-100 py-3 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">{invitation.name}</p>
          <p className="truncate text-xs text-gray-500">{invitation.email}</p>
        </div>
        <StatusBadge tone={invitation.state === 'expired' ? 'error' : 'warning'} label={invitation.state === 'expired' ? 'Vencida' : `Vence ${formatDate(invitation.expires_at)}`} />
      </div>
      {!readOnly && (
        <div className="flex gap-2">
          <button type="button" className={action} onClick={() => run(async () => setResult(await resendClientInvitation(api, invitation.id)))}>
            Reenviar
          </button>
          <button type="button" className={action} onClick={() => run(() => revokeClientInvitation(api, invitation.id))}>
            Anular
          </button>
        </div>
      )}
      {result && <InvitationLink result={result} />}
    </li>
  )
}

/** FamBank's member card: identity, balance, last activity, and actions. */
function ClientCard({ client, readOnly, onOpen, onError }: { client: AdminClient; readOnly: boolean; onOpen: (d: Dialog) => void; onError: (m: string) => void }) {
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
            {client.pending_requests > 0 && <StatusBadge tone="warning" label={`${client.pending_requests} pendiente${client.pending_requests > 1 ? 's' : ''}`} />}
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
                  <InvitationRow key={invitation.id} invitation={invitation} readOnly={readOnly} onError={setError} />
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

      {dialog?.kind === 'invite' && <InviteModal onClose={() => setDialog(null)} />}
      {dialog?.kind === 'edit' && <EditClientModal client={dialog.client} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'password' && <PasswordModal client={dialog.client} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'operation' && <NewOperationModal client={dialog.client} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'history' && <HistoryModal client={dialog.client} readOnly={readOnly} onClose={() => setDialog(null)} />}
    </div>
  )
}
