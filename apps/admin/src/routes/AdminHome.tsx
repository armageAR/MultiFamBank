import { fetchPendingOperations, toApiError, type Operation } from '@multifambank/api-client'
import { useAuth, useOnline } from '@multifambank/auth'
import { Alert, AuthLayout, Button, FamilyShell, HeaderButton } from '@multifambank/ui'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { api } from '../api'
import { ClientsTab } from '../components/ClientsTab'
import { DashboardTab } from '../components/DashboardTab'
import { PendingCard } from '../components/PendingCard'
import { PushControls } from '../components/PushControls'
import { ReportTab } from '../components/ReportTab'
import { ReviewModal } from '../components/ReviewModal'
import { keys } from '../queries'

const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'reporte', label: 'Reporte' },
] as const
type Tab = (typeof tabs)[number]['id']

export function AdminHome() {
  const { user, isLoading, signOut } = useAuth()
  const online = useOnline()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab | null) ?? 'dashboard'
  const [reviewing, setReviewing] = useState<Operation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const bank = user?.administered_bank
  const pending = useQuery({ queryKey: keys.pending, queryFn: () => fetchPendingOperations(api), enabled: Boolean(bank), refetchInterval: 60_000 })

  // A push notification opens "/?pedido=<id>": review that request directly.
  const requested = params.get('pedido')
  useEffect(() => {
    if (!requested || !pending.data) return
    const match = pending.data.find((operation) => operation.id === requested)
    if (match) setReviewing(match)
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('pedido')
      return next
    }, { replace: true })
  }, [requested, pending.data, setParams])

  if (isLoading) return <p className="p-6 text-center text-sm text-gray-500">Cargando…</p>
  if (!user) return <Navigate to="/ingresar" replace />

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

  const paused = bank.status === 'paused'
  // Writes need the server: offline the app shows the last downloaded data only.
  const readOnly = paused || !online

  return (
    <FamilyShell
      eyebrow={bank.name ?? 'Tu banco'}
      name={user.name}
      badge="Admin"
      actions={
        <>
          <PushControls />
          <HeaderButton onClick={signOut}>Salir</HeaderButton>
        </>
      }
    >
      {!online && <Alert tone="warning">Sin conexión: estás viendo los últimos datos descargados. Para confirmar o editar hace falta internet.</Alert>}
      {paused && (
        <Alert tone="warning" title="Las operaciones del banco están pausadas">
          Podés ver la información del banco, pero no hacer cambios ni confirmar operaciones. Comunicate con el administrador de la plataforma.
        </Alert>
      )}
      {error && (
        <div onClick={() => setError(null)}>
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {pending.isError && <Alert tone="error">{toApiError(pending.error).message}</Alert>}
      {pending.data && pending.data.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs tracking-wide text-gray-500 uppercase">Pendientes de aprobación</h2>
            <span className="rounded-md border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">{pending.data.length}</span>
          </div>
          {pending.data.map((operation) => (
            <PendingCard key={operation.id} operation={operation} readOnly={readOnly} onReview={setReviewing} onError={setError} />
          ))}
        </section>
      )}

      <nav className="flex gap-1 rounded-xl border border-gray-100 bg-white p-1 shadow-sm" aria-label="Secciones">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setParams({ tab: id }, { replace: true })}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${tab === id ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:text-gray-900'}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'clientes' && <ClientsTab readOnly={readOnly} />}
      {tab === 'reporte' && <ReportTab />}

      {!paused && (
        <p className="text-center">
          <Link to="/configurar-banco" className="text-xs text-gray-500 transition-colors hover:text-emerald-600">
            editar datos del banco
          </Link>
        </p>
      )}

      {reviewing && <ReviewModal operation={reviewing} onClose={() => setReviewing(null)} />}
    </FamilyShell>
  )
}
