import { fetchPendingOperations, toApiError, type Operation } from '@multifambank/api-client'
import { AccountModal, PushControls, useAuth, useOnline } from '@multifambank/auth'
import { Alert, AuthLayout, Button, FamilyShell, HeaderMenu, Modal, type HeaderMenuItem } from '@multifambank/ui'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { api } from '../api'
import { ClientsTab } from '../components/ClientsTab'
import { DashboardTab } from '../components/DashboardTab'
import { PendingCard } from '../components/PendingCard'
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
  const [profile, setProfile] = useState(false)
  const [confirmingExit, setConfirmingExit] = useState(false)
  const navigate = useNavigate()
  const bank = user?.administered_bank
  const pending = useQuery({ queryKey: keys.pending, queryFn: () => fetchPendingOperations(api), enabled: Boolean(bank), refetchInterval: 60_000 })

  // A push notification opens "/?pedido=<id>": that request is reviewed directly.
  const linkedId = params.get('pedido')
  const linked = linkedId ? pending.data?.find((operation) => operation.id === linkedId) : undefined
  const current = reviewing ?? linked ?? null

  function closeReview() {
    setReviewing(null)
    if (linkedId) {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('pedido')
          return next
        },
        { replace: true },
      )
    }
  }

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
  const menu: HeaderMenuItem[] = [
    { label: 'Perfil', onSelect: () => setProfile(true) },
    ...(readOnly ? [] : [{ label: 'Editar datos del banco', onSelect: () => navigate('/configurar-banco') }]),
    { label: 'Salir', onSelect: () => setConfirmingExit(true), tone: 'danger' as const },
  ]

  return (
    <FamilyShell
      eyebrow={bank.name ?? 'Tu banco'}
      name={user.name}
      badge="Admin"
      actions={
        <>
          <PushControls api={api} />
          <HeaderMenu items={menu} />
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

      {current && !readOnly && <ReviewModal operation={current} onClose={closeReview} />}
      {profile && (
        <AccountModal
          api={api}
          user={user}
          title="Perfil"
          nameNote="El nombre lo administra el administrador de la plataforma."
          savedMessage="Datos actualizados. Se cerraron las sesiones en otros dispositivos."
          onClose={() => setProfile(false)}
        />
      )}
      {confirmingExit && (
        <Modal title="Salir" onClose={() => setConfirmingExit(false)}>
          <p className="text-sm text-gray-700">¿Querés cerrar la sesión en este dispositivo?</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmingExit(false)}>
              Cancelar
            </Button>
            <Button variant="danger" className="flex-1" onClick={() => void signOut()}>
              Salir
            </Button>
          </div>
        </Modal>
      )}
    </FamilyShell>
  )
}
