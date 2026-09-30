import { fetchMe, logout, type TokenStore, type User } from '@multifambank/api-client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosInstance } from 'axios'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export interface AuthContextValue {
  user: User | null
  isLoading: boolean
  signIn: (token: string, user: User) => void
  signOut: () => Promise<void>
  /** Refetches the signed-in user, e.g. after their bank changes. */
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Session for one app: the token lives in that app's store, the user comes from /auth/me. */
export function AuthProvider({ api, tokenStore, children }: { api: AxiosInstance; tokenStore: TokenStore; children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState(tokenStore.get)

  const me = useQuery({
    queryKey: ['me', token],
    queryFn: () => fetchMe(api),
    enabled: token !== null,
    retry: false,
    staleTime: 5 * 60_000,
  })

  const signIn = useCallback(
    (newToken: string, user: User) => {
      tokenStore.set(newToken)
      queryClient.setQueryData(['me', newToken], user)
      setToken(newToken)
    },
    [queryClient, tokenStore],
  )

  const signOut = useCallback(async () => {
    try {
      await logout(api)
    } catch {
      // The local session is cleared even if the API is unreachable.
    }
    tokenStore.clear()
    queryClient.clear()
    setToken(null)
  }, [api, queryClient, tokenStore])

  const refetch = me.refetch
  const refresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  const value = useMemo<AuthContextValue>(
    () => ({ user: token ? (me.data ?? null) : null, isLoading: token !== null && me.isPending, signIn, signOut, refresh }),
    [token, me.data, me.isPending, signIn, signOut, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
