import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { QueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

/**
 * Query client whose cache survives reloads, so the last downloaded data is readable offline.
 * Writes fail fast when offline instead of waiting, so the UI can say so.
 */
const CACHE_VERSION = '2026-10-01'

export function createOfflineQueryClient(storageKey: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 1, refetchOnWindowFocus: false, networkMode: 'offlineFirst', gcTime: 7 * 24 * 60 * 60_000 },
      mutations: { networkMode: 'always' },
    },
  })

  let storage: Storage | undefined
  try {
    storage = window.localStorage
  } catch {
    storage = undefined
  }

  const persister = createSyncStoragePersister({ storage, key: storageKey, throttleTime: 1000 })

  /** Signing out (or an expired session) wipes the stored copy as well. */
  const clearStorage = () => {
    try {
      storage?.removeItem(storageKey)
    } catch {
      // Nothing stored.
    }
  }

  return {
    queryClient,
    persister,
    clearStorage,
    maxAge: 7 * 24 * 60 * 60_000,
    // A new build may change response shapes: older stored data is discarded.
    buster: CACHE_VERSION,
    dehydrateOptions: {
      // Only successful data, and never invitations (their key is a single-use token).
      shouldDehydrateQuery: (query: { queryKey: readonly unknown[]; state: { status: string } }) =>
        query.state.status === 'success' && query.queryKey[0] !== 'invitation',
    },
  }
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  return online
}
