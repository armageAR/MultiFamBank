// Only bundled in non-production builds (see main.tsx): production never ships this page.
const environments = [
  {
    name: 'Producción',
    tone: 'text-emerald-700',
    apps: [
      { name: 'Clientes', url: 'https://client.fambank.armage.tech' },
      { name: 'Banco (administrador)', url: 'https://bank.fambank.armage.tech' },
      { name: 'Plataforma', url: 'https://platform.fambank.armage.tech' },
    ],
  },
  {
    name: 'Staging',
    tone: 'text-red-600',
    apps: [
      { name: 'Clientes', url: 'https://client.dev.fambank.armage.tech' },
      { name: 'Banco (administrador)', url: 'https://bank.dev.fambank.armage.tech' },
      { name: 'Plataforma', url: 'https://platform.dev.fambank.armage.tech' },
    ],
  },
]

/** The address of each app in both environments. */
export function Links() {
  return (
    <div className="min-h-dvh bg-gray-50 font-sans text-gray-800">
      <div className="bg-red-600 px-4 py-1.5 text-center text-xs font-bold tracking-wide text-white uppercase">Staging · entorno de pruebas</div>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-10 rounded-xl" />
          <h1 className="text-2xl font-black tracking-tight text-gray-900">Links de las apps</h1>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {environments.map((environment) => (
            <section key={environment.name} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className={`text-xs font-bold tracking-wide uppercase ${environment.tone}`}>{environment.name}</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {environment.apps.map((app) => (
                  <li key={app.url}>
                    <a href={app.url} className="block rounded-xl border border-gray-100 px-4 py-3 transition hover:border-emerald-300 hover:bg-emerald-50">
                      <span className="block text-sm font-bold text-gray-900">{app.name}</span>
                      <span className="block truncate text-xs text-gray-500">{app.url.replace('https://', '')}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
