import { requestOperation, toApiError, type ApiError, type OperationType } from '@multifambank/api-client'
import { Alert, Button, Modal, operationLabels, parseAmount, TextField } from '@multifambank/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { api } from './api'

const choices: { type: OperationType; title: string; detail: string }[] = [
  { type: 'savings_deposit', title: 'Depositar', detail: 'Poner plata en mis ahorros' },
  { type: 'savings_withdrawal', title: 'Retirar', detail: 'Sacar plata de mis ahorros' },
  { type: 'expense', title: 'Pedir para un gasto', detail: 'Dinero del banco, no de mis ahorros' },
]

export function NewRequestModal({ bankId, onClose }: { bankId: number; onClose: () => void }) {
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

  async function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseAmount(amount)
    if (!parsed) return setError({ message: 'Ingresá un monto válido.', fields: { amount_ars: 'Ingresá un monto válido.' } })
    if (isExpense && !description.trim()) {
      return setError({ message: 'Contá para qué es la plata.', fields: { description: 'Contá para qué es la plata.' } })
    }

    const content = `${type}|${parsed}`
    if (attempt.current?.content !== content) attempt.current = { content, id: crypto.randomUUID() }

    setLoading(true)
    setError(null)
    try {
      await requestOperation(api, bankId, { id: attempt.current.id, type, amount_ars: parsed, description: description.trim() || null })
      await queryClient.invalidateQueries({ queryKey: ['client'] })
      onClose()
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Nuevo pedido" onClose={onClose}>
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
        {!isExpense && <p className="text-xs text-gray-500">Se convierte a dólares con la cotización del momento; el administrador la confirma.</p>}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" loading={loading}>
            Enviar pedido
          </Button>
        </div>
      </form>
    </Modal>
  )
}
