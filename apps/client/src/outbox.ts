import { requestOperation, toApiError } from '@multifambank/api-client'
import { useOnline } from '@multifambank/auth'
import { enqueue, openBankDatabase, type OutboxPayload, type OutboxRequest } from '@multifambank/offline'
import { useQueryClient } from '@tanstack/react-query'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

const running = new Set<string>()

export type SyncResult = 'done' | 'offline' | 'busy'

/**
 * Sends queued requests in creation order. A request the server refuses (bank paused, not enough
 * savings, no longer a client…) stays visible as rejected with the reason; a network failure leaves
 * it queued for the next attempt. The request id makes retries safe: a request the server already
 * received is answered with the same request instead of being created twice.
 */
export async function syncOutbox(userId: number, bankId: number): Promise<SyncResult> {
  const key = `${userId}:${bankId}`
  if (running.has(key)) return 'busy'
  running.add(key)

  try {
    const db = openBankDatabase(userId, bankId)
    const queued = await db.outbox.where('state').equals('queued').sortBy('createdAt')

    for (const item of queued) {
      try {
        await requestOperation(api, bankId, { id: item.id, ...item.payload })
        await db.outbox.delete(item.id)
      } catch (error) {
        const failure = toApiError(error)
        // No response, rate limited or a server error: try again later, in the same order.
        if (failure.status === undefined || failure.status === 429 || failure.status >= 500) return 'offline'
        await db.outbox.update(item.id, { state: 'rejected', lastError: failure.message })
      }
    }

    return 'done'
  } finally {
    running.delete(key)
  }
}

/** The local queue of one user in one bank, kept in sync automatically while the app is open. */
export function useOutbox(userId: number, bankId: number) {
  const online = useOnline()
  const queryClient = useQueryClient()
  const [syncing, setSyncing] = useState(false)
  const db = openBankDatabase(userId, bankId)
  const items = useLiveQuery(() => db.outbox.orderBy('createdAt').toArray(), [userId, bankId]) ?? []

  const sync = useCallback(async () => {
    setSyncing(true)
    try {
      const result = await syncOutbox(userId, bankId)
      if (result === 'done') await queryClient.invalidateQueries({ queryKey: ['client'] })
    } finally {
      setSyncing(false)
    }
  }, [userId, bankId, queryClient])

  // On opening the app and whenever the connection comes back.
  const queuedCount = items.filter((item) => item.state === 'queued').length
  useEffect(() => {
    if (!online || queuedCount === 0) return
    // Deferred a tick: several triggers in a row (reconnect + new request) become one sync.
    const id = setTimeout(() => void sync(), 0)
    return () => clearTimeout(id)
  }, [online, queuedCount, sync])

  const add = useCallback((id: string, payload: OutboxPayload) => enqueue(db, id, payload), [db])
  const discard = useCallback((item: OutboxRequest) => db.outbox.delete(item.id), [db])

  return { items, syncing, sync, add, discard, online }
}
