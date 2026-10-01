import { AuthProvider, createOfflineQueryClient, ForgotPasswordPage, LoginPage, ResetPasswordPage } from '@multifambank/auth'
import { LookProvider } from '@multifambank/ui'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { api, tokenStore } from './api'
import './index.css'
import { AcceptInvitation } from './routes/AcceptInvitation'
import { AdminHome } from './routes/AdminHome'
import { BankSetup } from './routes/BankSetup'

// The last downloaded data stays readable offline; it is wiped when the session ends.
const { queryClient, persister, clearStorage, maxAge } = createOfflineQueryClient('mfb.admin.cache')

const router = createBrowserRouter([
  { path: '/ingresar', element: <LoginPage appName="Administración" api={api} /> },
  { path: '/olvide-contrasena', element: <ForgotPasswordPage appName="Administración" api={api} /> },
  { path: '/restablecer-contrasena', element: <ResetPasswordPage appName="Administración" api={api} /> },
  { path: '/invitacion/:token', element: <AcceptInvitation /> },
  { path: '/configurar-banco', element: <BankSetup /> },
  { path: '/', element: <AdminHome /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LookProvider look="family">
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge }}>
        <AuthProvider api={api} tokenStore={tokenStore} onSessionEnd={clearStorage}>
          <RouterProvider router={router} />
        </AuthProvider>
      </PersistQueryClientProvider>
    </LookProvider>
  </StrictMode>,
)
