import type { ReactNode } from 'react'
import { AccessForm } from './AccessForm'

const staging = import.meta.env.VITE_APP_ENV === 'staging'

function Check({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-700">
        ✓
      </span>
      <span>{children}</span>
    </li>
  )
}

/** A friendly look at the two apps, drawn with the same pieces the real ones use. */
function PhonePreview() {
  return (
    <div className="relative mx-auto w-full max-w-xs" aria-hidden="true">
      <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-emerald-200 via-amber-100 to-sky-200 blur-2xl" />
      <div className="rounded-[2.5rem] border-8 border-gray-900 bg-gray-50 p-4 shadow-2xl">
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="size-8 rounded-lg" />
          <div>
            <p className="text-[10px] tracking-[0.2em] text-gray-500 uppercase">Banco de los García</p>
            <p className="text-sm font-bold text-gray-900">Sofi</p>
          </div>
        </div>
        <div className="mt-4 rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-[10px] tracking-wide text-gray-500 uppercase">Mis ahorros</p>
          <div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-right">
            <p className="text-[10px] text-emerald-700">Dólares</p>
            <p className="text-xl font-extrabold text-emerald-700">USD 152,40</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <span className="rounded-xl bg-emerald-600 py-2 text-center text-xs font-bold text-white">Depositar</span>
          <span className="rounded-xl bg-red-600 py-2 text-center text-xs font-bold text-white">Retirar</span>
          <span className="col-span-2 rounded-xl bg-amber-500 py-2 text-center text-xs font-bold text-white">Pedir dinero para un gasto</span>
        </div>
        <div className="mt-3 rounded-2xl bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">Gasto · Dinero del banco</span>
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">Confirmado</span>
          </div>
          <p className="mt-2 text-right text-base font-extrabold text-gray-900">$ 12.000,00</p>
          <p className="text-xs text-gray-600">Entradas para el cine</p>
        </div>
      </div>
    </div>
  )
}

const steps = [
  { emoji: '🏦', title: 'Armás el banco de tu familia', text: 'Quien maneja la plata de la casa hace de banco e invita a cada integrante con su email.' },
  {
    emoji: '📲',
    title: 'Cada uno pide desde su celular',
    text: 'Depositar sus ahorros, retirarlos o pedir plata para un gasto, contando para qué es.',
  },
  { emoji: '✅', title: 'El banco aprueba y todo queda anotado', text: 'Confirmás o rechazás con un toque. Cada movimiento queda registrado para todos.' },
]

const reasons = [
  { emoji: '💵', title: 'Ahorros en dólares', text: 'Los ahorros se guardan en dólares, a la cotización del dólar blue del momento, que queda grabada en cada movimiento.' },
  { emoji: '🌱', title: 'Aprenden a manejar la plata', text: 'Ver crecer sus ahorros y pensar antes de pedir es la mejor educación financiera.' },
  { emoji: '📒', title: 'Sin papelitos ni discusiones', text: 'Fechas, montos y motivos quedan anotados. Cada uno ve sus movimientos cuando quiere.' },
  { emoji: '🔔', title: 'Avisos al instante', text: 'Llega una notificación cuando alguien pide algo y cuando el banco lo confirma.' },
]

export function App() {
  return (
    <div className="min-h-dvh bg-white font-sans text-gray-800">
      {staging && <div className="bg-red-600 px-4 py-1.5 text-center text-xs font-bold tracking-wide text-white uppercase">Staging · entorno de pruebas</div>}

      <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-2.5 text-center text-sm font-bold text-amber-950">
        🎁 Por tiempo limitado, FamBank es <span className="underline decoration-2 underline-offset-2">completamente gratis</span>: acceso y uso sin costo.
      </div>

      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <a href="#inicio" className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" className="size-10 rounded-xl shadow-md shadow-emerald-600/20" />
          <span className="text-xl font-black tracking-tight text-gray-900">FamBank</span>
        </a>
        <a
          href="#sumate"
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white transition hover:bg-emerald-500 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
        >
          Quiero sumarme
        </a>
      </header>

      <main>
        <section id="inicio" className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-6 pb-16 sm:px-6 lg:grid-cols-2 lg:pt-12 lg:pb-24">
          <div>
            <p className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">La plata de la familia, ordenada</p>
            <h1 className="mt-4 text-4xl leading-tight font-black tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              El banco de tu familia, <span className="text-emerald-600">en el celular</span>.
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-gray-600">
              FamBank es una forma simple de manejar la plata en familia. Cada integrante ahorra en su propia cuenta, pide lo que necesita desde el celular y quien hace
              de banco lo aprueba con un toque. Todo queda anotado, sin papelitos ni discusiones.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#sumate"
                className="rounded-xl bg-emerald-600 px-6 py-3.5 font-extrabold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
              >
                Pedí tu acceso gratis
              </a>
              <a href="#como-funciona" className="rounded-xl border-2 border-gray-200 px-6 py-3 font-bold text-gray-700 transition hover:border-gray-300">
                Cómo funciona
              </a>
            </div>
          </div>
          <PhonePreview />
        </section>

        <section id="como-funciona" className="bg-emerald-50/60 py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-black tracking-tight text-gray-900 sm:text-4xl">¿Cómo funciona?</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-lg text-gray-600">Tres pasos y la familia ya tiene su banco.</p>
            <ol className="mt-10 grid gap-5 md:grid-cols-3">
              {steps.map((step, index) => (
                <li key={step.title} className="rounded-3xl bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-emerald-600 font-black text-white">{index + 1}</span>
                    <span className="text-3xl" aria-hidden="true">
                      {step.emoji}
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-extrabold text-gray-900">{step.title}</h3>
                  <p className="mt-2 text-gray-600">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <h2 className="text-center text-3xl font-black tracking-tight text-gray-900 sm:text-4xl">Dos apps, una para cada rol</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-lg text-gray-600">Se usan desde el navegador o se instalan en el celular como cualquier app.</p>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <article className="rounded-3xl border-2 border-sky-100 bg-sky-50/50 p-6 sm:p-8">
              <p className="text-4xl" aria-hidden="true">
                🏦
              </p>
              <h3 className="mt-3 text-2xl font-black text-gray-900">La app del banco</h3>
              <p className="mt-1 font-semibold text-sky-700">Para quien administra la plata de la familia</p>
              <ul className="mt-5 flex flex-col gap-3 text-gray-700">
                <Check>Un resumen con los ahorros de todos, en dólares y en pesos, y la cotización del día.</Check>
                <Check>Los pedidos pendientes a la vista: confirmás, rechazás o los ajustás antes de aprobar.</Check>
                <Check>Registrás movimientos que pasaron fuera de la app, con su fecha.</Check>
                <Check>El historial de cada integrante y un reporte mensual con los gastos y los movimientos de ahorro.</Check>
                <Check>Te avisa cuando alguien pide algo.</Check>
              </ul>
            </article>
            <article className="rounded-3xl border-2 border-emerald-100 bg-emerald-50/50 p-6 sm:p-8">
              <p className="text-4xl" aria-hidden="true">
                🧒
              </p>
              <h3 className="mt-3 text-2xl font-black text-gray-900">La app de cada integrante</h3>
              <p className="mt-1 font-semibold text-emerald-700">Para los chicos y el resto de la familia</p>
              <ul className="mt-5 flex flex-col gap-3 text-gray-700">
                <Check>Ven sus ahorros en dólares y cuánto son en pesos.</Check>
                <Check>Piden depositar o retirar, poniendo el monto en pesos o en dólares, con la cotización siempre a la vista.</Check>
                <Check>Piden plata para un gasto contando para qué es: la paga el banco, no sus ahorros.</Check>
                <Check>Siguen cada pedido y ven si el banco cambió algo.</Check>
                <Check>Sin conexión pueden preparar el pedido: se envía solo cuando vuelve internet.</Check>
              </ul>
            </article>
          </div>
        </section>

        <section className="bg-gray-50 py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-black tracking-tight text-gray-900 sm:text-4xl">¿Por qué FamBank?</h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {reasons.map((reason) => (
                <div key={reason.title} className="rounded-3xl bg-white p-6 shadow-sm">
                  <p className="text-3xl" aria-hidden="true">
                    {reason.emoji}
                  </p>
                  <h3 className="mt-3 text-lg font-extrabold text-gray-900">{reason.title}</h3>
                  <p className="mt-2 text-gray-600">{reason.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="sumate" className="scroll-mt-4 bg-gradient-to-br from-emerald-600 to-emerald-800 py-16 lg:py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
            <div className="text-white">
              <p className="inline-flex rounded-full bg-amber-300 px-3 py-1 text-sm font-extrabold text-amber-950">🎁 Gratis por tiempo limitado</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Pedí tu acceso</h2>
              <p className="mt-4 text-lg text-emerald-50">
                Dejanos tu nombre y tu email y te vamos a contactar para armar el banco de tu familia. Mientras dure el lanzamiento, el acceso y el uso son
                completamente gratis.
              </p>
              <p className="mt-4 text-sm text-emerald-100">Por ahora FamBank está disponible solo en castellano.</p>
            </div>
            <AccessForm />
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm text-gray-500 sm:px-6">
        <span className="flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="size-6 rounded-md" />
          FamBank · El banco de tu familia
        </span>
        <span>© {new Date().getFullYear()} FamBank</span>
      </footer>
    </div>
  )
}
