# Restoration Shop ERP

Full-stack ERP for an automotive restoration shop: project management, flat
inventory, time tracking, progress billing, and department dashboards.

Plan: `.kilo/plans/1784938774840-restoration-shop-erp-plan.md`

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui (base-ui primitives)
- Prisma ORM 6 + PostgreSQL
- NextAuth.js v5: staff email/password + Google OAuth, customer magic-link portal
- Resend for transactional email (invoices, estimates, POs, magic-links)
- Docker Compose (Node app, Postgres, Nginx) for Cloud VPS deployment
- Vitest for unit tests, GitHub Actions CI

## Local development

1. Copy `.env.example` to `.env` and fill in values (a working `DATABASE_URL`
   pointing at a local or Docker Postgres instance is required).
2. Start Postgres, e.g. `docker compose up db -d`, or use the `.devcontainer`.
3. Install dependencies: `npm install --legacy-peer-deps`
   (`--legacy-peer-deps` is required due to a `valibot`/`@hookform/resolvers`
   peer conflict).
4. Run migrations: `npm run db:migrate`
5. Seed sample data (admin/manager/tech/parts/front-desk/customer users, a
   sample project, and a couple of parts): `npm run db:seed`
6. Start the dev server: `npm run dev`

Seeded staff logins (password `ChangeMe123!` for all):
`admin@example.com`, `manager@example.com`, `parts@example.com`,
`tech@example.com`, `frontdesk@example.com`. The seeded customer
(`customer@example.com`) has no password — request a portal magic link via
`POST /api/auth/customer-link` with `{ "email": "customer@example.com" }`
(logged to the console instead of emailed when `RESEND_API_KEY` is unset).

> Note: this environment did not have Docker/Postgres available to run
> migrations/seed end-to-end. An initial migration
> (`prisma/migrations/20260725000000_init`) was generated offline via
> `prisma migrate diff --from-empty` and the schema has been validated with
> `prisma validate`/`prisma generate`; the full app builds successfully
> (`npm run build`). Run `npx prisma migrate deploy` once a real Postgres
> instance is reachable.

### Security/ops notes

- New accounts (including self-registered Google OAuth sign-ins) are created
  **inactive** (`active: false`) by default. An Admin must activate them via
  `PATCH /api/users/[id]` (`{ "active": true }`) — list pending accounts with
  `GET /api/users` — before they can sign in anywhere. Seeded staff accounts
  are explicitly `active: true`.
- `docker-compose.yml` fails fast if `POSTGRES_USER`/`POSTGRES_PASSWORD`/
  `POSTGRES_DB`/`NEXTAUTH_SECRET` aren't set, and Postgres's port is bound to
  `127.0.0.1` only. A `migrate` one-off service applies pending Prisma
  migrations before `app` starts; `app` exposes `GET /api/health` for the
  Compose healthcheck that gates nginx.
- TLS certs are obtained via `docker compose --profile tls run --rm certbot`
  (see the commented HTTPS block in `docker/nginx.conf` for the follow-up
  step).

## What's implemented (Phase 1 + core of Phase 2)

- **Domain model** (`prisma/schema.prisma`): Customer → Vehicle → Project →
  JobPhase, TimeEntry, Part / PartConsumption, SpecialOrder /
  SpecialOrderItem, ProjectEstimate / EstimateLine, BillingCycle / Invoice /
  InvoiceLine / Payment, AuditLog, Notification, ShopSettings.
- **Auth & RBAC**: NextAuth v5 (`src/lib/auth.ts`) with a staff credentials
  provider, Google OAuth, and a customer magic-link credentials provider.
  `src/middleware.ts` + `src/lib/rbac.ts` gate `/dashboard/*` and `/portal/*`
  by role; every API route additionally calls `requireRole()` server-side.
- **Core CRUD APIs**: `/api/customers`, `/api/vehicles`, `/api/projects`,
  `/api/phases` (with role-scoped technician updates).
- **Time tracking**: `/api/time-entries` (manual entries),
  `/api/time-entries/start` (auto-stops any other running timer for that
  tech), `/api/time-entries/stop`, `/api/time-entries/active`. Tech
  dashboard (`/dashboard/technician`) has a live timer UI.
- **Inventory & parts**: `/api/parts`, `/api/part-consumptions` (auto-approves
  known SKUs with sufficient stock; flags unknown SKU/insufficient stock for
  manager approval via `/api/part-consumptions/[id]/approve|reject`),
  `/api/special-orders` (request → PO sent → delivered → transfer to
  inventory/return).
- **Quoting**: `/api/estimates` (mutable) + `/api/estimates/[id]/lines`;
  `GET /api/estimates/[id]` returns real-time estimated-vs-actual variance.
- **Billing**: `/api/billing-cycles` (attaches unbilled approved time/parts/
  special-order items dated within the window) and
  `/api/billing-cycles/[id]/generate-invoice` (hours × shop rate + parts +
  special orders − deposit, using project rate override or shop default).
  `/api/invoices/[id]/send` emails the customer + creates an in-app
  notification. `/api/payments` supports partial payments.
- **Dashboards**: role landing pages for Admin, Shop Manager, Parts Manager,
  Technician, Front Desk, and the Customer portal (`/portal`), plus an
  in-app notification bell (`GET/PATCH /api/notifications`).
- **Admin user management**: `/dashboard/admin/users` (backed by
  `GET/POST /api/users`, `PATCH /api/users/[id]`) — activate self-registered
  accounts and change roles.
- **Reporting** (`/dashboard/shop-manager/reports`): job profitability
  (estimated vs. actual), technician utilization (last 30 days), inventory
  valuation (cost basis + selling value), and receivables aging (current /
  31-60 / 61-90 / 90+ day buckets).
- **Unit tests** (`npm run test`, Vitest): pure billing/pricing math
  (`src/lib/billing.ts`) and time-entry hour calculation
  (`src/lib/time-entries.ts`) are extracted from the route handlers and unit
  tested — directly addressing the plan's "complex billing calculations
  cause invoice errors" risk.
- **Deployment**: `docker/Dockerfile` (dev + production standalone build),
  `docker-compose.yml` (Node app + Postgres + Nginx + migrate/certbot
  services), `docker/nginx.conf`, `.devcontainer/`, and
  `.github/workflows/ci.yml`.

## What's left (Phase 3 polish, per the plan)

- Audit log viewer UI (the `AuditLog` model and writes already exist).
- PWA/offline queue for time entries and part consumption with sync on
  reconnect.
- Email templates beyond the current plain-HTML sends.
- Production TLS (Let's Encrypt) wiring in `docker/nginx.conf` (scaffolded;
  run `docker compose --profile tls run --rm certbot` once a real domain
  exists, then uncomment the HTTPS server block).
- Automated Postgres backups to object storage.
- Playwright E2E coverage (Vitest unit coverage for billing/time-entry math
  is in place).
