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

function supported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** Web Push for the signed-in user, as in FamBank: activate, and send a test from the server. */
export function usePushNotifications(api: AxiosInstance) {
  const [status, setStatus] = useState<PushStatus>('loading')
  const [message, setMessage] = useState<string | null>(null)

  const check = useCallback(async () => {
    if (!supported()) return setStatus('unsupported')
    if (Notification.permission === 'denied') return setStatus('denied')
    const registration = await navigator.serviceWorker.ready
    setStatus((await registration.pushManager.getSubscription()) ? 'subscribed' : 'unsubscribed')
  }, [])

  useEffect(() => {
    void check()
  }, [check])

  const subscribe = useCallback(async () => {
    setMessage(null)
    setStatus('loading')
    try {
      const key = await fetchPushPublicKey(api)
      if (!key) {
        setStatus('unavailable')
        setMessage('Las notificaciones no están configuradas en el servidor.')
        return
      }
      if ((await Notification.requestPermission()) !== 'granted') return setStatus('denied')

      const registration = await navigator.serviceWorker.ready
      // A fresh subscription guarantees it uses the server's current key.
      await (await registration.pushManager.getSubscription())?.unsubscribe()
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) })
      await savePushSubscription(api, subscription.toJSON())
      setStatus('subscribed')
      setMessage('Notificaciones activadas en este dispositivo.')
    } catch (error) {
      setMessage(toApiError(error).message)
      await check()
    }
  }, [api, check])

  const test = useCallback(async () => {
    setMessage(null)
    try {
      setMessage(await sendTestPush(api))
    } catch (error) {
      setMessage(toApiError(error).message)
    }
  }, [api])

  return { status, message, subscribe, test, dismiss: () => setMessage(null) }
}

/** Removes this device's subscription so the next person signing in does not get the previous user's notifications. */
export async function forgetPushSubscription(api: AxiosInstance): Promise<void> {
  if (!supported()) return
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    const subscription = await registration?.pushManager.getSubscription()
    if (!subscription) return
    await deletePushSubscription(api, subscription.endpoint).catch(() => undefined)
    await subscription.unsubscribe()
  } catch {
    // Best effort: signing out must never fail because of push.
  }
}
