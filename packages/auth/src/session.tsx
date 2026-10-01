import { fetchMe, logout, type TokenStore, type User } from '@multifambank/api-client'
import { forgetPushSubscription } from './push'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosInstance } from 'axios'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

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
export function AuthProvider({
  api,
  tokenStore,
  onSessionEnd,
  children,
}: {
  api: AxiosInstance
  tokenStore: TokenStore
  /** Called when the session ends (sign-out or expired token), e.g. to wipe an offline cache. */
  onSessionEnd?: () => void
  children: ReactNode
}) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState(tokenStore.get)

  // The API client clears the store on 401; public pages then simply render signed out.
  useEffect(
    () =>
      tokenStore.subscribe((next) => {
        setToken(next)
        // Drop every cached result so nothing from this account reaches the next one. Reset (not
        // clear) keeps mounted queries alive and refetches them, e.g. a public invitation page.
        if (next === null) {
          onSessionEnd?.()
          void queryClient.resetQueries()
        }
      }),
    [tokenStore, queryClient, onSessionEnd],
  )

  const me = useQuery({
    queryKey: ['me', token],
    queryFn: () => fetchMe(api),
    enabled: token !== null,
    retry: false,
    staleTime: 5 * 60_000,
  })

  const signIn = useCallback(
    (newToken: string, user: User) => {
      // Data cached for a previous account; the current page's queries stay mounted.
      queryClient.removeQueries({ type: 'inactive' })
      queryClient.setQueryData(['me', newToken], user)
      tokenStore.set(newToken)
    },
    [queryClient, tokenStore],
  )

  const signOut = useCallback(async () => {
    await forgetPushSubscription(api)
    try {
      await logout(api)
    } catch {
      // The local session is cleared even if the API is unreachable.
    }
    queryClient.clear()
    tokenStore.clear()
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

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
