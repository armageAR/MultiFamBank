import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'

// /links (every app's address) exists only outside production: Vite inlines VITE_APP_ENV, so the
// production build drops this branch and never includes the page.
const Links = import.meta.env.VITE_APP_ENV !== 'production' ? lazy(() => import('./Links').then((m) => ({ default: m.Links }))) : null
const page = Links && window.location.pathname.replace(/\/$/, '') === '/links' ? <Links /> : <App />

if (Links && page.type === Links) {
  document.title = 'Links · FamBank'
  const robots = document.createElement('meta')
  robots.name = 'robots'
  robots.content = 'noindex'
  document.head.append(robots)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense>{page}</Suspense>
  </StrictMode>,
)
