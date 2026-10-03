import { changeOperationDate, fetchClientOperations, toApiError, type AdminClient, type Operation } from '@multifambank/api-client'
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

function Row({ operation, readOnly }: { operation: Operation; readOnly: boolean }) {
  const [editingDate, setEditingDate] = useState(false)
  const { requested } = operation

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
        {operation.status === 'confirmed' && !readOnly && !editingDate && (
          <button type="button" onClick={() => setEditingDate(true)} className="hover:text-emerald-600">
            cambiar fecha
          </button>
        )}
      </div>
      {editingDate && <DateEditor operation={operation} onDone={() => setEditingDate(false)} />}
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
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
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
