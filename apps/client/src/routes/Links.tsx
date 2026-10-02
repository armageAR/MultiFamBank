import { AuthLayout } from "@multifambank/ui";

// Railway domains of every app. Update here when a domain changes.
const environments = [
  {
    name: "Producción",
    apps: [
      { name: "Clientes", url: "https://multifambank-armage.up.railway.app" },
      {
        name: "Administrador del banco",
        url: "https://admin-production-616d.up.railway.app",
      },
      {
        name: "Plataforma",
        url: "https://superadmin-production-151a.up.railway.app",
      },
    ],
  },
  {
    name: "Staging",
    apps: [
      { name: "Clientes", url: "https://client-staging-76ec.up.railway.app" },
      {
        name: "Administrador del banco",
        url: "https://admin-staging-8b23.up.railway.app",
      },
      {
        name: "Plataforma",
        url: "https://superadmin-staging-bc52.up.railway.app",
      },
    ],
  },
];

/** Public page with the address of each app in every environment. */
export function Links() {
  return (
    <AuthLayout appName="Accesos" title="Links">
      {environments.map((environment) => (
        <section key={environment.name}>
          <h2
            className={`mb-2 text-xs font-semibold tracking-wide uppercase ${environment.name === "Staging" ? "text-red-600" : "text-emerald-700"}`}
          >
            {environment.name}
          </h2>
          <ul className="flex flex-col gap-2">
            {environment.apps.map((app) => (
              <li key={app.url}>
                <a
                  href={app.url}
                  className="block rounded-xl border border-gray-100 px-4 py-3 hover:border-emerald-300 hover:bg-emerald-50"
                >
                  <span className="block text-sm font-semibold text-gray-900">
                    {app.name}
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {app.url.replace("https://", "")}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </AuthLayout>
  );
}
