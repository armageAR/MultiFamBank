import { Alert, Button, Modal, parseAmount, TextField } from '@multifambank/ui'
import { useState, type FormEvent } from 'react'
import { useRequestSubmit, type RequestDraft } from './useRequestSubmit'

interface Props {
  bankId: number
  bankName: string
  online: boolean
  enqueue: (id: string, payload: Omit<RequestDraft, 'exchange_rate'>) => Promise<void>
  onClose: () => void
  onQueued: () => void
}

/** Money from the bank for an expense: pesos only, and the client must say what it is for. */
export function ExpenseModal({ bankId, bankName, online, enqueue, onClose, onQueued }: Props) {
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const { submit, error, setError, submitting } = useRequestSubmit({ bankId, online, enqueue, onSent: onClose, onQueued, onRateChanged: () => {} })

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseAmount(amount)
    if (!parsed) return setError({ message: 'Ingresá un monto válido.', fields: { amount_ars: 'Ingresá un monto válido.' } })
    if (!description.trim()) return setError({ message: 'Contá para qué es la plata.', fields: { description: 'Contá para qué es la plata.' } })
    await submit({ type: 'expense', amount_ars: parsed, description: description.trim() })
  }

  return (
    <Modal title={`Pedir para un gasto · ${bankName}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Es dinero del banco, no de tus ahorros. El administrador decide si lo aprueba.
        </p>
        <TextField label="Monto en pesos" inputMode="decimal" placeholder="Ej: 15000" value={amount} onChange={(e) => setAmount(e.target.value)} error={error?.fields.amount_ars} inputClassName="text-right" />
        <TextField
          label="¿Para qué es? (obligatorio)"
          placeholder="Ej: salida con amigos"
          maxLength={255}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={error?.fields.description}
        />
        {!online && <Alert tone="warning">Sin conexión: el pedido queda guardado en este dispositivo y se envía solo cuando vuelvas a tener internet.</Alert>}
        {error && !error.fields.amount_ars && !error.fields.description && <Alert tone="error">{error.message}</Alert>}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="warning" className="flex-1" loading={submitting}>
            {online ? 'Pedir dinero' : 'Guardar para enviar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
