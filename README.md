# MultiFamBank

MultiFamBank is the next version of [FamBank](https://github.com/armageAR/fambank-public): a mobile-first family savings and expense ledger expanded into a multi-tenant platform.

Each family operates an independent **bank**, with its own administrator, clients, savings accounts, requests, and expense reports. Clients can belong to multiple banks, while a person can administer only one bank.

> **Project status:** The monorepo is deployed to Railway. Implemented so far: the full database schema, sign-in and password reset, the platform superadmin application (bank list, bank creation with an administrator invitation, and invitation resend), and invitation acceptance plus bank setup in the administrator application. Client features, requests, confirmations, and reports are planned, not implemented yet. The original FamBank repository contains the first working version.

In this project, “bank” means a private family ledger. MultiFamBank does not hold money, transfer funds, execute currency exchange, or provide banking services. Administrators record money received or delivered outside the application.

## Product overview

MultiFamBank distinguishes two sources of money:

- **Client savings:** money belonging to the client, tracked in USD. Clients can deposit money and request withdrawals.
- **Bank funds:** money provided by the bank administrator to cover a client's expense. Clients can request this money, but cannot deposit into this source. Confirmed requests do not reduce the client's savings.

For example, a client may request ARS for transportation using bank funds. The administrator can confirm that delivery as a bank expense, or change the source to client savings before confirming if the client should pay for it.

There are three separate interfaces, backed by one API and one central database:

| Application | Audience | Main responsibilities |
| --- | --- | --- |
| Client PWA | Clients of one or more banks | View savings, submit deposits and withdrawals, request bank-funded expenses, and review personal history. |
| Bank administrator PWA | Administrator of one bank | Manage clients, review requests, edit amounts and funding sources, confirm operations, and review reports. |
| Platform administration web app | The single FamBank superadmin | Create banks and their administrators, send administrator password-reset links, pause banks, and deactivate banks. |

The initial interface language is Spanish; project documentation is English.

## Identity and roles

- There is exactly **one platform superadmin**.
- Each bank initially has **one administrator**.
- A person can administer **at most one bank**.
- A person can be a client of **any number of banks**.
- A person may administer one bank and be a client of other banks.
- A user has one identity and password, identified by a unique normalized email address.
- Savings balances belong to a client's account **within a particular bank**, not to the global user.
- Bank permissions are enforced by the API. Separate applications do not replace authorization checks.
- The superadmin manages the platform; this role does not automatically authorize financial operations or savings changes inside a bank.

## Bank creation and administrator onboarding

Banks are created by the superadmin, not through public self-service registration.

1. The superadmin enters the administrator's basic information, primarily their email address.
2. The system checks whether that email is already assigned as a bank administrator, including a pending bank invitation.
3. If it is already assigned, the operation is rejected: no new bank, administrator assignment, or invitation is created.
4. Otherwise, the system creates a bank pending configuration and sends an administrator invitation by email.
5. The recipient follows the invitation URL, verifies control of the email address, and establishes a password if they are a new user. Existing users authenticate with their existing account.
6. The administrator completes the bank's information.
7. The bank becomes active, and the administrator can invite clients.

An existing client identity can become a bank administrator if it does not already administer another bank. This does not create a second identity.

Invitations expire, can be resent, and can be accepted only once. Resending an invitation must not create another bank or user. Bank deactivation does not automatically release the administrator's email for creation of another bank.

The superadmin can initiate an administrator password reset by email. Passwords are never exposed to the superadmin. Because credentials belong to the shared identity, resetting a password also changes that person's access to the client application.

## Client invitations and membership

1. A bank administrator enters the client's basic information and email.
2. The system sends an invitation associated with that bank.
3. If the email is new, the recipient completes registration and accepts the membership.
4. If the email already belongs to a client, the recipient signs in and accepts the new bank membership without registering again.
5. Once accepted, the bank appears in the client's application.

An existing identity must be reused even when it already has another role. Repeated invitations or membership acceptance must not create duplicate users, memberships, or savings accounts.

A client with one bank enters that bank directly. A client with multiple banks uses a bank selector. Balances, requests, history, and local offline data remain separate for each bank.

## Bank lifecycle

| State | Behavior |
| --- | --- |
| Pending configuration | The administrator must accept the invitation and complete bank setup before financial operations are available. |
| Active | Normal client and administrator operations are enabled. |
| Paused | Existing information remains readable, but new financial requests and confirmations are blocked. |
| Deactivated | Financial operations are blocked and historical records are retained. Deactivation is logical, not deletion of the ledger. |

The server checks bank status on every financial write, including synchronization of requests prepared offline. An offline request cannot bypass a pause or deactivation.

## Savings and bank-funded expenses

| Operation | Funding source | Currency entered | Effect when confirmed |
| --- | --- | --- | --- |
| Savings deposit | Client savings | ARS | Credits the client's USD savings account using the recorded exchange rate. |
| Savings withdrawal | Client savings | ARS | Debits the client's USD savings account using the recorded exchange rate. |
| Expense request | Bank funds | ARS | Records a bank-funded expense for that client; does not change their savings. |

Bank funds initially represent an expense source, **not a separate bank cash balance**. Treasury management is outside the initial scope.

Savings conversion follows the original FamBank approach: the API obtains the applicable exchange rate, calculates the USD equivalent, and stores the applied rate on the confirmed operation. Clients cannot submit an authoritative exchange rate. Administrators can adjust the rate during confirmation.

Amounts and rates must use decimal-safe representations, not floating-point balance calculations.

### Request details

Money requests include:

- Bank and client.
- Requested amount in ARS.
- Explicit funding source.
- Purpose or description.
- Expense category when applicable, such as transportation, food, education, health, leisure, or other.
- Creation date, current status, and confirmation date when applicable.

Funding ownership must be clear throughout forms, lists, details, confirmation screens, and notifications. Color can reinforce the distinction but cannot be the only indicator.

Suggested initial Spanish labels:

| Context | Client savings | Bank funds |
| --- | --- | --- |
| Client application | Mis ahorros | Dinero del banco |
| Administrator application | Ahorros del cliente | Dinero del banco |

No role or funding-source label depends on the word “dad” or a particular family relationship.

### Confirmation means money changed hands

Requests have four business states: **pending, confirmed, rejected, and canceled**.

- Confirming a withdrawal or bank-funded expense means the administrator has delivered the money.
- Confirming a deposit means the administrator has received the money.
- There is no separate “approved but not delivered” state.
- Clients can cancel pending requests.
- Administrators can reject pending requests.
- Administrators can also record and immediately confirm an operation on a client's behalf when it took place outside the request workflow.

### Administrator adjustments

Before confirming an outgoing request, the administrator can edit:

- The amount.
- The funding source: client savings or bank funds.
- The applicable exchange rate when using client savings.
- The category and description.

The ability to switch funding sources applies to outgoing money requests; it does not turn a savings deposit into a bank-funded deposit.

The original request and the final confirmed values must both be retained, including who changed them. Clients must be able to see when their requested source or amount changed.

Example: a client requests ARS 15,000 from bank funds for an outing. The administrator changes the source to client savings and confirms delivery. The USD equivalent is deducted from that client's account, and the operation is excluded from bank-funded expense totals.

### Balance integrity and reservations

The original FamBank reserves USD for pending savings withdrawals. MultiFamBank should preserve that protection while supporting funding-source changes:

- A server-accepted pending savings withdrawal reserves the corresponding USD amount.
- Pending deposits do not increase available savings.
- Pending bank-funded requests do not reserve client savings.
- Rejection or cancellation releases a savings withdrawal reservation.
- Switching from savings to bank funds releases the reservation atomically when the operation is confirmed.
- Switching from bank funds to savings requires an available-balance check and a debit at confirmation.
- Changing the amount or exchange rate requires recalculating the savings effect and validating available funds.
- Confirmation settles the reservation and records the final debit exactly once.

Confirmed balance, reserved amount, and available balance must be distinguishable. Confirmations and reservation changes must use database transactions and row locking around critical balance checks. Concurrent requests must not create a negative available balance or double debit.

## Reporting

Client history shows savings deposits, savings withdrawals, and bank-funded expenses with their source and status clearly identified.

Bank administrators can review:

- Monthly bank-funded expenses, grouped by client and category.
- The purpose and amount of each confirmed expense.
- Savings deposits and withdrawals, separately from bank-funded expenses.
- Pending requests separately from confirmed operations.

Monthly expense totals use the **confirmation date**, because confirmation records actual delivery. Savings withdrawals are never counted as expenses paid by the bank. Reporting periods should use the bank's configured timezone.

The platform panel handles bank lifecycle and administrator management rather than acting as a cross-bank financial dashboard.

## Offline operation and synchronization

The central API remains the authority for permissions, request acceptance, exchange rates, and balances. A phone does not act as the central server.

### Client PWA

Clients can:

- Open the application and view previously downloaded balances and history without a connection.
- Prepare requests offline.
- See which requests are pending synchronization.
- Synchronize when the application opens, connectivity returns, or the client explicitly requests synchronization.

An offline request is not approved, confirmed, or guaranteed to be accepted. Offline balances are snapshots and must display their last synchronization time. Any cached exchange-rate estimate is provisional.

“Pending synchronization” is a local delivery state, separate from the server-side business state “pending.” Offline requests do not create authoritative savings reservations until accepted by the server.

### Administrator PWA

The initial offline scope allows access to previously downloaded information. Request edits, confirmations, and other authoritative financial writes require connectivity.

### Synchronization rules

- Each locally created request receives a UUID.
- The API uses idempotency to prevent duplicate requests during retries.
- Synchronization validates the authenticated user, bank membership, bank status, available savings, and current request state.
- Rejected synchronization attempts remain visible with an actionable reason.
- Local storage and outgoing queues are partitioned by user and bank.
- Signing out clears private local data; another user must not inherit the previous user's cache.
- Financial writes cannot be silently replayed under another user or bank.
- Synchronization must not depend exclusively on background execution; browser and mobile operating-system support varies.

A paused or deactivated bank may leave locally prepared requests unsent or rejected. The application must explain that state instead of treating the requests as accepted.

## Intended architecture and stack

One shared API and PostgreSQL database serve three independently deployable frontends.

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Backend | PHP, Laravel 12, Laravel Sanctum | Authentication, invitations, tenant authorization, lifecycle rules, and financial operations. |
| Central database | PostgreSQL | Users, banks, memberships, accounts, requests, reservations, and ledger records. |
| Three frontends | React 19, TypeScript, Vite, React Router | Client PWA, administrator PWA, and superadmin web panel. |
| UI | Tailwind CSS | Shared visual components with role-specific workflows. |
| Server data | TanStack Query | Queries, cache management, and refresh behavior. |
| Local persistence | IndexedDB through Dexie | Offline snapshots and the client's outgoing request queue. |
| PWA | vite-plugin-pwa | Installable client and administrator applications and cached application assets. |
| API client | Axios | Shared HTTP integration with the Laravel API. |
| Email | Backend email delivery integration; provider to be selected | Invitations and password-reset links. |
| API documentation | Scribe | Documented endpoints and request contracts. |

The client and administrator PWAs have separate manifests, installation identities, and deployment URLs. The superadmin panel is an online web application without an offline requirement.

Native applications and app-store distribution are not required initially. Capacitor can be evaluated later if native capabilities are needed.

### Monorepo layout

| Path | Purpose |
| --- | --- |
| `apps/api/` | Shared Laravel API (Composer; not part of the pnpm workspace). |
| `apps/client/` | Client PWA. |
| `apps/admin/` | Bank administrator PWA. |
| `apps/superadmin/` | Platform administration web application. |
| `packages/api-client/` | Axios client, API endpoints and response types, error and token helpers. |
| `packages/auth/` | React session provider (`AuthProvider`, `useAuth`) shared by the frontends. |
| `packages/ui/` | Shared React components and Tailwind theme tokens. |
| `packages/offline/` | Dexie databases partitioned per user and bank, for snapshots and the outgoing request queue. |
| `.railway/railway.ts` | Railway infrastructure as code. |

Separate frontends should reuse common code without sharing inappropriate role-specific controls.

## Local development

Requirements: PHP 8.3+, Composer, Node.js 20.19+ (22 recommended), pnpm 10, and PostgreSQL.

```bash
pnpm install

cd apps/api
cp .env.example .env    # set DB_* for your local PostgreSQL
composer install
php artisan key:generate
php artisan migrate
php artisan serve       # http://localhost:8000
cd ../..

pnpm dev                # client :5173, admin :5174, superadmin :5175
```

Frontends read the API base URL from `VITE_API_URL` (default `http://localhost:8000`). The API allows the origins listed in `CORS_ALLOWED_ORIGINS`.

Other root scripts: `pnpm build`, `pnpm typecheck`, `pnpm lint`. API tests: `cd apps/api && php artisan test`.

## Deployment

Everything runs in one Railway project, defined in `.railway/railway.ts`:

| Service | Source | Notes |
| --- | --- | --- |
| `Postgres` | Railway PostgreSQL | Referenced by the API through `DB_URL`. |
| `api` | `apps/api` | Railpack (FrankenPHP). Runs migrations before each deploy; health check at `/api/health`. |
| `client`, `admin`, `superadmin` | Repository root | Built with `pnpm turbo run build --filter=…` and served as SPAs. `VITE_API_URL` points at the API domain. |

Each service has watch patterns so a change only redeploys the services it affects. Review infrastructure changes with `railway config plan` before `railway config apply` (evaluating the file requires Node.js 22+). The CLI applies the plan to the linked environment, so run it once per environment (`railway environment link staging`, then `production`).

### Environments and release flow

The project follows trunk-based development:

| Environment | Branch | Deploys when |
| --- | --- | --- |
| `staging` | `main` | A pull request is merged into `main` and CI passes. |
| `production` | `production` | `main` is promoted to `production` and CI passes. |

1. Work on a short-lived branch and open a pull request against `main`. CI (`.github/workflows/ci.yml`) runs API tests against PostgreSQL, Pint, and frontend lint, typecheck, and build.
2. Merge the pull request. Railway deploys `main` to staging after CI passes.
3. Once staging is verified, promote exactly that commit to production:

   ```bash
   git push origin main:production
   ```

   This only succeeds as a fast-forward. Do not commit directly to `production`.

Each environment has its own database, `APP_KEY`, and Railway domains. Staging services use Railway Serverless: they sleep after 5–10 minutes without traffic and wake on the next request, so the first request after a pause can be slow or return a 502.

### Platform superadmin

There is exactly one superadmin (enforced by a unique index). Create it once per environment:

```bash
php artisan superadmin:create armage@example.com "Full Name"
# On Railway:
railway ssh --service api --environment staging -- php artisan superadmin:create armage@example.com "Full Name"
```

The command prints a one-time link to the superadmin application to set the password (valid for 60 minutes), so the password never passes through the console, shell history, or environment variables. An existing identity with that email is promoted instead of duplicated.

### Email

Invitations and password resets are Laravel mailables and notifications. Delivery uses [Resend](https://resend.com) through Laravel's built-in `resend` mailer.

While `MAIL_MAILER=log` (the current setting, as in the original FamBank), emails are written to the logs and the API returns each new invitation link to the superadmin application, which shows it for manual sharing. To deliver real emails, in `.railway/railway.ts` set `MAIL_MAILER` to `"resend"`, add `RESEND_API_KEY: preserve()`, set the key with `railway variable set RESEND_API_KEY=... --service api`, and use a sender on a domain verified in Resend (`MAIL_FROM_ADDRESS`). Invitation links are no longer exposed once a real mailer is configured.

With `log`, password reset links also end up in the logs, so anyone with access to the Railway logs could reset any account, including the superadmin's. That is acceptable only while there are no real users; switch to Resend before inviting real families.

## Multi-tenant data model

The initial design uses a shared database with bank-scoped records rather than a separate database or deployment per family.

| Entity | Responsibility |
| --- | --- |
| Users | Global identity, normalized unique email, credentials, and profile. |
| Banks | Tenant identity, administrator assignment, lifecycle status, and configuration. |
| Bank memberships | A user's client membership in a bank, with membership status. |
| Savings accounts | A client's USD savings balance within one bank. |
| Invitations | Administrator onboarding or client membership invitations, with expiry and acceptance state. |
| Requests | Requested operation, source, amount, purpose, and business status. |
| Savings reservations | Funds reserved by pending savings withdrawals. |
| Ledger records | Confirmed savings movements and bank-funded expenses. |
| Audit records | Original and final values, responsible actor, and relevant lifecycle or financial changes. |

The schema lives in `apps/api/database/migrations`. The database enforces unique user emails, a single superadmin, one administrator per bank and one bank per administrator (`banks.admin_email` and `banks.admin_user_id` are unique, so pending invitations also reserve the email), one membership and savings account per bank and user, one reservation and one ledger entry per request, reservations never above the balance, and deposits never funded by the bank. Bank creation and invitation acceptance run in transactions with row locks.

Every bank-scoped API query and write must verify tenant access. Supplying another bank's ID must never grant access to its accounts, requests, reports, or notifications.

## Relationship to the original FamBank

The existing FamBank provides the starting point:

- USD savings balances with ARS deposits and withdrawals.
- Administrator review and exchange-rate adjustment.
- Pending withdrawal reservations.
- Transactional balance updates and critical row locking.
- Sign-in, profiles, password reset, and Laravel Sanctum authentication.
- Paginated history and pending-request cancellation.
- Administrator-created operations.
- PWA configuration, push subscription endpoints, API documentation, and health endpoints.

MultiFamBank adds or changes:

- Isolated banks and per-bank client accounts.
- One global identity with membership in multiple banks.
- Separate client, bank administrator, and platform administrator applications.
- Superadmin-controlled bank creation and lifecycle.
- Invitation-based administrator setup and client onboarding.
- Bank-funded expenses alongside client savings.
- Editable outgoing funding sources with an audit trail.
- Monthly expense reports.
- Explicit offline storage and request synchronization.

Existing push support can be adapted to bank-scoped request and confirmation notifications. The original Android Share Target configuration is not evidence of implemented receipt processing; receipt extraction remains outside the initial requirements.

If existing FamBank data is migrated, it must be assigned to an initial bank while preserving users, savings balances, transaction history, exchange rates, and pending reservations. Migration is an implementation task, not a completed feature.

## Implementation priorities

1. Establish the monorepo, shared API, identity model, and tenant isolation.
2. Implement superadmin bank creation, bank lifecycle, and administrator invitations.
3. Implement client invitations and multi-bank membership.
4. Adapt savings operations and reservations to bank-scoped accounts.
5. Add bank-funded requests, source changes, audit history, and reports.
6. Build the three role-specific interfaces.
7. Add client offline persistence and idempotent synchronization.
8. Validate tenant isolation, invitation reuse, concurrent balance operations, funding-source changes, and retry behavior.

Local development commands and deployment instructions will be added once application scaffolding exists. The original FamBank's Railway configuration is a starting reference, not a configured deployment for this repository.

## License

Apache License 2.0. See [LICENSE](LICENSE).
