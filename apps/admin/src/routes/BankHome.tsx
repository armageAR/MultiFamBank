import { useAuth } from '@multifambank/auth'
import { AppShell, AuthLayout, BankStatusBadge, Button, Card } from '@multifambank/ui'
import { Link, Navigate } from 'react-router'

export function BankHome() {
  const { user, isLoading, signOut } = useAuth()

  if (isLoading) return <p className="p-6 text-center text-slate-500">Cargando…</p>
  if (!user) return <Navigate to="/ingresar" replace />

  const bank = user.administered_bank

  if (!bank) {
    return (
      <AuthLayout appName="Administración" title="Sin banco">
        <p className="text-slate-700">Tu cuenta ({user.email}) no administra ningún banco.</p>
        <Button className="mt-4 w-full" variant="secondary" onClick={signOut}>
          Salir
        </Button>
      </AuthLayout>
    )
  }

  if (bank.status === 'pending_configuration') return <Navigate to="/configurar-banco" replace />

  return (
    <AppShell
      title={bank.name ?? 'Tu banco'}
      subtitle="Administración del banco"
      actions={
        <>
          <span className="text-brand-100">{user.email}</span>
          <Button variant="ghost" className="px-0 text-white" onClick={signOut}>
            Salir
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Card title="Estado">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <BankStatusBadge status={bank.status} />
            <Link to="/configurar-banco" className="text-sm text-brand-700 hover:underline">
              Editar datos del banco
            </Link>
          </div>
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
