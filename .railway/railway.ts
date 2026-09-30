import { defineRailway, postgres, preserve, project, service, volume } from "railway/iac";

const region = "us-east4-eqdc4a";

// Frontends build from the repo root so they can resolve the pnpm workspace packages.
function frontend(name: "client" | "admin" | "superadmin") {
  return service(name, {
    replicas: { [region]: 1 },
    build: {
      buildCommand: `pnpm turbo run build --filter=@multifambank/${name}`,
      watchPatterns: [`/apps/${name}/**`, "/packages/**", "/package.json", "/pnpm-lock.yaml", "/turbo.json"],
    },
    env: {
      RAILPACK_NODE_VERSION: "22",
      RAILPACK_SPA_OUTPUT_DIR: `apps/${name}/dist`,
      VITE_API_URL: "https://${{api.RAILWAY_PUBLIC_DOMAIN}}",
    },
  });
}

export default defineRailway(() => {
  const Postgres = postgres("Postgres", { region });
  Postgres.networking = { privateNetworkEndpoint: "postgres" };
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region, sizeMB: 5000 });

  const api = service("api", {
    replicas: { [region]: 1 },
    rootDirectory: "/apps/api",
    build: { watchPatterns: ["/apps/api/**"] },
    preDeploy: "php artisan migrate --force",
    healthcheck: "/api/health",
    healthcheckTimeout: 120,
    env: {
      APP_NAME: "MultiFamBank",
      APP_ENV: "production",
      APP_DEBUG: "false",
      APP_KEY: preserve(),
      APP_URL: "https://${{RAILWAY_PUBLIC_DOMAIN}}",
      APP_LOCALE: "es",
      APP_FALLBACK_LOCALE: "en",
      DB_CONNECTION: "pgsql",
      DB_URL: Postgres.env.DATABASE_URL,
      LOG_CHANNEL: "stderr",
      LOG_LEVEL: "info",
      SESSION_DRIVER: "database",
      CACHE_STORE: "database",
      QUEUE_CONNECTION: "database",
      CORS_ALLOWED_ORIGINS:
        "https://${{client.RAILWAY_PUBLIC_DOMAIN}},https://${{admin.RAILWAY_PUBLIC_DOMAIN}},https://${{superadmin.RAILWAY_PUBLIC_DOMAIN}}",
    },
  });

  return project("MultiFamBank", {
    resources: [api, Postgres, frontend("client"), frontend("admin"), frontend("superadmin"), postgresVolume],
  });
});
