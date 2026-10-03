import { AcceptInvitationPage, AuthProvider, createOfflineQueryClient, ForgotPasswordPage, LoginPage, ResetPasswordPage } from '@multifambank/auth'
import { clearAllOfflineData } from '@multifambank/offline'
import { LookProvider } from '@multifambank/ui'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { api, tokenStore } from './api'
import './index.css'
import { Home } from './routes/Home'
import { Links } from './routes/Links'

const { queryClient, persister, clearStorage, maxAge, buster, dehydrateOptions } = createOfflineQueryClient('mfb.client.cache')

// Ending the session wipes everything stored on this device, including requests not sent yet:
// the next person must never send (or see) them.
const endSession = () => {
  clearStorage()
  void clearAllOfflineData()
}

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/links', element: <Links /> },
  { path: '/ingresar', element: <LoginPage appName="Mi banco" api={api} /> },
  { path: '/olvide-contrasena', element: <ForgotPasswordPage appName="Mi banco" api={api} /> },
  { path: '/restablecer-contrasena', element: <ResetPasswordPage appName="Mi banco" api={api} /> },
  {
    path: '/invitacion/:token',
    element: (
      <AcceptInvitationPage
        appName="Mi banco"
        api={api}
        next="/"
        title="Sumate a tu banco"
        intro={(details) => `Te invitaron a ser cliente de ${details.bank.name ?? 'un banco familiar'} en MultiFamBank.`}
      />
    ),
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LookProvider look="family">
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge, buster, dehydrateOptions }}>
        <AuthProvider api={api} tokenStore={tokenStore} onSessionEnd={endSession}>
          <RouterProvider router={router} />
        </AuthProvider>
      </PersistQueryClientProvider>
    </LookProvider>
  </StrictMode>,
)
