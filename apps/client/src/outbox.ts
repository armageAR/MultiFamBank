import { requestOperation, toApiError } from '@multifambank/api-client'
import { useOnline } from '@multifambank/auth'
import { enqueue, openBankDatabase, type OutboxPayload, type OutboxRequest } from '@multifambank/offline'
import { useQueryClient } from '@tanstack/react-query'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'

const running = new Set<string>()

/** done: queue empty · retry: try again later (no connection, server busy) · stopped: session ended */
export type SyncResult = 'done' | 'retry' | 'stopped'

const retryable = (status: number | undefined) => status === undefined || status === 408 || status === 429 || status >= 500

/**
 * Sends queued requests in creation order, re-reading the queue until it is empty so requests
 * added meanwhile go out too. A request the server refuses (bank paused, not enough savings, no
 * longer a client…) stays visible as rejected with the reason; a retryable failure stops the run
 * and leaves the rest queued. The request id makes retries safe: a request the server already
 * received is answered with the same request instead of being created twice.
 */
export async function syncOutbox(userId: number, bankId: number): Promise<SyncResult> {
  const key = `${userId}:${bankId}`
  // One sender per user and bank, also across tabs when the browser supports Web Locks.
  if (running.has(key)) return 'retry'
  running.add(key)

  try {
    const run = async (): Promise<SyncResult> => {
      const db = openBankDatabase(userId, bankId)

      for (;;) {
        const next = (await db.outbox.where('state').equals('queued').sortBy('createdAt'))[0]
        if (!next) return 'done'

        try {
          await requestOperation(api, bankId, { id: next.id, ...next.payload })
          await db.outbox.delete(next.id)
        } catch (error) {
          const failure = toApiError(error)
          if (failure.status === 401) return 'stopped'
          if (retryable(failure.status)) return 'retry'
          await db.outbox.update(next.id, { state: 'rejected', lastError: failure.message })
        }
      }
    }

    return navigator.locks ? await navigator.locks.request(`mfb-outbox:${key}`, run) : await run()
  } catch {
    // The local database went away (session ended) or the run was interrupted.
    return 'stopped'
  } finally {
    running.delete(key)
  }
}

const RETRY_DELAYS = [5_000, 30_000, 120_000]

/** The local queue of one user in one bank, kept in sync automatically while the app is open. */
export function useOutbox(userId: number, bankId: number) {
  const online = useOnline()
  const queryClient = useQueryClient()
  const [syncing, setSyncing] = useState(false)
  const [lastFailed, setLastFailed] = useState(false)
  const attempts = useRef(0)
  const db = openBankDatabase(userId, bankId)
  const items = useLiveQuery(() => openBankDatabase(userId, bankId).outbox.orderBy('createdAt').toArray(), [userId, bankId]) ?? []

  const sync = useCallback(async (): Promise<SyncResult> => {
    setSyncing(true)
    try {
      const result = await syncOutbox(userId, bankId)
      setLastFailed(result === 'retry')
      attempts.current = result === 'retry' ? attempts.current + 1 : 0
      await queryClient.invalidateQueries({ queryKey: ['client'] })
      return result
    } finally {
      setSyncing(false)
    }
  }, [userId, bankId, queryClient])

  // On opening the app, whenever the connection comes back or something new is queued, and again
  // with growing delays after a failed attempt (server busy or still unreachable).
  const queuedCount = items.filter((item) => item.state === 'queued').length
  useEffect(() => {
    if (!online || queuedCount === 0) return
    let timer: ReturnType<typeof setTimeout>
    const attempt = async () => {
      const result = await sync().catch((): SyncResult => 'retry')
      if (result === 'retry') timer = setTimeout(attempt, RETRY_DELAYS[Math.min(attempts.current - 1, RETRY_DELAYS.length - 1)])
    }
    timer = setTimeout(attempt, 0)
    return () => clearTimeout(timer)
  }, [online, queuedCount, sync])

  const add = useCallback((id: string, payload: OutboxPayload) => enqueue(db, id, payload), [db])
  const discard = useCallback((item: OutboxRequest) => db.outbox.delete(item.id), [db])

  return { items, queuedCount, syncing, lastFailed, sync, add, discard, online }
}
