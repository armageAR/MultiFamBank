import { cancelMyOperation, fetchClientBanks, fetchMyOperations, toApiError, type ClientBank, type Operation } from '@multifambank/api-client'
import { useAuth, useOnline } from '@multifambank/auth'
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
import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { api } from '../api'
import { NewRequestModal } from '../NewRequestModal'
import { PushControls } from '../PushControls'

function OperationRow({ operation, bankId, readOnly }: { operation: Operation; bankId: number; readOnly: boolean }) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const { requested } = operation

  async function cancel() {
    try {
      await cancelMyOperation(api, bankId, operation.id)
      await queryClient.invalidateQueries({ queryKey: ['client'] })
    } catch (err) {
      setError(toApiError(err).message)
    }
  }

  return (
    <li className="flex flex-col gap-1 border-b border-gray-100 py-3 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <OperationTypeBadge type={operation.type} audience="client" />
        <OperationStatusBadge status={operation.status} />
      </div>
      <div className="flex items-baseline justify-between gap-2">
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
        <span>{operation.status === 'confirmed' ? formatDateTime(operation.occurred_at) : `Pedido el ${formatDateTime(operation.created_at)}`}</span>
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

function BankView({ membership, banks, onSwitch }: { membership: ClientBank; banks: ClientBank[]; onSwitch: (id: number) => void }) {
  const { user, signOut } = useAuth()
  const online = useOnline()
  const [asking, setAsking] = useState(false)
  const bankId = membership.bank.id
  const operations = useQuery({ queryKey: ['client', 'operations', bankId], queryFn: () => fetchMyOperations(api, bankId) })
  const paused = membership.bank.status === 'paused'
  const readOnly = paused || !online

  return (
    <FamilyShell
      eyebrow={membership.bank.name ?? 'Mi banco'}
      name={user!.name}
      actions={
        <>
          <PushControls />
          <HeaderButton onClick={signOut}>Salir</HeaderButton>
        </>
      }
    >
      {!online && <Alert tone="warning">Sin conexión: ves los últimos datos descargados. Para pedir plata hace falta internet.</Alert>}
      {paused && <Alert tone="warning" title="Las operaciones del banco están pausadas">Comunicate con el administrador de tu banco.</Alert>}
      {banks.length > 1 && (
        <nav className="flex gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 shadow-sm" aria-label="Tus bancos">
          {banks.map((b) => (
            <button
              key={b.bank.id}
              type="button"
              aria-current={b.bank.id === bankId ? 'page' : undefined}
              onClick={() => onSwitch(b.bank.id)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap ${b.bank.id === bankId ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:text-gray-900'}`}
            >
              {b.bank.name}
            </button>
          ))}
        </nav>
      )}

      <Card title="Mis ahorros">
        <p className="text-3xl font-bold text-emerald-700">{formatUsd(membership.available_usd)}</p>
        <p className="mt-1 text-xs text-gray-500">
          Disponible{Number(membership.reserved_usd) > 0 ? ` · ${formatUsd(membership.reserved_usd)} reservados por retiros pendientes` : ''}
        </p>
      </Card>

      {!readOnly && <Button onClick={() => setAsking(true)}>+ Nuevo pedido</Button>}

      <Card title="Mis movimientos">
        {operations.isPending ? (
          <p className="text-sm text-gray-500">Cargando…</p>
        ) : operations.isError ? (
          <Alert tone="error">{toApiError(operations.error).message}</Alert>
        ) : operations.data.data.length === 0 ? (
          <p className="text-sm text-gray-500">Todavía no tenés movimientos.</p>
        ) : (
          <ul>
            {operations.data.data.map((operation) => (
              <OperationRow key={operation.id} operation={operation} bankId={bankId} readOnly={readOnly} />
            ))}
          </ul>
        )}
      </Card>

      {asking && <NewRequestModal bankId={bankId} onClose={() => setAsking(false)} />}
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

  return <BankView membership={selected} banks={banks.data} onSwitch={(id) => setParams({ banco: String(id) }, { replace: true })} />
}
