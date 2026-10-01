import { useAuth } from '@multifambank/auth'
import { Alert, AuthLayout, BankStatusBadge, Button, Card, FamilyShell, HeaderButton } from '@multifambank/ui'
import { Link, Navigate } from 'react-router'

export function BankHome() {
  const { user, isLoading, signOut } = useAuth()

  if (isLoading) return <p className="p-6 text-center text-sm text-gray-400">Cargando…</p>
  if (!user) return <Navigate to="/ingresar" replace />

  const bank = user.administered_bank

  if (!bank) {
    return (
      <AuthLayout appName="Administración" title="Sin banco">
        <p className="text-sm text-gray-700">Tu cuenta ({user.email}) no administra ningún banco.</p>
        <Button className="w-full" variant="secondary" onClick={signOut}>
          Salir
        </Button>
      </AuthLayout>
    )
  }

  if (bank.status === 'pending_configuration') return <Navigate to="/configurar-banco" replace />

  return (
    <FamilyShell
      eyebrow={bank.name ?? 'Tu banco'}
      name={user.name}
      badge="Admin"
      actions={<HeaderButton onClick={signOut}>Salir</HeaderButton>}
    >
      {bank.status === 'paused' && (
        <Alert tone="warning" title="Las operaciones del banco están pausadas">
          Podés ver la información del banco, pero no hacer cambios ni confirmar operaciones. Comunicate con el administrador de la
          plataforma.
        </Alert>
      )}
      <Card title="Tu banco">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xl font-bold text-gray-900">{bank.name}</p>
            <div className="mt-1">
              <BankStatusBadge status={bank.status} />
            </div>
          </div>
          {bank.status === 'active' && (
            <Link to="/configurar-banco" className="text-xs text-gray-400 transition-colors hover:text-emerald-600">
              editar datos
            </Link>
          )}
        </div>
      </Card>
      <Card title="Próximamente">
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li>Invitar y gestionar clientes</li>
          <li>Dashboard con saldos y cotizaciones</li>
          <li>Confirmar pedidos de depósito, retiro y gastos</li>
          <li>Reporte mensual de gastos</li>
        </ul>
      </Card>
    </FamilyShell>
  )
}
