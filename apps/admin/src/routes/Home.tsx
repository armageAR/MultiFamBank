import { fetchHealth } from '@multifambank/api-client'
import { ApiStatus, AppShell, Card } from '@multifambank/ui'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'

export function Home() {
  const health = useQuery({ queryKey: ['health'], queryFn: () => fetchHealth(api) })

  return (
    <AppShell title="Administración del banco" subtitle="Gestioná clientes, pedidos y reportes de tu banco.">
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
          <li>Invitar y gestionar clientes</li>
          <li>Revisar y confirmar pedidos</li>
          <li>Ajustar monto, origen y cotización</li>
          <li>Ver reportes mensuales</li>
          </ul>
        </Card>
      </div>
    </AppShell>
  )
}
