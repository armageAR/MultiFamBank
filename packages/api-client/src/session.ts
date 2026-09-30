/** Stores the API token for one app. Storage can be unavailable (private mode), so every access is guarded. */
export function createTokenStore(key: string) {
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
    },
    clear() {
      try {
        localStorage.removeItem(key)
      } catch {
        // Nothing stored.
      }
    },
  }
}

export type TokenStore = ReturnType<typeof createTokenStore>
