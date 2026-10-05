import { defineRailway, github, postgres, preserve, project, service, volume } from "railway/iac";

const region = "us-east4-eqdc4a";

// Cloudflare Turnstile on the landing page's access form. Staging uses Cloudflare's published test
// keys (always pass); production's real keys live only in Railway.
const turnstileTestKeys = { site: "1x00000000000000000000AA", secret: "1x0000000000000000000000000000000AA" };

// Frontends build from the repo root so they can resolve the pnpm workspace packages.
function frontend(name: "client" | "admin" | "superadmin" | "landing", repo: ReturnType<typeof github>, environment: "production" | "staging") {
  const turnstile: Record<string, string | ReturnType<typeof preserve>> = name === "landing" ? { VITE_TURNSTILE_SITE_KEY: environment === "production" ? preserve() : turnstileTestKeys.site } : {};

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
      // Non-production builds get a red "S" favicon and a STAGING marker in the UI.
      VITE_APP_ENV: environment,
      ...turnstile,
    },
  });
}

export default defineRailway((ctx) => {
  // Trunk-based flow: main deploys to staging; production only receives fast-forwards of main.
  // checkSuites makes Railway wait for GitHub CI to pass before deploying a commit.
  const environment = ctx.isEnvironment("production") ? "production" : "staging";
  const branch = environment === "production" ? "production" : "main";
  const repo = github("armageAR/MultiFamBank", { branch, checkSuites: true });
  // The public FamBank page answers on its own domain in production (custom domain set in Railway).
  const landingOrigins = environment === "production" ? ",https://fambank.armage.tech" : "";
  // Production sends real email through Resend's SMTP; host, credentials and sender live only in
  // Railway. Staging logs emails and shows invitation links to the superadmin instead.
  const mail =
    environment === "production"
      ? {
          MAIL_MAILER: preserve(),
          MAIL_HOST: preserve(),
          MAIL_PORT: preserve(),
          MAIL_USERNAME: preserve(),
          MAIL_PASSWORD: preserve(),
          MAIL_ENCRYPTION: preserve(),
          MAIL_FROM_ADDRESS: preserve(),
        }
      : { MAIL_MAILER: "log", MAIL_FROM_ADDRESS: "onboarding@resend.dev" };

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
      // Web Push keys, one pair per environment (php artisan push:vapid-keys); values live only in Railway.
      VAPID_PUBLIC_KEY: preserve(),
      VAPID_PRIVATE_KEY: preserve(),
      VAPID_SUBJECT: preserve(),
      ...mail,
      MAIL_FROM_NAME: "MultiFamBank",
      // Access requests from the public page: recipient and mailer live only in Railway
      // ("smtp" in production, "log" in staging).
      ACCESS_REQUEST_NOTIFY_EMAIL: preserve(),
      ACCESS_REQUEST_MAILER: preserve(),
      TURNSTILE_SECRET_KEY: environment === "production" ? preserve() : turnstileTestKeys.secret,
      CORS_ALLOWED_ORIGINS:
        "https://${{client.RAILWAY_PUBLIC_DOMAIN}},https://${{admin.RAILWAY_PUBLIC_DOMAIN}},https://${{superadmin.RAILWAY_PUBLIC_DOMAIN}},https://${{landing.RAILWAY_PUBLIC_DOMAIN}}" +
        landingOrigins,
    },
  });

  const services = [api, Postgres, frontend("client", repo, environment), frontend("admin", repo, environment), frontend("superadmin", repo, environment), frontend("landing", repo, environment)];

  // Staging sleeps when idle (Railway Serverless) and wakes on the first request.
  if (!ctx.isEnvironment("production")) {
    for (const node of services) node.deploy = { ...node.deploy, sleepApplication: true };
  }

  return project("MultiFamBank", {
    resources: [...services, postgresVolume],
  });
});
