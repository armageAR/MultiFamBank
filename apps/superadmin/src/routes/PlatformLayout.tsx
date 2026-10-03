import { AppShell, AuthLayout, Button } from '@multifambank/ui'
import { NavLink, Navigate, Outlet } from 'react-router'
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
      subtitle="Bancos, administradores y solicitudes de acceso"
      actions={
        <>
          <span className="text-brand-100">{user.email}</span>
          <Button variant="ghost" className="px-0 text-white" onClick={signOut}>
            Salir
          </Button>
        </>
      }
    >
      <nav className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Secciones">
        {[
          { to: '/', label: 'Bancos', end: true },
          { to: '/solicitudes', label: 'Solicitudes de acceso', end: false },
        ].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${isActive ? 'bg-brand-700 text-white' : 'text-slate-600 hover:text-slate-900'}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </AppShell>
  )
}
