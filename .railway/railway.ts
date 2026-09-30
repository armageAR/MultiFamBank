import { defineRailway, github, postgres, preserve, project, service, volume } from "railway/iac";

const region = "us-east4-eqdc4a";

// Frontends build from the repo root so they can resolve the pnpm workspace packages.
function frontend(name: "client" | "admin" | "superadmin", repo: ReturnType<typeof github>) {
  return service(name, {
    source: repo,
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

export default defineRailway((ctx) => {
  // Trunk-based flow: main deploys to staging; production only receives fast-forwards of main.
  // checkSuites makes Railway wait for GitHub CI to pass before deploying a commit.
  const branch = ctx.isEnvironment("production") ? "production" : "main";
  const repo = github("armageAR/MultiFamBank", { branch, checkSuites: true });

  const Postgres = postgres("Postgres", { region });
  Postgres.networking = { privateNetworkEndpoint: "postgres" };
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region, sizeMB: 5000 });

  const api = service("api", {
    source: repo,
    replicas: { [region]: 1 },
    rootDirectory: "/apps/api",
    build: { watchPatterns: ["/apps/api/**"] },
    // Retry so a sleeping staging database has time to wake up before migrations give up.
    preDeploy: "sh -c 'for i in 1 2 3 4 5 6 7 8 9 10; do php artisan migrate --force && exit 0; sleep 6; done; exit 1'",
    healthcheck: "/api/health",
    healthcheckTimeout: 120,
    env: {
      // Railpack runs `composer install`; this makes it skip require-dev.
      COMPOSER_NO_DEV: "1",
      APP_NAME: "MultiFamBank",
      APP_ENV: ctx.isEnvironment("production") ? "production" : "staging",
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
      // Frontend URLs used in email links (invitations, password resets).
      CLIENT_APP_URL: "https://${{client.RAILWAY_PUBLIC_DOMAIN}}",
      ADMIN_APP_URL: "https://${{admin.RAILWAY_PUBLIC_DOMAIN}}",
      SUPERADMIN_APP_URL: "https://${{superadmin.RAILWAY_PUBLIC_DOMAIN}}",
      // "log" until Resend is set up: emails go to the logs and the superadmin sees invitation links.
      // To deliver real emails: MAIL_MAILER "resend", add RESEND_API_KEY: preserve(), and set its value
      // with `railway variable set RESEND_API_KEY=... --service api`.
      MAIL_MAILER: "log",
      MAIL_FROM_ADDRESS: "onboarding@resend.dev",
      MAIL_FROM_NAME: "MultiFamBank",
      CORS_ALLOWED_ORIGINS:
        "https://${{client.RAILWAY_PUBLIC_DOMAIN}},https://${{admin.RAILWAY_PUBLIC_DOMAIN}},https://${{superadmin.RAILWAY_PUBLIC_DOMAIN}}",
    },
  });

  const services = [api, Postgres, frontend("client", repo), frontend("admin", repo), frontend("superadmin", repo)];

  // Staging sleeps when idle (Railway Serverless) and wakes on the first request.
  if (!ctx.isEnvironment("production")) {
    for (const node of services) node.deploy = { ...node.deploy, sleepApplication: true };
  }

  return project("MultiFamBank", {
    resources: [...services, postgresVolume],
  });
});
