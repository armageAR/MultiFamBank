import {
  changeOperationAmount,
  changeOperationDate,
  deleteOperation,
  fetchClientOperations,
  toApiError,
  type AdminClient,
  type Operation,
} from '@multifambank/api-client'
import {
  Alert,
  Button,
  formatArs,
  formatDateTime,
  formatUsd,
  Modal,
  operationLabels,
  OperationStatusBadge,
  OperationTypeBadge,
  parseAmount,
  RowMenu,
  TextField,
  toAmountInput,
  toDateTimeLocal,
} from '@multifambank/ui'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api'
import { localToIso } from '../amounts'
import { keys, useRefreshAdminData } from '../queries'

function DateEditor({ operation, onDone }: { operation: Operation; onDone: () => void }) {
  const refresh = useRefreshAdminData()
  const [value, setValue] = useState(toDateTimeLocal(operation.occurred_at ?? operation.created_at))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await changeOperationDate(api, operation.id, localToIso(value)!)
      await refresh()
      onDone()
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-xl bg-gray-50 p-3">
      <label className="text-xs text-gray-500">
        Nueva fecha
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
        />
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1 py-2" onClick={onDone}>
          Cancelar
        </Button>
        <Button className="flex-1 py-2" loading={saving} disabled={!value} onClick={save}>
          Guardar fecha
        </Button>
      </div>
    </div>
  )
}

/** Dollars for an amount in pesos at the operation's rate, rounded half-up like the server. */
function toUsd(amountArs: string, rate: string): string {
  return (Math.round((Number(amountArs) / Number(rate)) * 100 + 1e-9) / 100).toFixed(2)
}

function AmountEditor({ operation, onDone }: { operation: Operation; onDone: () => void }) {
  const refresh = useRefreshAdminData()
  const [value, setValue] = useState(toAmountInput(operation.amount_ars))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const amount = parseAmount(value)
  const rate = operation.exchange_rate
  const usd = rate && amount ? toUsd(amount, rate) : null

  async function save() {
    if (saving) return
    if (!amount || Number(amount) <= 0) {
      setError('Ingresá un importe válido.')
      return
    }
    if (Number(amount) === Number(operation.amount_ars)) {
      onDone()
      return
    }
    setSaving(true)
    setError(null)
    try {
      await changeOperationAmount(api, operation.id, amount)
      await refresh()
      onDone()
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-xl bg-gray-50 p-3">
      <TextField
        label="Nuevo importe en pesos"
        inputMode="decimal"
        autoFocus
        value={value}
        error={error ?? undefined}
        inputClassName="text-right"
        hint={
          rate && usd && usd !== '0.00'
            ? `Son ${formatUsd(usd)} a ${formatArs(rate)}, la cotización de la operación. El saldo cambia en la diferencia.`
            : undefined
        }
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save()
        }}
      />
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1 py-2" onClick={onDone}>
          Cancelar
        </Button>
        <Button className="flex-1 py-2" loading={saving} onClick={save}>
          Guardar importe
        </Button>
      </div>
    </div>
  )
}

function DeleteConfirmation({ operation, onDone }: { operation: Operation; onDone: () => void }) {
  const refresh = useRefreshAdminData()
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const usd = operation.amount_usd ? formatUsd(operation.amount_usd) : null
  const effect = {
    savings_deposit: `Se descuentan ${usd} del saldo.`,
    savings_withdrawal: `Se devuelven ${usd} al saldo.`,
    expense: 'Deja de figurar en los gastos del banco.',
  }[operation.type]

  async function remove() {
    setDeleting(true)
    setError(null)
    try {
      await deleteOperation(api, operation.id)
      // The row disappears with the refresh; nothing is left to close.
      await refresh()
    } catch (err) {
      setError(toApiError(err).message)
      setDeleting(false)
    }
  }

  return (
    <div role="alertdialog" aria-label="Eliminar operación" className="mt-2 flex flex-col gap-2 rounded-xl border border-red-100 bg-red-50 p-3">
      <p className="text-sm text-red-800">
        ¿Eliminar este {operationLabels[operation.type].admin.toLowerCase()} de {formatArs(operation.amount_ars)}? {effect} No se puede deshacer.
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        {/* Focus lands on the safe choice, so the question is announced and Enter does not delete. */}
        <Button variant="secondary" className="flex-1 py-2" autoFocus onClick={onDone}>
          Cancelar
        </Button>
        <Button variant="danger" className="flex-1 py-2" loading={deleting} onClick={remove}>
          Eliminar
        </Button>
      </div>
    </div>
  )
}

type Editing = 'amount' | 'date' | 'delete' | null

function Row({ operation, readOnly }: { operation: Operation; readOnly: boolean }) {
  const [editing, setEditing] = useState<Editing>(null)
  const { requested } = operation
  const done = () => setEditing(null)

  return (
    <li className="flex flex-col gap-1 border-b border-gray-100 py-3 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <OperationTypeBadge type={operation.type} audience="admin" />
        <OperationStatusBadge status={operation.status} />
      </div>
      <div className="text-right">
        <p className="text-base font-semibold text-gray-900">{formatArs(operation.amount_ars)}</p>
        {operation.amount_usd && operation.exchange_rate && (
          <p className="text-xs text-gray-500">
            {formatUsd(operation.amount_usd)} a {formatArs(operation.exchange_rate)}
          </p>
        )}
      </div>
      {operation.description && <p className="text-sm text-gray-700">{operation.description}</p>}
      {operation.changed_by_admin && (
        <p className="text-xs text-amber-700">
          Pedido original: {operationLabels[requested.type].admin} de {formatArs(requested.amount_ars)}
          {requested.description && requested.description !== operation.description ? ` — “${requested.description}”` : ''}
        </p>
      )}
      {operation.rejection_reason && <p className="text-xs text-red-600">Motivo: {operation.rejection_reason}</p>}
      <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
        <span>
          {operation.status === 'confirmed' ? formatDateTime(operation.occurred_at) : `Pedido el ${formatDateTime(operation.created_at)}`}
          {operation.recorded_by_admin && ' · registrada por vos'}
        </span>
        {operation.status === 'confirmed' && !readOnly && !editing && (
          <RowMenu
            label={`Opciones de ${operationLabels[operation.type].admin.toLowerCase()} de ${formatArs(operation.amount_ars)}`}
            items={[
              { label: 'Modificar importe', onSelect: () => setEditing('amount') },
              { label: 'Cambiar fecha', onSelect: () => setEditing('date') },
              { label: 'Eliminar', onSelect: () => setEditing('delete'), tone: 'danger' },
            ]}
          />
        )}
      </div>
      {editing === 'amount' && <AmountEditor operation={operation} onDone={done} />}
      {editing === 'date' && <DateEditor operation={operation} onDone={done} />}
      {editing === 'delete' && <DeleteConfirmation operation={operation} onDone={done} />}
    </li>
  )
}

export function HistoryModal({ client, readOnly, onClose }: { client: AdminClient; readOnly: boolean; onClose: () => void }) {
  const history = useInfiniteQuery({
    queryKey: keys.history(client.membership_id),
    queryFn: ({ pageParam }) => fetchClientOperations(api, client.membership_id, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.current_page < last.meta.last_page ? last.meta.current_page + 1 : undefined),
  })
  const operations = history.data?.pages.flatMap((page) => page.data) ?? []

  return (
    <Modal title={`Historial · ${client.name}`} onClose={onClose}>
      <div className="grid grid-cols-1 gap-3 min-[410px]:grid-cols-2">
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-right">
          <p className="text-xs text-emerald-700">Saldo</p>
          <p className="text-lg font-bold text-emerald-700">{formatUsd(client.balance_usd)}</p>
        </div>
        <div className="rounded-xl bg-gray-50 px-4 py-3 text-right">
          <p className="text-xs text-gray-500">Disponible</p>
          <p className="text-lg font-bold text-gray-900">{formatUsd(client.available_usd)}</p>
        </div>
      </div>
      {history.isPending ? (
        <p className="text-center text-sm text-gray-500">Cargando…</p>
      ) : history.isError ? (
        <Alert tone="error">{toApiError(history.error).message}</Alert>
      ) : operations.length === 0 ? (
        <p className="text-center text-sm text-gray-500">Todavía no tiene operaciones.</p>
      ) : (
        <ul>
          {operations.map((operation) => (
            <Row key={operation.id} operation={operation} readOnly={readOnly} />
          ))}
        </ul>
      )}
      {history.hasNextPage && (
        <Button variant="secondary" loading={history.isFetchingNextPage} onClick={() => history.fetchNextPage()}>
          Ver más
        </Button>
      )}
    </Modal>
  )
}
