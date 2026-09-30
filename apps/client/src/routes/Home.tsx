import { fetchHealth } from '@multifambank/api-client'
import { ApiStatus, AppShell, Card } from '@multifambank/ui'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'

export function Home() {
  const health = useQuery({ queryKey: ['health'], queryFn: () => fetchHealth(api) })

  return (
    <AppShell title="Mi banco" subtitle="Tus ahorros y pedidos de dinero en cada banco familiar.">
      <div className="space-y-4">
        <Card title="Estado">
          <ApiStatus
            isLoading={health.isLoading}
            isError={health.isError}
            database={health.data?.database}
          />
        </Card>
        <Card title="Próximamente">
          <ul className="list-disc space-y-1 pl-5 text-slate-700">
          <li>Ver tus ahorros en USD</li>
          <li>Pedir depósitos y retiros</li>
          <li>Pedir dinero del banco para gastos</li>
          <li>Preparar pedidos sin conexión</li>
          </ul>
        </Card>
      </div>
    </AppShell>
  )
}
