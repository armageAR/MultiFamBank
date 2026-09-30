import { AuthProvider } from '@multifambank/auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { api, tokenStore } from './api'
import './index.css'
import { AcceptInvitation } from './routes/AcceptInvitation'
import { BankHome } from './routes/BankHome'
import { BankSetup } from './routes/BankSetup'
import { Login } from './routes/Login'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

const router = createBrowserRouter([
  { path: '/ingresar', element: <Login /> },
  { path: '/invitacion/:token', element: <AcceptInvitation /> },
  { path: '/configurar-banco', element: <BankSetup /> },
  { path: '/', element: <BankHome /> },
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
