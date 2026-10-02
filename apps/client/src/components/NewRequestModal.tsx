import { requestOperation, toApiError, type ApiError, type ExchangeRates, type OperationType } from '@multifambank/api-client'
import { Alert, Button, formatNumber, formatUsd, Modal, operationLabels, parseAmount, TextField } from '@multifambank/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { api } from '../api'

const choices: { type: OperationType; title: string; detail: string }[] = [
  { type: 'savings_deposit', title: 'Depositar', detail: 'Poner plata en mis ahorros' },
  { type: 'savings_withdrawal', title: 'Retirar', detail: 'Sacar plata de mis ahorros' },
  { type: 'expense', title: 'Pedir para un gasto', detail: 'Dinero del banco, no de mis ahorros' },
]

interface Props {
  bankId: number
  bankName: string
  rates?: ExchangeRates
  online: boolean
  /** Saves the request on this device to send it when there is a connection. */
  enqueue: (id: string, payload: { type: OperationType; amount_ars: string; description: string | null }) => Promise<void>
  onClose: () => void
  onQueued: () => void
}

export function NewRequestModal({ bankId, bankName, rates, online, enqueue, onClose, onQueued }: Props) {
  const queryClient = useQueryClient()
  const [type, setType] = useState<OperationType>('savings_deposit')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(false)
  // The id belongs to one request content: retrying the same request after a network error reuses
  // it (the server answers with the request it already has); changing type or amount gets a new one.
  const attempt = useRef<{ content: string; id: string } | null>(null)
  const isExpense = type === 'expense'
  // An estimate only: the server quotes again when the request is saved (as in FamBank).
  const rate = isExpense || !rates ? null : type === 'savings_deposit' ? rates.blue.sell : rates.blue.buy
  const parsedAmount = parseAmount(amount)
  const estimate = rate && parsedAmount ? Number(parsedAmount) / Number(rate) : null

  async function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseAmount(amount)
    if (!parsed) return setError({ message: 'Ingresá un monto válido.', fields: { amount_ars: 'Ingresá un monto válido.' } })
    if (isExpense && !description.trim()) {
      return setError({ message: 'Contá para qué es la plata.', fields: { description: 'Contá para qué es la plata.' } })
    }

    const content = `${type}|${parsed}|${description.trim()}`
    if (attempt.current?.content !== content) attempt.current = { content, id: crypto.randomUUID() }
    const payload = { type, amount_ars: parsed, description: description.trim() || null }

    setLoading(true)
    setError(null)
    try {
      if (!online) {
        await enqueue(attempt.current.id, payload)
        onQueued()
        return
      }
      await requestOperation(api, bankId, { id: attempt.current.id, ...payload })
      await queryClient.invalidateQueries({ queryKey: ['client'] })
      onClose()
    } catch (err) {
      const failure = toApiError(err)
      if (failure.status === undefined) {
        // The connection dropped: keep it on the device and send it later with the same id.
        await enqueue(attempt.current.id, payload)
        onQueued()
        return
      }
      setError(failure)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title={`Nuevo pedido · ${bankName}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <div className="grid gap-2" role="radiogroup" aria-label="Qué querés hacer">
          {choices.map((choice) => (
            <button
              key={choice.type}
              type="button"
              role="radio"
              aria-checked={type === choice.type}
              onClick={() => setType(choice.type)}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${type === choice.type ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
            >
              <p className="text-sm font-semibold text-gray-900">{choice.title}</p>
              <p className="text-xs text-gray-500">
                {choice.detail} · {operationLabels[choice.type].source.client}
              </p>
            </button>
          ))}
        </div>
        {error && !error.fields.amount_ars && !error.fields.description && <Alert tone="error">{error.message}</Alert>}
        <TextField label="Monto en pesos" inputMode="decimal" placeholder="Ej: 15000" value={amount} onChange={(e) => setAmount(e.target.value)} error={error?.fields.amount_ars} />
        <TextField
          label={isExpense ? '¿Para qué es? (obligatorio)' : 'Comentario'}
          placeholder={isExpense ? 'Ej: salida con amigos' : 'Opcional'}
          maxLength={255}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={error?.fields.description}
        />
        {!online && (
          <Alert tone="warning">Sin conexión: el pedido queda guardado en este dispositivo y se envía solo cuando vuelvas a tener internet.</Alert>
        )}
        {!isExpense && (
          <p className="rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-600">
            {estimate !== null && rate
              ? `≈ ${formatUsd(estimate)} a $ ${formatNumber(rate, 0)} (blue ${type === 'savings_deposit' ? 'venta' : 'compra'}). `
              : ''}
            La cotización definitiva se obtiene al grabar el pedido y el administrador la confirma.
          </p>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" loading={loading}>
            {online ? 'Enviar pedido' : 'Guardar para enviar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
