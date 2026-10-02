import { deletePushSubscription, fetchPushPublicKey, savePushSubscription, sendTestPush, toApiError } from '@multifambank/api-client'
import type { AxiosInstance } from 'axios'
import { useCallback, useEffect, useState } from 'react'

export type PushStatus = 'loading' | 'unsupported' | 'unavailable' | 'denied' | 'subscribed' | 'unsubscribed'

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/** The service worker registration, or null if there is none within a few seconds (e.g. in development). */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
  return Promise.race([navigator.serviceWorker.ready, timeout])
}

function supported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** Web Push for the signed-in user, as in FamBank: activate, and send a test from the server. */
export function usePushNotifications(api: AxiosInstance) {
  const [status, setStatus] = useState<PushStatus>('loading')
  const [message, setMessage] = useState<string | null>(null)

  const check = useCallback(async () => {
    try {
      if (!supported()) return setStatus('unsupported')
      if (Notification.permission === 'denied') return setStatus('denied')
      const reg = await registration()
      if (!reg) return setStatus('unsupported')
      const subscription = await reg.pushManager.getSubscription()
      // Re-register this device for whoever is signed in now, so it never keeps receiving the
      // notifications of a previous user.
      if (subscription) await savePushSubscription(api, subscription.toJSON())
      setStatus(subscription ? 'subscribed' : 'unsubscribed')
    } catch {
      setStatus('unsubscribed')
    }
  }, [api])

  useEffect(() => {
    void check()
  }, [check])

  /** Returns whether this device ended up subscribed. */
  const subscribe = useCallback(async (): Promise<boolean> => {
    setMessage(null)
    setStatus('loading')
    try {
      const key = await fetchPushPublicKey(api)
      if (!key) {
        setStatus('unavailable')
        setMessage('Las notificaciones no están configuradas en el servidor.')
        return false
      }
      if ((await Notification.requestPermission()) !== 'granted') {
        setStatus('denied')
        return false
      }

      const reg = await registration()
      if (!reg) {
        setStatus('unsupported')
        return false
      }
      // A fresh subscription guarantees it uses the server's current key.
      const previous = await reg.pushManager.getSubscription()
      if (previous) {
        await deletePushSubscription(api, previous.endpoint).catch(() => undefined)
        await previous.unsubscribe()
      }
      const subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) })
      await savePushSubscription(api, subscription.toJSON())
      setStatus('subscribed')
      setMessage('Notificaciones activadas en este dispositivo.')
      return true
    } catch (error) {
      setMessage(toApiError(error).message)
      await check()
      return false
    }
  }, [api, check])

  const unsubscribe = useCallback(async () => {
    setMessage(null)
    setStatus('loading')
    await forgetPushSubscription(api)
    setStatus('unsubscribed')
    setMessage('Notificaciones desactivadas en este dispositivo.')
  }, [api])

  const test = useCallback(async () => {
    setMessage(null)
    try {
      setMessage(await sendTestPush(api))
    } catch (error) {
      const failure = toApiError(error)
      if (failure.status !== 410) return setMessage(failure.message)

      // The push service invalidated this device's subscription (reinstall, cleared data…):
      // renew it and try once more, so nobody has to deactivate and reactivate by hand. The server
      // already deleted the expired rows, so only the local subscription is dropped here.
      await forgetPushSubscription()
      if (!(await subscribe())) return
      try {
        setMessage(`Renovamos las notificaciones de este dispositivo. ${await sendTestPush(api)}`)
      } catch (retryError) {
        const retry = toApiError(retryError)
        setMessage(retry.status === 410 ? 'No pudimos renovar las notificaciones. Probá desactivarlas y activarlas de nuevo.' : retry.message)
      }
    }
  }, [api, subscribe])

  return { status, message, subscribe, unsubscribe, test, dismiss: () => setMessage(null) }
}

/** Removes this device's subscription so the next person signing in does not get the previous user's notifications. */
export async function forgetPushSubscription(api?: AxiosInstance): Promise<void> {
  if (!supported()) return
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const subscription = await reg?.pushManager.getSubscription()
    if (!subscription) return
    // Unsubscribing locally is what matters; the server forgets endpoints that stop working.
    // The DELETE is not awaited so a slow network cannot hold up signing out.
    if (api) void deletePushSubscription(api, subscription.endpoint).catch(() => undefined)
    await subscription.unsubscribe()
  } catch {
    // Best effort: signing out must never fail because of push.
  }
}
