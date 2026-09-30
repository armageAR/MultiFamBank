import { listPlatformBanks, toApiError, type BankStatus, type PlatformBank } from '@multifambank/api-client'
import { Alert, BankStatusBadge, bankStatusLabels, Button, Card } from '@multifambank/ui'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api } from '../api'
import { formatDate } from '../format'

const statusOrder: BankStatus[] = ['pending_configuration', 'active', 'paused', 'deactivated']

export function Banks() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('estado') as BankStatus | null) ?? undefined
  const search = params.get('buscar') ?? ''
  const page = Number(params.get('pagina') ?? '1')
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
            <BankTable banks={banks.data.data} />
            <BankCards banks={banks.data.data} />
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

function BankTable({ banks }: { banks: PlatformBank[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
          <tr>
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
              </td>
              <td className="px-4 py-3 text-slate-600">{formatDate(bank.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BankCards({ banks }: { banks: PlatformBank[] }) {
  return (
    <ul className="space-y-3 md:hidden">
      {banks.map((bank) => (
        <li key={bank.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <BankName bank={bank} />
            <BankStatusBadge status={bank.status} />
          </div>
          <p className="mt-2 text-sm">{bank.admin.name ?? '—'}</p>
          <p className="text-sm break-all text-slate-500">{bank.admin.email}</p>
          <p className="mt-2 text-sm">
            <InvitationSummary bank={bank} />
          </p>
          <p className="mt-1 text-xs text-slate-500">Creado el {formatDate(bank.created_at)}</p>
        </li>
      ))}
    </ul>
  )
}
