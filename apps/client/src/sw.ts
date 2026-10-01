/// <reference lib="webworker" />
// Precaching plus Web Push handling, as in the original FamBank service worker.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
// Single-page app: every navigation is answered with the cached shell, also offline.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

self.addEventListener('install', () => void self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  if (!event.data) return
  const { title = 'MultiFamBank', body = '', url = '/', tag } = event.data.json() as { title?: string; body?: string; url?: string; tag?: string }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag,
      data: { url },
      // Without renotify a notification with the same tag replaces the previous one silently.
      renotify: Boolean(tag),
    } as NotificationOptions),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data as { url?: string } | null)?.url ?? '/', self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(async (windows) => {
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin)
      if (existing) {
        try {
          const focused = await existing.focus()
          if (await focused.navigate(url)) return
        } catch {
          // Not controlled by this worker: open a new window instead.
        }
      }
      await self.clients.openWindow(url)
    }),
  )
})
