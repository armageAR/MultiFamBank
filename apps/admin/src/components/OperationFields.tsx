import type { ExchangeRates, OperationType } from '@multifambank/api-client'
import { suggestedRate, type OperationDraft } from '../operationDraft'
import { operationLabels, SelectField, TextField } from '@multifambank/ui'

interface Props {
  draft: OperationDraft
  onChange: (draft: OperationDraft) => void
  errors: Record<string, string>
  rates?: ExchangeRates
  disabled?: boolean
  dateHint?: string
}

export function OperationFields({ draft, onChange, errors, rates, disabled, dateHint }: Props) {
  const set = (changes: Partial<OperationDraft>) => onChange({ ...draft, ...changes })
  const isExpense = draft.type === 'expense'

  return (
    <>
      <SelectField
        label="Tipo"
        value={draft.type}
        disabled={disabled}
        error={errors.type}
        onChange={(e) => {
          const type = e.target.value as OperationType
          // Moving into a savings type starts from today's quote when there was none.
          set({ type, rate: type === 'expense' ? '' : draft.rate || suggestedRate(type, rates) })
        }}
      >
        {(Object.keys(operationLabels) as OperationType[]).map((type) => (
          <option key={type} value={type}>
            {operationLabels[type].admin} · {operationLabels[type].source.admin}
          </option>
        ))}
      </SelectField>
      <TextField
        label="Monto en pesos"
        inputMode="decimal"
        placeholder="Ej: 15000"
        value={draft.amount}
        disabled={disabled}
        error={errors.amount_ars}
        onChange={(e) => set({ amount: e.target.value })}
      />
      <TextField
        label={isExpense ? 'Comentario (obligatorio)' : 'Comentario'}
        placeholder={isExpense ? 'Para qué es la plata' : 'Opcional'}
        maxLength={255}
        value={draft.description}
        disabled={disabled}
        error={errors.description}
        onChange={(e) => set({ description: e.target.value })}
      />
      {!isExpense && (
        <TextField
          label="Cotización (ARS por USD)"
          inputMode="decimal"
          value={draft.rate}
          disabled={disabled}
          error={errors.exchange_rate}
          hint={rates ? `Blue compra $ ${rates.blue.buy} · venta $ ${rates.blue.sell}` : undefined}
          onChange={(e) => set({ rate: e.target.value })}
        />
      )}
      <TextField
        label="Fecha de la operación"
        type="datetime-local"
        value={draft.occurredAt}
        disabled={disabled}
        error={errors.occurred_at}
        hint={dateHint}
        onChange={(e) => set({ occurredAt: e.target.value })}
      />
    </>
  )
}
