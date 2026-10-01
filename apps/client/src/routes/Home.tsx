import { fetchHealth } from '@multifambank/api-client'
import { ApiStatus, Card, FamilyShell } from '@multifambank/ui'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api } from '../api'

export function Home() {
  const health = useQuery({ queryKey: ['health'], queryFn: () => fetchHealth(api) })

  return (
    <FamilyShell
      eyebrow="MultiFamBank"
      name="Mi banco"
      actions={
        <Link
          to="/ingresar"
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-700"
        >
          Ingresar
        </Link>
      }
    >
      <Card title="Estado">
        <ApiStatus isLoading={health.isLoading} isError={health.isError} database={health.data?.database} />
      </Card>
      <Card title="Próximamente">
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li>Ver tus ahorros en USD</li>
          <li>Pedir depósitos y retiros</li>
          <li>Pedir dinero del banco para gastos</li>
          <li>Preparar pedidos sin conexión</li>
        </ul>
      </Card>
    </FamilyShell>
  )
}
