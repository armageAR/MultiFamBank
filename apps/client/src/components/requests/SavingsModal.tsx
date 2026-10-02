import type { ExchangeRates } from '@multifambank/api-client'
import { Alert, Button, formatArs, formatNumber, formatUsd, Modal, parseAmount, TextField } from '@multifambank/ui'
import { useState, type FormEvent } from 'react'
import { useRequestSubmit, type RequestDraft } from './useRequestSubmit'

type Kind = 'deposit' | 'withdrawal'
type Currency = 'ars' | 'usd'

const kinds = {
  deposit: {
    title: 'Depositar',
    type: 'savings_deposit',
    rateLabel: 'blue venta',
    rateHint: 'lo que pagás por dólar',
    accent: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    toggleOn: 'bg-emerald-600 text-white',
    button: 'primary',
    submit: 'Pedir depósito',
  },
  withdrawal: {
    title: 'Retirar',
    type: 'savings_withdrawal',
    rateLabel: 'blue compra',
    rateHint: 'lo que te pago por dólar',
    accent: 'border-red-200 bg-red-50 text-red-700',
    toggleOn: 'bg-red-600 text-white',
    button: 'danger',
    submit: 'Pedir retiro',
  },
} as const

interface Props {
  kind: Kind
  bankId: number
  bankName: string
  availableUsd: string
  rates?: ExchangeRates
  ratesUpdatedAt: number
  online: boolean
  enqueue: (id: string, payload: Omit<RequestDraft, 'exchange_rate'>) => Promise<void>
  onRateChanged: () => void
  onClose: () => void
  onQueued: () => void
}

const timeFormat = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** Deposit (green) and withdrawal (red): amount in pesos or dollars at the quote on screen. */
export function SavingsModal({ kind, bankId, bankName, availableUsd, rates, ratesUpdatedAt, online, enqueue, onRateChanged, onClose, onQueued }: Props) {
  const config = kinds[kind]
  const [currency, setCurrency] = useState<Currency>('ars')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const { submit, error, setError, submitting } = useRequestSubmit({ bankId, online, enqueue, onSent: onClose, onQueued, onRateChanged })

  const rate = rates ? (kind === 'deposit' ? rates.blue.sell : rates.blue.buy) : null
  const parsed = parseAmount(amount)
  const value = parsed ? Number(parsed) : null
  // Pesos are what is recorded; dollars entered are converted at the quote on screen.
  const ars = value !== null && rate ? (currency === 'ars' ? value : Math.round(value * Number(rate) * 100) / 100) : null
  const usd = value !== null && rate ? (currency === 'usd' ? value : value / Number(rate)) : null
  const overAvailable = kind === 'withdrawal' && usd !== null && usd > Number(availableUsd)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!rate) return setError({ message: 'No hay cotización disponible. Probá de nuevo en un momento.', fields: {} })
    if (ars === null || ars <= 0) return setError({ message: 'Ingresá un monto válido.', fields: { amount: 'Ingresá un monto válido.' } })
    if (overAvailable) return setError({ message: `No te alcanza: tenés disponibles ${formatUsd(availableUsd)}.`, fields: { amount: `Tenés disponibles ${formatUsd(availableUsd)}.` } })
    await submit({ type: config.type, amount_ars: ars.toFixed(2), description: description.trim() || null, exchange_rate: rate })
  }

  return (
    <Modal title={`${config.title} · ${bankName}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
        <div className={`rounded-xl border px-4 py-3 ${config.accent}`}>
          {rate ? (
            <>
              <p className="text-xs">
                Cotización {config.rateLabel} · {config.rateHint}
              </p>
              <p className="text-2xl font-bold">$ {formatNumber(rate, 2)}</p>
              <p className="text-xs">
                {online
                  ? `Se usa esta cotización y queda grabada en el pedido. Actualizada a las ${timeFormat.format(new Date(ratesUpdatedAt))}.`
                  : 'Sin conexión: es la última conocida. La cotización definitiva se fija cuando el pedido se envíe.'}
              </p>
            </>
          ) : (
            <p className="text-sm">Obteniendo la cotización…</p>
          )}
        </div>

        {kind === 'withdrawal' && <p className="text-xs text-gray-500">Disponible: {formatUsd(availableUsd)}</p>}

        <div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1" role="group" aria-label="Moneda del monto">
          {(['ars', 'usd'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={currency === option}
              onClick={() => {
                setCurrency(option)
                setAmount('')
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${currency === option ? config.toggleOn : 'text-gray-500 hover:text-gray-900'}`}
            >
              {option === 'ars' ? 'En pesos' : 'En dólares'}
            </button>
          ))}
        </div>

        <TextField
          label={currency === 'ars' ? 'Monto en pesos' : 'Monto en dólares'}
          inputMode="decimal"
          placeholder={currency === 'ars' ? 'Ej: 15000' : 'Ej: 10'}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={error?.fields.amount}
        />

        {ars !== null && usd !== null && (
          <p className={`rounded-xl px-4 py-3 text-sm ${overAvailable ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'}`} aria-live="polite">
            {currency === 'ars' ? (
              <>
                Equivale a <strong>{formatUsd(usd)}</strong>
              </>
            ) : (
              <>
                Equivale a <strong>{formatArs(ars)}</strong>
              </>
            )}
            {overAvailable && ' · más de lo que tenés disponible'}
          </p>
        )}

        <TextField label="Comentario" placeholder="Opcional" maxLength={255} value={description} onChange={(e) => setDescription(e.target.value)} />

        {error && !error.fields.amount && <Alert tone="error">{error.message}</Alert>}

        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant={config.button} className="flex-1" loading={submitting} disabled={!rate || overAvailable}>
            {online ? config.submit : 'Guardar para enviar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
