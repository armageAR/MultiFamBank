import { fetchMe, logout, type TokenStore, type User } from '@multifambank/api-client'
import { clearAppLock, isAppLockAvailable, LOCK_AFTER_MS, readAppLock, registerAppLock, verifyAppLock } from './appLock'
import { AppLockScreen, PrivacyCover } from './AppLockScreen'
import { forgetPushSubscription } from './push'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosInstance } from 'axios'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'

export interface AuthContextValue {
  user: User | null
  isLoading: boolean
  signIn: (token: string, user: User) => void
  signOut: () => Promise<void>
  /** Refetches the signed-in user, e.g. after their bank changes. */
  refresh: () => Promise<void>
  /** Asking for the fingerprint or face when the app opens on this device. */
  appLock: {
    available: boolean
    enabled: boolean
    enable: () => Promise<void>
    disable: () => void
  }
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
  const lockKey = `${tokenStore.key}.lock`
  const [lock, setLock] = useState(() => readAppLock(lockKey))
  // Opening the app with a session and the lock enabled starts locked.
  const [locked, setLocked] = useState(() => tokenStore.get() !== null && readAppLock(lockKey) !== null)
  // While in the background the app is blanked, so the phone's app switcher shows no balances.
  const [obscured, setObscured] = useState(false)
  const [lockAvailable, setLockAvailable] = useState(false)

  useEffect(() => {
    void isAppLockAvailable().then(setLockAvailable)
  }, [])

  // Enabling or disabling it in another tab of the same app.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === lockKey) setLock(readAppLock(lockKey))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [lockKey])

  // Back from the background after a while: locked again. Synchronous renders, so neither the
  // app-switcher snapshot nor the first frame back shows the app.
  useEffect(() => {
    if (!lock || token === null) return
    let hiddenAt: number | null = null
    const hide = () => {
      hiddenAt ??= Date.now()
      flushSync(() => setObscured(true))
    }
    const show = () => {
      const expired = hiddenAt !== null && Date.now() - hiddenAt >= LOCK_AFTER_MS
      hiddenAt = null
      flushSync(() => {
        if (expired) setLocked(true)
        setObscured(false)
      })
    }
    const onVisibility = () => (document.visibilityState === 'hidden' ? hide() : show())
    // A page restored from the back-forward cache may not report a visibility change.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) show()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('pageshow', onPageShow)
      setObscured(false)
    }
  }, [lock, token])

  // The API client clears the store on 401; public pages then simply render signed out.
  useEffect(
    () =>
      tokenStore.subscribe((next) => {
        setToken(next)
        // Drop every cached result so nothing from this account reaches the next one. Reset (not
        // clear) keeps mounted queries alive and refetches them, e.g. a public invitation page.
        if (next === null) {
          // The lock belongs to the session: the next sign-in starts without it.
          clearAppLock(lockKey)
          setLock(null)
          setLocked(false)
          // An expired or revoked session also stops this device's notifications.
          void forgetPushSubscription()
          onSessionEnd?.()
          void queryClient.resetQueries()
        }
      }),
    [tokenStore, queryClient, onSessionEnd, lockKey],
  )

  const me = useQuery({
    // Not keyed by the token: the key is persisted for offline use and must not contain secrets.
    queryKey: ['me'],
    queryFn: () => fetchMe(api),
    enabled: token !== null,
    retry: false,
    staleTime: 5 * 60_000,
  })

  const signIn = useCallback(
    (newToken: string, user: User) => {
      // Data cached for a previous account; the current page's queries stay mounted.
      queryClient.removeQueries({ type: 'inactive' })
      queryClient.setQueryData(['me'], user)
      tokenStore.set(newToken)
    },
    [queryClient, tokenStore],
  )

  const signOut = useCallback(async () => {
    const ending = tokenStore.get()
    await forgetPushSubscription(api)
    try {
      await logout(api)
    } catch {
      // The local session is cleared even if the API is unreachable.
    }
    // The lock screen stops waiting after a few seconds; someone may have signed in again since.
    if (tokenStore.get() !== ending) return
    queryClient.clear()
    tokenStore.clear()
  }, [api, queryClient, tokenStore])

  const refetch = me.refetch
  const refresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  const user = me.data
  const enableLock = useCallback(async () => {
    if (!user) throw new Error('La sesión todavía no cargó.')
    setLock(await registerAppLock(lockKey, user))
  }, [lockKey, user])

  const disableLock = useCallback(() => {
    clearAppLock(lockKey)
    setLock(null)
    setLocked(false)
  }, [lockKey])

  const unlock = useCallback(async () => {
    if (!lock || !(await verifyAppLock(lock))) return false
    setLocked(false)
    return true
  }, [lock])

  // From the lock screen: a slow or silent connection must not keep the person waiting.
  const signOutLocked = useCallback(async () => {
    await Promise.race([signOut(), new Promise((resolve) => setTimeout(resolve, 3000))])
    if (tokenStore.get() !== null) {
      queryClient.clear()
      tokenStore.clear()
    }
  }, [signOut, tokenStore, queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: token ? (me.data ?? null) : null,
      isLoading: token !== null && me.isPending,
      signIn,
      signOut,
      refresh,
      appLock: { available: lockAvailable, enabled: lock !== null, enable: enableLock, disable: disableLock },
    }),
    [token, me.data, me.isPending, signIn, signOut, refresh, lockAvailable, lock, enableLock, disableLock],
  )

  const showLock = locked && token !== null && lock !== null
  const hideApp = showLock || obscured

  return (
    <AuthContext.Provider value={value}>
      {/* Always rendered, so locking never remounts the app. The covers below handle dialogs, which
          browsers draw above everything regardless of this wrapper. */}
      <div style={{ display: 'contents', visibility: hideApp ? 'hidden' : undefined }} inert={hideApp} aria-hidden={hideApp || undefined}>
        {children}
      </div>
      {/* Never both: each keeps itself on top of any other dialog. */}
      {showLock ? <AppLockScreen user={me.data ?? null} onUnlock={unlock} onUsePassword={signOutLocked} /> : obscured && <PrivacyCover />}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
