import {
  listPlatformBanks,
  resendAdminInvitation,
  toApiError,
  type BankStatus,
  type CreateBankResponse,
  type PlatformBank,
} from '@multifambank/api-client'
import { Alert, BankStatusBadge, bankStatusLabels, Button, Card, formatCountdown, useCountdown } from '@multifambank/ui'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api } from '../api'
import { BankDetailModal } from '../components/BankDetailModal'
import { InvitationResult } from '../components/InvitationResult'
import { formatDate } from '../format'

const statusOrder: BankStatus[] = ['pending_configuration', 'active', 'paused', 'deactivated']

export function Banks() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('estado') as BankStatus | null) ?? undefined
  const search = params.get('buscar') ?? ''
  const page = Number(params.get('pagina') ?? '1')
  const openBankId = Number(params.get('banco')) || null
  const [searchInput, setSearchInput] = useState(search)

  // Debounce the search box into the URL.
  useEffect(() => {
    if (searchInput === search) return
    const id = setTimeout(() => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (searchInput) next.set('buscar', searchInput)
          else next.delete('buscar')
          next.delete('pagina')
          return next
        },
        { replace: true },
      )
    }, 300)
    return () => clearTimeout(id)
  }, [searchInput, search, setParams])

  function updateParams(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
  }

  const banks = useQuery({
    queryKey: ['platform-banks', { status, search, page }],
    queryFn: () => listPlatformBanks(api, { status, search: search || undefined, page }),
    placeholderData: keepPreviousData,
  })

  const queryClient = useQueryClient()
  const [resent, setResent] = useState<CreateBankResponse | null>(null)
  const resend = useMutation({
    mutationFn: (bank: PlatformBank) => resendAdminInvitation(api, bank.id),
    onSuccess: (result) => {
      setResent(result)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return queryClient.invalidateQueries({ queryKey: ['platform-banks'] })
    },
  })
  const actions: RowActions = {
    onView: (bank) => updateParams({ banco: String(bank.id) }),
    onResend: (bank) => {
      setResent(null)
      resend.mutate(bank)
    },
    resendingId: resend.isPending ? resend.variables?.id : undefined,
  }

  const counts = banks.data?.counts
  const total = counts ? Object.values(counts).reduce((sum, n) => sum + n, 0) : undefined

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Bancos</h2>
        <Link
          to="/bancos/nuevo"
          className="inline-flex items-center rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
        >
          Nuevo banco
        </Link>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
        <FilterChip active={!status} onClick={() => updateParams({ estado: null, pagina: null })} label="Todos" count={total} />
        {statusOrder.map((value) => (
          <FilterChip
            key={value}
            active={status === value}
            onClick={() => updateParams({ estado: value, pagina: null })}
            label={bankStatusLabels[value]}
            count={counts?.[value]}
          />
        ))}
      </div>

      <input
        type="search"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Buscar por nombre del banco o email del administrador"
        aria-label="Buscar bancos"
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-brand-600"
      />

      {resent && (
        <Card>
          <div className="space-y-3">
            <InvitationResult result={resent} title="Invitación reenviada" />
            <p className="text-xs text-slate-500">Los links anteriores de este banco ya no funcionan.</p>
            <Button variant="secondary" onClick={() => setResent(null)}>
              Cerrar
            </Button>
          </div>
        </Card>
      )}
      {resend.isError && <Alert tone="error">{toApiError(resend.error).message}</Alert>}
      {banks.isError && <Alert tone="error">{toApiError(banks.error).message}</Alert>}

      {banks.isPending ? (
        <p className="py-8 text-center text-slate-500">Cargando bancos…</p>
      ) : banks.data && banks.data.data.length === 0 ? (
        <Card>
          <p className="text-center text-slate-600">
            {status || search ? 'No hay bancos que coincidan con el filtro.' : 'Todavía no hay bancos. Creá el primero con “Nuevo banco”.'}
          </p>
        </Card>
      ) : (
        banks.data && (
          <>
            <BankTable banks={banks.data.data} actions={actions} />
            <BankCards banks={banks.data.data} actions={actions} />
            {banks.data.meta.last_page > 1 && (
              <nav className="flex items-center justify-between text-sm" aria-label="Paginación">
                <Button variant="secondary" disabled={page <= 1} onClick={() => updateParams({ pagina: String(page - 1) })}>
                  Anterior
                </Button>
                <span className="text-slate-600">
                  Página {banks.data.meta.current_page} de {banks.data.meta.last_page}
                </span>
                <Button
                  variant="secondary"
                  disabled={page >= banks.data.meta.last_page}
                  onClick={() => updateParams({ pagina: String(page + 1) })}
                >
                  Siguiente
                </Button>
              </nav>
            )}
          </>
        )
      )}

      {openBankId && <BankDetailModal key={openBankId} bankId={openBankId} onClose={() => updateParams({ banco: null })} />}
    </div>
  )
}

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-sm ${active ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}
    >
      {label}
      {count !== undefined && <span className={active ? 'ml-1 text-brand-100' : 'ml-1 text-slate-500'}>({count})</span>}
    </button>
  )
}

function BankName({ bank }: { bank: PlatformBank }) {
  return bank.name ? <span className="font-medium">{bank.name}</span> : <span className="text-slate-500 italic">Sin configurar</span>
}

function InvitationSummary({ bank }: { bank: PlatformBank }) {
  const invitation = bank.invitation
  if (!invitation) return <span className="text-slate-500">—</span>

  switch (invitation.state) {
    case 'accepted':
      return <span className="text-emerald-800">Aceptada el {formatDate(invitation.accepted_at)}</span>
    case 'expired':
      return <span className="text-red-700">Vencida el {formatDate(invitation.expires_at)}</span>
    case 'revoked':
      return <span className="text-slate-600">Revocada</span>
    default:
      return (
        <span className="text-amber-800">
          Pendiente · vence {formatDate(invitation.expires_at)}
          {invitation.last_sent_at === null && <span className="block text-xs text-red-700">El email no se pudo enviar</span>}
        </span>
      )
  }
}

interface RowActions {
  onView: (bank: PlatformBank) => void
  onResend: (bank: PlatformBank) => void
  resendingId?: number
}

function ViewButton({ bank, actions }: { bank: PlatformBank; actions: RowActions }) {
  return (
    <button
      type="button"
      onClick={() => actions.onView(bank)}
      aria-label={`Ver ${bank.name ?? `banco de ${bank.admin.email}`}`}
      title="Ver banco"
      className="rounded-lg p-1.5 text-brand-700 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-600"
    >
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
  )
}

/** The invitation can be reissued until someone accepts it, unless the bank was deactivated. */
function ResendButton({ bank, actions }: { bank: PlatformBank; actions: RowActions }) {
  // At most one email every 5 minutes to the same administrator (the server enforces it too).
  const wait = useCountdown(bank.invitation?.resend_available_at)
  if (bank.admin.accepted || bank.status === 'deactivated') return null

  return (
    <Button
      variant="secondary"
      className="mt-2 px-3 py-1 text-xs"
      loading={actions.resendingId === bank.id}
      disabled={actions.resendingId !== undefined || wait > 0}
      title={wait > 0 ? 'Para no mandar muchos emails seguidos, se puede reenviar cada 5 minutos.' : undefined}
      onClick={() => actions.onResend(bank)}
    >
      {wait > 0 ? `Reenviar en ${formatCountdown(wait)}` : 'Reenviar invitación'}
    </Button>
  )
}

function BankTable({ banks, actions }: { banks: PlatformBank[]; actions: RowActions }) {
  return (
    <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
          <tr>
            <th scope="col" className="w-0 py-3 pr-0 pl-3 font-medium">
              <span className="sr-only">Ver</span>
            </th>
            <th scope="col" className="px-4 py-3 font-medium">Banco</th>
            <th scope="col" className="px-4 py-3 font-medium">Administrador</th>
            <th scope="col" className="px-4 py-3 font-medium">Estado</th>
            <th scope="col" className="px-4 py-3 font-medium">Invitación</th>
            <th scope="col" className="px-4 py-3 font-medium">Creado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {banks.map((bank) => (
            <tr key={bank.id}>
              <td className="py-3 pr-0 pl-3">
                <ViewButton bank={bank} actions={actions} />
              </td>
              <td className="px-4 py-3">
                <BankName bank={bank} />
              </td>
              <td className="px-4 py-3">
                <span className="block">{bank.admin.name ?? '—'}</span>
                <span className="block text-slate-500">{bank.admin.email}</span>
              </td>
              <td className="px-4 py-3">
                <BankStatusBadge status={bank.status} />
              </td>
              <td className="px-4 py-3">
                <InvitationSummary bank={bank} />
                <ResendButton bank={bank} actions={actions} />
              </td>
              <td className="px-4 py-3 text-slate-600">{formatDate(bank.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BankCards({ banks, actions }: { banks: PlatformBank[]; actions: RowActions }) {
  return (
    <ul className="space-y-3 md:hidden">
      {banks.map((bank) => (
        <li key={bank.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1">
              <ViewButton bank={bank} actions={actions} />
              <BankName bank={bank} />
            </div>
            <BankStatusBadge status={bank.status} />
          </div>
          <p className="mt-2 text-sm">{bank.admin.name ?? '—'}</p>
          <p className="text-sm break-all text-slate-500">{bank.admin.email}</p>
          <div className="mt-2 text-sm">
            <InvitationSummary bank={bank} />
            <ResendButton bank={bank} actions={actions} />
          </div>
          <p className="mt-1 text-xs text-slate-500">Creado el {formatDate(bank.created_at)}</p>
        </li>
      ))}
    </ul>
  )
}
