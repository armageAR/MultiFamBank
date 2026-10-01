import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { QueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

/**
 * Query client whose cache survives reloads, so the last downloaded data is readable offline.
 * Writes fail fast when offline instead of waiting, so the UI can say so.
 */
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

  return { queryClient, persister, clearStorage, maxAge: 7 * 24 * 60 * 60_000 }
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
