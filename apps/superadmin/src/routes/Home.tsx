import { fetchHealth } from '@multifambank/api-client'
import { ApiStatus, AppShell, Card } from '@multifambank/ui'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'

export function Home() {
  const health = useQuery({ queryKey: ['health'], queryFn: () => fetchHealth(api) })

  return (
    <AppShell title="Plataforma" subtitle="Administración de bancos y sus administradores.">
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
          <li>Crear bancos e invitar administradores</li>
          <li>Reenviar invitaciones y resetear contraseñas</li>
          <li>Pausar y desactivar bancos</li>
          </ul>
        </Card>
      </div>
    </AppShell>
  )
}
