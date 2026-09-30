import { AppShell, AuthLayout, Button } from '@multifambank/ui'
import { Navigate, Outlet } from 'react-router'
import { useAuth } from '@multifambank/auth'

/** Signed-in area: only the platform superadmin gets past this layout. */
export function PlatformLayout() {
  const { user, isLoading, signOut } = useAuth()

  if (isLoading) {
    return <p className="p-6 text-center text-slate-500">Cargando…</p>
  }

  if (!user) return <Navigate to="/ingresar" replace />

  if (!user.is_superadmin) {
    return (
      <AuthLayout appName="Plataforma" title="Sin acceso">
        <p className="text-slate-700">Tu cuenta ({user.email}) no es la del administrador de la plataforma.</p>
        <Button className="mt-4 w-full" variant="secondary" onClick={signOut}>
          Salir
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AppShell
      title="Plataforma"
      subtitle="Bancos y sus administradores"
      actions={
        <>
          <span className="text-brand-100">{user.email}</span>
          <Button variant="ghost" className="px-0 text-white" onClick={signOut}>
            Salir
          </Button>
        </>
      }
    >
      <Outlet />
    </AppShell>
  )
}
