import { AuthProvider } from '@multifambank/auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { api, tokenStore } from './api'
import './index.css'
import { Banks } from './routes/Banks'
import { ForgotPassword } from './routes/ForgotPassword'
import { Login } from './routes/Login'
import { NewBank } from './routes/NewBank'
import { PlatformLayout } from './routes/PlatformLayout'
import { ResetPassword } from './routes/ResetPassword'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

const router = createBrowserRouter([
  { path: '/ingresar', element: <Login /> },
  { path: '/olvide-contrasena', element: <ForgotPassword /> },
  { path: '/restablecer-contrasena', element: <ResetPassword /> },
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
