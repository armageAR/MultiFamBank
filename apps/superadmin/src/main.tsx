import { AuthProvider, ForgotPasswordPage, LoginPage, ResetPasswordPage } from '@multifambank/auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { api, tokenStore } from './api'
import './index.css'
import { Banks } from './routes/Banks'
import { NewBank } from './routes/NewBank'
import { PlatformLayout } from './routes/PlatformLayout'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

const router = createBrowserRouter([
  { path: '/ingresar', element: <LoginPage appName="Plataforma" api={api} /> },
  { path: '/olvide-contrasena', element: <ForgotPasswordPage appName="Plataforma" api={api} /> },
  { path: '/restablecer-contrasena', element: <ResetPasswordPage appName="Plataforma" api={api} /> },
  {
    element: <PlatformLayout />,
    children: [
      { path: '/', element: <Banks /> },
      { path: '/bancos/nuevo', element: <NewBank /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider api={api} tokenStore={tokenStore}>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
