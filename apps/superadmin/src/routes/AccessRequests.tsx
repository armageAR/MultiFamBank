import { listAccessRequests, markAccessRequestContacted, toApiError, type AccessRequest } from '@multifambank/api-client'
import { Alert, Button, Card } from '@multifambank/ui'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { api } from '../api'
import { formatDateTime } from '../format'

type Status = 'pending' | 'contacted'

/** People who asked for access from fambank.armage.tech, to contact and tick off. */
export function AccessRequests() {
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('estado')
  const status: Status | undefined = statusParam === 'contactadas' ? 'contacted' : statusParam === 'todas' ? undefined : 'pending'
  const search = params.get('buscar') ?? ''
  const page = Number(params.get('pagina') ?? '1')
  const [searchInput, setSearchInput] = useState(search)

  function updateParams(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
  }

  // Debounce the search box into the URL.
  useEffect(() => {
    if (searchInput === search) return
    const id = setTimeout(() => updateParams({ buscar: searchInput || null, pagina: null }), 300)
    return () => clearTimeout(id)
  })

  const list = useQuery({
    queryKey: ['access-requests', { status, search, page }],
    queryFn: () => listAccessRequests(api, { status, search: search || undefined, page }),
    placeholderData: keepPreviousData,
  })

  const queryClient = useQueryClient()
  const mark = useMutation({
    mutationFn: ({ request, contacted }: { request: AccessRequest; contacted: boolean }) => markAccessRequestContacted(api, request.id, contacted),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['access-requests'] }),
  })

  const counts = list.data?.counts
  const chips: { key: string; label: string; active: boolean; count?: number }[] = [
    { key: 'pendientes', label: 'Sin contactar', active: status === 'pending', count: counts?.pending },
    { key: 'contactadas', label: 'Contactadas', active: status === 'contacted', count: counts?.contacted },
    { key: 'todas', label: 'Todas', active: status === undefined, count: counts ? counts.pending + counts.contacted : undefined },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Solicitudes de acceso</h2>
        <p className="text-sm text-slate-600">Personas que pidieron acceso desde fambank.armage.tech.</p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar solicitudes">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            aria-pressed={chip.active}
            onClick={() => updateParams({ estado: chip.key === 'pendientes' ? null : chip.key, pagina: null })}
            className={`rounded-full border px-3 py-1 text-sm ${chip.active ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}
          >
            {chip.label}
            {chip.count !== undefined && <span className={chip.active ? 'ml-1 text-brand-100' : 'ml-1 text-slate-500'}>({chip.count})</span>}
          </button>
        ))}
      </div>

      <input
        type="search"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Buscar por nombre o email"
        aria-label="Buscar solicitudes"
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-brand-600"
      />

      {list.isError && <Alert tone="error">{toApiError(list.error).message}</Alert>}
      {mark.isError && <Alert tone="error">{toApiError(mark.error).message}</Alert>}

      {list.isPending ? (
        <p className="py-8 text-center text-slate-500">Cargando solicitudes…</p>
      ) : list.data && list.data.data.length === 0 ? (
        <Card>
          <p className="text-center text-slate-600">
            {search ? 'No hay solicitudes que coincidan con la búsqueda.' : status === 'pending' ? 'No hay solicitudes sin contactar.' : 'No hay solicitudes.'}
          </p>
        </Card>
      ) : (
        list.data && (
          <>
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {list.data.data.map((request) => {
                const busy = mark.isPending && mark.variables?.request.id === request.id
                return (
                  <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">{request.name}</p>
                      <a href={`mailto:${request.email}`} className="text-sm break-all text-brand-700 hover:underline">
                        {request.email}
                      </a>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Pedida el {formatDateTime(request.created_at)}
                        {' · '}
                        {request.notified_at ? 'aviso enviado por email' : <span className="text-amber-700">aviso no enviado</span>}
                        {request.contacted_at && ` · contactada el ${formatDateTime(request.contacted_at)}`}
                      </p>
                    </div>
                    <Button
                      variant={request.contacted_at ? 'secondary' : 'primary'}
                      loading={busy}
                      onClick={() => mark.mutate({ request, contacted: !request.contacted_at })}
                    >
                      {request.contacted_at ? 'Desmarcar' : 'Marcar como contactada'}
                    </Button>
                  </li>
                )
              })}
            </ul>
            {list.data.meta.last_page > 1 && (
              <nav className="flex items-center justify-between text-sm" aria-label="Paginación">
                <Button variant="secondary" disabled={page <= 1} onClick={() => updateParams({ pagina: String(page - 1) })}>
                  Anterior
                </Button>
                <span className="text-slate-600">
                  Página {list.data.meta.current_page} de {list.data.meta.last_page}
                </span>
                <Button variant="secondary" disabled={page >= list.data.meta.last_page} onClick={() => updateParams({ pagina: String(page + 1) })}>
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
