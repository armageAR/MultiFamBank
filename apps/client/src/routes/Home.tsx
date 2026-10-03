import {
  cancelMyOperation,
  fetchClientBanks,
  fetchExchangeRates,
  fetchMyOperations,
  toApiError,
  type ClientBank,
  type Operation,
} from '@multifambank/api-client'
import { AccountModal, PushControls, useAuth, useOnline } from '@multifambank/auth'
import {
  Alert,
  AuthLayout,
  Button,
  Card,
  FamilyShell,
  formatArs,
  formatDateTime,
  formatUsd,
  HeaderButton,
  operationLabels,
  OperationStatusBadge,
  OperationTypeBadge,
} from '@multifambank/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import type { OutboxRequest } from '@multifambank/offline'
import { api } from '../api'
import { ExpenseModal } from '../components/requests/ExpenseModal'
import { SavingsModal } from '../components/requests/SavingsModal'
import { QuotesCard } from '../components/QuotesCard'
import { useOutbox } from '../outbox'

function OperationRow({
  operation,
  bankId,
  readOnly,
  highlighted,
}: {
  operation: Operation
  bankId: number
  readOnly: boolean
  highlighted: boolean
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const { requested } = operation
  const row = useRef<HTMLLIElement>(null)

  // Opened from a notification: bring the operation into view.
  useEffect(() => {
    if (highlighted) row.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlighted])

  async function cancel() {
    try {
      await cancelMyOperation(api, bankId, operation.id)
      await queryClient.invalidateQueries({ queryKey: ['client'] })
    } catch (err) {
      setError(toApiError(err).message)
    }
  }

  return (
    <li
      ref={row}
      aria-current={highlighted ? 'true' : undefined}
      className={`flex flex-col gap-1 border-b border-gray-100 py-3 last:border-0 ${highlighted ? '-mx-2 rounded-xl bg-emerald-50 px-2 ring-2 ring-emerald-300' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <OperationTypeBadge type={operation.type} audience="client" />
        <OperationStatusBadge status={operation.status} />
      </div>
      <div className="text-right">
        <p className="text-base font-semibold text-gray-900">{formatArs(operation.amount_ars)}</p>
        {operation.amount_usd && <p className="text-xs text-gray-500">{formatUsd(operation.amount_usd)}</p>}
      </div>
      {operation.description && <p className="text-sm text-gray-700">{operation.description}</p>}
      {operation.changed_by_admin && (
        <p className="text-xs text-amber-700">
          El administrador lo cambió. Pediste: {operationLabels[requested.type].client} de {formatArs(requested.amount_ars)}
          {requested.description && requested.description !== operation.description ? ` — “${requested.description}”` : ''}
        </p>
      )}
      {operation.recorded_by_admin && <p className="text-xs text-gray-500">Registrada por el administrador</p>}
      {operation.rejection_reason && <p className="text-xs text-red-600">Motivo: {operation.rejection_reason}</p>}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {operation.status === 'confirmed' ? formatDateTime(operation.occurred_at) : `Pedido el ${formatDateTime(operation.created_at)}`}
        </span>
        {operation.status === 'pending' && !readOnly && (
          <button type="button" onClick={cancel} className="text-red-600 hover:underline">
            cancelar
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </li>
  )
}

/** A request saved on this device: waiting for a connection, or refused by the server with a reason. */
function OutboxRow({ item, sending, onDiscard }: { item: OutboxRequest; sending: boolean; onDiscard: (item: OutboxRequest) => void }) {
  const rejected = item.state === 'rejected'

  return (
    <li className="flex flex-col gap-1 border-b border-gray-100 py-3 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <OperationTypeBadge type={item.payload.type} audience="client" />
        <span
          className={`inline-flex rounded-md border px-1.5 py-0.5 text-xs whitespace-nowrap ${rejected ? 'border-red-200 bg-red-50 text-red-600' : 'border-sky-200 bg-sky-50 text-sky-700'}`}
        >
          {rejected ? 'No se pudo enviar' : 'Pendiente de sincronización'}
        </span>
      </div>
      <p className="text-right text-base font-semibold text-gray-900">{formatArs(item.payload.amount_ars)}</p>
      {item.payload.description && <p className="text-sm text-gray-700">{item.payload.description}</p>}
      {rejected && <p className="text-xs text-red-600">{item.lastError}</p>}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Guardado el {formatDateTime(item.createdAt)} en este dispositivo</span>
        {/* While it is being sent it may already have reached the server. */}
        {!(sending && !rejected) && (
          <button type="button" onClick={() => onDiscard(item)} className="text-red-600 hover:underline">
            descartar
          </button>
        )}
      </div>
    </li>
  )
}

interface BankViewProps {
  membership: ClientBank
  banks: ClientBank[]
  syncedAt: number
  highlightedOperation: string | null
  onSwitch: (id: number) => void
}

function BankView({ membership, banks, syncedAt, highlightedOperation, onSwitch }: BankViewProps) {
  const { user, signOut } = useAuth()
  const online = useOnline()
  const [asking, setAsking] = useState<'deposit' | 'withdrawal' | 'expense' | null>(null)
  const [account, setAccount] = useState(false)
  const bankId = membership.bank.id
  const rates = useQuery({ queryKey: ['exchange-rates'], queryFn: () => fetchExchangeRates(api), staleTime: 5 * 60_000, retry: false })
  const balanceArs = rates.data ? Number(membership.balance_usd) * Number(rates.data.blue.buy) : null
  const operations = useQuery({ queryKey: ['client', 'operations', bankId], queryFn: () => fetchMyOperations(api, bankId) })
  const paused = membership.bank.status === 'paused'
  // Offline, requests can still be prepared (they wait in the outbox); a paused bank takes none.
  const readOnly = paused
  const outbox = useOutbox(user!.id, bankId)
  const queued = outbox.queuedCount
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmingExit, setConfirmingExit] = useState(false)

  function queuedNotice() {
    setAsking(null)
    setNotice('Pedido guardado en este dispositivo. Se envía solo cuando haya conexión, con la cotización de ese momento.')
  }

  // Unsent requests live only on this device and are wiped on sign-out: ask first.
  function exit() {
    if (queued > 0) setConfirmingExit(true)
    else void signOut()
  }

  return (
    <FamilyShell
      eyebrow={membership.bank.name ?? 'Mi banco'}
      name={user!.name}
      actions={
        <>
          <PushControls api={api} />
          <HeaderButton onClick={() => setAccount(true)}>Mi cuenta</HeaderButton>
          <HeaderButton onClick={exit}>Salir</HeaderButton>
        </>
      }
    >
      {!online && (
        <Alert tone="warning">
          Sin conexión: ves los datos descargados el {formatDateTime(new Date(syncedAt).toISOString())}. Los saldos pueden haber cambiado.
          Podés preparar pedidos: se envían solos cuando vuelva la conexión.
        </Alert>
      )}
      {notice && (
        <Alert tone="info">
          <div className="flex items-start justify-between gap-3">
            <span>{notice}</span>
            <button type="button" aria-label="Cerrar" onClick={() => setNotice(null)}>
              ✕
            </button>
          </div>
        </Alert>
      )}
      {confirmingExit && (
        <Alert tone="warning" title={`Tenés ${queued} pedido${queued > 1 ? 's' : ''} sin enviar`}>
          <p>Si salís ahora se borran de este dispositivo y no se envían.</p>
          <div className="mt-2 flex gap-2">
            <Button variant="secondary" className="flex-1 py-2" onClick={() => setConfirmingExit(false)}>
              Quedarme
            </Button>
            <Button variant="danger" className="flex-1 py-2" onClick={() => void signOut()}>
              Salir igual
            </Button>
          </div>
        </Alert>
      )}
      <div role="status" aria-live="polite">
        {queued > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-800">
            <span>
              {queued} pedido{queued > 1 ? 's' : ''} esperando para enviarse.
              {outbox.lastFailed && ' El último intento falló; se reintenta solo.'}
            </span>
            {online && (
              <button
                type="button"
                onClick={outbox.sync}
                disabled={outbox.syncing}
                className="font-semibold hover:underline disabled:opacity-50"
              >
                {outbox.syncing ? 'Enviando…' : 'Sincronizar ahora'}
              </button>
            )}
          </div>
        )}
      </div>
      {paused && (
        <Alert tone="warning" title="Las operaciones del banco están pausadas">
          Comunicate con el administrador de tu banco.
        </Alert>
      )}
      {banks.length > 1 && (
        <nav className="flex gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 shadow-sm" aria-label="Tus bancos">
          {banks.map((b) => {
            const current = b.bank.id === bankId
            return (
              <button
                key={b.bank.id}
                type="button"
                aria-current={current ? 'page' : undefined}
                onClick={() => onSwitch(b.bank.id)}
                className={`flex min-w-28 flex-1 flex-col rounded-lg px-3 py-2 text-left whitespace-nowrap ${current ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:text-gray-900'}`}
              >
                <span className="text-sm font-semibold">{b.bank.name}</span>
                <span className={`text-xs ${current ? 'text-emerald-50' : 'text-gray-500'}`}>
                  {b.bank.status === 'paused' ? 'Pausado' : formatUsd(b.available_usd)}
                </span>
              </button>
            )
          })}
        </nav>
      )}

      <Card title="Mis ahorros">
        <div className="grid grid-cols-1 gap-3 min-[410px]:grid-cols-2">
          <div className="rounded-xl bg-emerald-50 px-4 py-3 text-right">
            <p className="mb-1 text-xs text-emerald-700">Dólares</p>
            <p className="text-lg font-bold whitespace-nowrap text-emerald-700">{formatUsd(membership.balance_usd)}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3 text-right">
            <p className="mb-1 text-xs text-gray-500">Pesos (blue compra)</p>
            <p className="text-lg font-bold whitespace-nowrap text-gray-900">{balanceArs !== null ? formatArs(balanceArs) : '—'}</p>
          </div>
        </div>
        {Number(membership.reserved_usd) > 0 && (
          <p className="mt-3 text-xs text-gray-500">
            {formatUsd(membership.reserved_usd)} reservados por retiros pendientes · disponible {formatUsd(membership.available_usd)}
          </p>
        )}
      </Card>

      {!readOnly && (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => setAsking('deposit')}>Depositar</Button>
          <Button variant="danger" onClick={() => setAsking('withdrawal')}>
            Retirar
          </Button>
          <Button variant="warning" className="col-span-2" onClick={() => setAsking('expense')}>
            Pedir dinero para un gasto
          </Button>
        </div>
      )}

      <QuotesCard rates={rates} />

      <Card title="Mis movimientos">
        {operations.isPending ? (
          <p className="text-sm text-gray-500">Cargando…</p>
        ) : operations.isError ? (
          <Alert tone="error">{toApiError(operations.error).message}</Alert>
        ) : operations.data.data.length === 0 && outbox.items.length === 0 ? (
          <p className="text-sm text-gray-500">Todavía no tenés movimientos.</p>
        ) : (
          <ul>
            {outbox.items.map((item) => (
              <OutboxRow key={item.id} item={item} sending={outbox.syncing} onDiscard={outbox.discard} />
            ))}
            {operations.data.data.map((operation) => (
              <OperationRow
                key={operation.id}
                operation={operation}
                bankId={bankId}
                readOnly={readOnly || !online}
                highlighted={operation.id === highlightedOperation}
              />
            ))}
          </ul>
        )}
      </Card>

      {(asking === 'deposit' || asking === 'withdrawal') && !readOnly && (
        <SavingsModal
          kind={asking}
          bankId={bankId}
          bankName={membership.bank.name ?? 'tu banco'}
          availableUsd={membership.available_usd}
          rates={rates.data}
          ratesUpdatedAt={rates.dataUpdatedAt}
          online={online}
          enqueue={outbox.add}
          onRateChanged={() => void rates.refetch()}
          onClose={() => setAsking(null)}
          onQueued={queuedNotice}
        />
      )}
      {asking === 'expense' && !readOnly && (
        <ExpenseModal
          bankId={bankId}
          bankName={membership.bank.name ?? 'tu banco'}
          online={online}
          enqueue={outbox.add}
          onClose={() => setAsking(null)}
          onQueued={queuedNotice}
        />
      )}
      {account && user && (
        <AccountModal
          api={api}
          user={user}
          nameNote="El nombre lo administra el administrador de tu banco."
          savedMessage="Datos actualizados. Se cerraron las sesiones en otros dispositivos; los pedidos que tuvieran sin enviar se pierden."
          onClose={() => setAccount(false)}
        />
      )}
    </FamilyShell>
  )
}

export function Home() {
  const { user, isLoading, signOut } = useAuth()
  const [params, setParams] = useSearchParams()
  const banks = useQuery({ queryKey: ['client', 'banks'], queryFn: () => fetchClientBanks(api), enabled: Boolean(user) })

  if (isLoading) return <p className="p-6 text-center text-sm text-gray-500">Cargando…</p>
  if (!user) return <Navigate to="/ingresar" replace />
  if (banks.isPending) return <p className="p-6 text-center text-sm text-gray-500">Cargando…</p>
  if (banks.isError) {
    return (
      <AuthLayout appName="Mi banco" title="Mi banco">
        <Alert tone="error">{toApiError(banks.error).message}</Alert>
      </AuthLayout>
    )
  }

  if (banks.data.length === 0) {
    return (
      <AuthLayout appName="Mi banco" title="Sin bancos">
        <p className="text-sm text-gray-700">Todavía no sos cliente de ningún banco. Cuando te inviten, vas a recibir un link.</p>
        <Button variant="secondary" className="w-full" onClick={signOut}>
          Salir
        </Button>
      </AuthLayout>
    )
  }

  const selected = banks.data.find((b) => b.bank.id === Number(params.get('banco'))) ?? banks.data[0]

  return (
    <BankView
      key={selected.bank.id}
      membership={selected}
      banks={banks.data}
      syncedAt={banks.dataUpdatedAt}
      highlightedOperation={params.get('operacion')}
      onSwitch={(id) => setParams({ banco: String(id) }, { replace: true })}
    />
  )
}
