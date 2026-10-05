import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTurnstile } from './useTurnstile'

const apiUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')

type Errors = Partial<Record<'name' | 'email' | 'form', string>>

/** Name and email; the server keeps one request per email and lets the FamBank team know. */
export function AccessForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<{ name: string; email: string } | null>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const emailInput = useRef<HTMLInputElement>(null)
  const thanks = useRef<HTMLHeadingElement>(null)
  const humanCheck = useRef<HTMLDivElement>(null)
  const turnstile = useTurnstile(humanCheck)

  // Screen readers hear the outcome: focus moves to the thanks, or to the first field to fix.
  useEffect(() => {
    if (sent) thanks.current?.focus()
  }, [sent])

  function showErrors(next: Errors) {
    setErrors(next)
    if (next.name) nameInput.current?.focus()
    else if (next.email) emailInput.current?.focus()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const local: Errors = {}
    if (!name.trim()) local.name = 'Contanos tu nombre.'
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) local.email = 'Ese email no parece válido.'
    if (!Object.keys(local).length && turnstile.enabled && !turnstile.token) {
      local.form = turnstile.failed
        ? 'No pudimos hacer la verificación de seguridad. Recargá la página y probá de nuevo.'
        : 'Esperá a que termine la verificación de seguridad y volvé a tocar el botón.'
    }
    showErrors(local)
    if (Object.keys(local).length) return

    setSending(true)
    try {
      const response = await fetch(`${apiUrl}/api/access-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), website, turnstile_token: turnstile.token || undefined }),
      })
      // The token was used; a retry needs a new one.
      if (!response.ok) turnstile.reset()
      const body = await response.json().catch(() => ({}))
      if (response.ok) {
        turnstile.remove()
        setSent(body.data)
      } else if (response.status === 422) {
        const fields = (body.errors ?? {}) as Record<string, string[]>
        showErrors({ name: fields.name?.[0], email: fields.email?.[0], form: fields.website?.[0] ?? fields.turnstile_token?.[0] })
      } else if (response.status === 429) {
        setErrors({ form: 'Recibimos muchos intentos seguidos. Probá de nuevo en un rato.' })
      } else {
        setErrors({ form: 'No pudimos enviar la solicitud. Probá de nuevo en un momento.' })
      }
    } catch {
      turnstile.reset()
      setErrors({ form: 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.' })
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div role="status" className="rounded-3xl bg-white p-8 text-center shadow-xl shadow-emerald-900/10">
        <p className="text-5xl" aria-hidden="true">
          🎉
        </p>
        <h3 ref={thanks} tabIndex={-1} className="mt-3 text-2xl font-extrabold text-gray-900 outline-none">
          ¡Gracias, {sent.name}!
        </h3>
        <p className="mt-2 text-gray-600">
          Recibimos tu solicitud. Te vamos a contactar a <strong className="text-gray-900">{sent.email}</strong> para darte acceso.
        </p>
      </div>
    )
  }

  const field = (invalid?: string) =>
    `w-full rounded-xl border bg-white px-4 py-3 text-base text-gray-900 outline-none transition focus:ring-4 ${invalid ? 'border-red-400 focus:ring-red-100' : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-100'}`

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-xl shadow-emerald-900/10 sm:p-8">
      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-bold text-gray-700">
          Nombre
        </label>
        <input
          ref={nameInput}
          id="name"
          aria-required="true"
          autoComplete="name"
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? 'name-error' : undefined}
          className={field(errors.name)}
          placeholder="Cómo te llamás"
        />
        {errors.name && (
          <p id="name-error" className="mt-1 text-sm text-red-600">
            {errors.name}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-bold text-gray-700">
          Email
        </label>
        <input
          ref={emailInput}
          id="email"
          aria-required="true"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          maxLength={255}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className={field(errors.email)}
          placeholder="tu@email.com"
        />
        {errors.email && (
          <p id="email-error" className="mt-1 text-sm text-red-600">
            {errors.email}
          </p>
        )}
      </div>
      {/* Honeypot: invisible to people, bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="fb-hp">No completes este campo</label>
        <input id="fb-hp" tabIndex={-1} autoComplete="new-password" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      {/* Cloudflare Turnstile: confirms a person is sending the form, usually without a click. */}
      {turnstile.enabled && <div ref={humanCheck} className="min-h-[65px]" />}
      {errors.form && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.form}
        </p>
      )}
      <button
        type="submit"
        disabled={sending}
        className="rounded-xl bg-emerald-600 px-6 py-3.5 text-base font-extrabold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:opacity-60"
      >
        {sending ? 'Enviando…' : 'Quiero sumarme'}
      </button>
      <p className="text-center text-sm text-gray-500">Te vamos a contactar por email para darte acceso. No compartimos tus datos con nadie.</p>
    </form>
  )
}
