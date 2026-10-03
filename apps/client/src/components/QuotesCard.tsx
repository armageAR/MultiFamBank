import { toApiError, type ExchangeRates } from '@multifambank/api-client'
import { Card, formatArs } from '@multifambank/ui'
import type { UseQueryResult } from '@tanstack/react-query'

/** FamBank's quotes card, explained from the client's side. */
export function QuotesCard({ rates }: { rates: UseQueryResult<ExchangeRates> }) {
  return (
    <Card title="Dólar blue">
      {rates.isPending ? (
        <p className="text-xs text-gray-500">Obteniendo cotización…</p>
      ) : rates.isError && !rates.data ? (
        <p className="text-xs text-red-600">No se pudo obtener la cotización. {toApiError(rates.error).message}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
            <div className="rounded-xl bg-gray-50 px-4 py-3">
              <p className="text-right text-xs text-gray-500">Compra</p>
              <p className="text-right text-xl font-bold whitespace-nowrap text-gray-900">{formatArs(rates.data.blue.buy)}</p>
              <p className="mt-1 text-right text-xs text-gray-500">Lo que te pago por dólar</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-3">
              <p className="text-right text-xs text-gray-500">Venta</p>
              <p className="text-right text-xl font-bold whitespace-nowrap text-gray-900">{formatArs(rates.data.blue.sell)}</p>
              <p className="mt-1 text-right text-xs text-gray-500">Lo que pagás por dólar</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <span>Fuente: Bluelytics · actualiza cada 5 min</span>
            <button type="button" onClick={() => rates.refetch()} disabled={rates.isFetching} className="hover:text-emerald-600 disabled:opacity-50">
              {rates.isFetching ? 'actualizando…' : 'actualizar'}
            </button>
          </div>
        </>
      )}
    </Card>
  )
}
