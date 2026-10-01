import { AuthProvider, ForgotPasswordPage, LoginPage, ResetPasswordPage } from '@multifambank/auth'
import { LookProvider } from '@multifambank/ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { api, tokenStore } from './api'
import './index.css'
import { Home } from './routes/Home'

const queryClient = new QueryClient()

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/ingresar', element: <LoginPage appName="Mi banco" api={api} /> },
  { path: '/olvide-contrasena', element: <ForgotPasswordPage appName="Mi banco" api={api} /> },
  { path: '/restablecer-contrasena', element: <ResetPasswordPage appName="Mi banco" api={api} /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LookProvider look="family">
      <QueryClientProvider client={queryClient}>
        <AuthProvider api={api} tokenStore={tokenStore}>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    </LookProvider>
  </StrictMode>,
)
