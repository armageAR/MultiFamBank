/**
 * Stores the API token for one app and notifies subscribers when it changes. Storage can be
 * unavailable (private mode), so every access is guarded.
 */
export function createTokenStore(key: string) {
  const listeners = new Set<(token: string | null) => void>()
  const notify = (token: string | null) => listeners.forEach((listener) => listener(token))

  return {
    get(): string | null {
      try {
        return localStorage.getItem(key)
      } catch {
        return null
      }
    },
    set(token: string) {
      try {
        localStorage.setItem(key, token)
      } catch {
        // The session then lasts only for this page load.
      }
      notify(token)
    },
    clear() {
      try {
        localStorage.removeItem(key)
      } catch {
        // Nothing stored.
      }
      notify(null)
    },
    subscribe(listener: (token: string | null) => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export type TokenStore = ReturnType<typeof createTokenStore>
