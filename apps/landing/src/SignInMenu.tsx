import { useEffect, useRef, useState } from 'react'

// The local apps' addresses only under `vite dev`: a deployed build without the variables shows no links.
const adminUrl = import.meta.env.VITE_ADMIN_APP_URL ?? (import.meta.env.DEV ? 'http://localhost:5174' : '')
const clientUrl = import.meta.env.VITE_CLIENT_APP_URL ?? (import.meta.env.DEV ? 'http://localhost:5173' : '')

/** Sign-in pages for people who already have an account; null when not configured. The platform app is never linked. */
export const signInUrls =
  adminUrl && clientUrl ? { bank: `${adminUrl.replace(/\/$/, '')}/ingresar`, client: `${clientUrl.replace(/\/$/, '')}/ingresar` } : null

const options = !signInUrls
  ? []
  : [
      { href: signInUrls.bank, emoji: '🏦', title: 'Soy el banco', text: 'Administro la plata de la familia', hover: 'hover:bg-sky-50' },
      { href: signInUrls.client, emoji: '🧒', title: 'Soy integrante', text: 'Ahorro y pido desde mi celular', hover: 'hover:bg-emerald-50' },
    ]

/** "Ingresar" button in the header; opens the two sign-in options. */
export function SignInMenu() {
  const [open, setOpen] = useState(false)
  const menu = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  // Closes on a click outside or on Escape (which returns focus to the button).
  useEffect(() => {
    if (!open) return
    function onPointer(event: PointerEvent) {
      if (!menu.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={menu} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls="sign-in-menu"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 rounded-full border-2 border-gray-200 px-4 py-1.5 text-sm font-extrabold text-gray-700 transition hover:border-gray-300 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
      >
        Ingresar
        <span aria-hidden="true" className={`text-xs transition ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>
      {open && (
        <div id="sign-in-menu" className="absolute right-0 z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-100 bg-white p-2 shadow-xl">
          <p className="px-3 pt-1 pb-2 text-xs font-bold tracking-wide text-gray-500 uppercase">¿Ya tenés cuenta?</p>
          <ul>
            {options.map((option) => (
              <li key={option.href}>
                <a href={option.href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${option.hover}`}>
                  <span aria-hidden="true" className="text-2xl">
                    {option.emoji}
                  </span>
                  <span>
                    <span className="block font-extrabold text-gray-900">{option.title}</span>
                    <span className="block text-sm text-gray-500">{option.text}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
