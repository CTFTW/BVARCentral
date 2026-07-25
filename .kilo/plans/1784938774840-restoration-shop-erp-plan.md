# Restoration Shop ERP — Implementation Plan

## Context

Full-stack ERP for an automotive restoration shop: project management, flat inventory, time tracking, progress billing, and department dashboards. Built on open-source stack; self-host migration-ready.

## Decisions Locked

| Area | Decision |
|---|---|
| **Domain model** | Customer → Vehicle → Project → Job Phase (3-level hierarchy) |
| **Roles (6 + 1)** | Admin, Shop Manager, Parts Manager, Technician, Front Desk/Estimator, Customer (portal read-only) |
| **Auth** | Staff: email/password + Google OAuth (NextAuth.js). Customers: magic-link portal |
| **Inventory** | Flat SKU list. `costPrice` + default `sellingPrice` per SKU, overrideable per consumption/invoice |
| **Parts consumption** | `PartConsumption` state machine: Pending → Approved/Rejected. Manager approval required for insufficient stock or unknown SKUs |
| **Special orders** | PO creation → delivery confirmation → transfer to inventory or return |
| **Shop rate** | Global default with per-project override; rate applied at billing time |
| **Billing** | Progress billing, itemized per cycle: (chargeable hours × rate) + inventory parts + special-order parts |
| **Estimates** | Mutable open estimate with estimated vs. actual variance tracking |
| **Notifications** | Email for external events (invoices, estimates, POs) + in-app for internal (approvals, phase updates, alerts) |
| **Deployment** | Dockerized for Cloud VPS (Fly.io / DigitalOcean); self-host migration-ready |
| **Stack** | Next.js 14 + shadcn/ui + Prisma + PostgreSQL + NextAuth.js + PWA |
| **Tenancy** | Single location |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 App Router, React, shadcn/ui, Tailwind CSS |
| Backend | Next.js Route Handlers (App Router), Prisma ORM |
| Database | PostgreSQL (single-tenant, single-schema) |
| Auth | NextAuth.js v5 (email/password + Google Credentials provider + email magic-link for customers) |
| Hosting | Cloud VPS via Docker Compose (Nginx reverse proxy, Node/Next.js server, PostgreSQL). Fly.io or DigitalOcean as first choice. |
| PWA | next-pwa wrapper for offline time-entry fallback |
| Email (transactional) | Resend (open source friendly, HTTP API, no SMTP config) |
| Testing | Vitest (unit), Playwright (E2E), Prisma test database |

## Implementation Phases

### Phase 1: Foundation (Week 1–2)
Goal: Repo scaffolded, DB schema v1, auth working, DevContainer, Docker deployment.

1. Initialize Next.js 14 project with TypeScript, Tailwind, ESLint
2. Install and configure shadcn/ui base components
3. Configure Prisma with PostgreSQL connection
4. Implement Authentication (NextAuth.js)
   - Email/password credentials provider for staff
   - Google OAuth provider
   - Magic-link provider for customers
   - Role assignment on signup / via Admin panel
5. Implement RBAC middleware: server-side role checks on every API route
6. Create DevContainer config (VS Code + Postgres + Node)
7. Docker Compose: Node/Next.js, PostgreSQL, Nginx
8. CI/CD: build + test + deploy pipeline (GitHub Actions or equivalent)

### Phase 2: Core Features (Week 3–5)
Goal: Projects, time tracking, inventory, billing, quoting all functional.

#### 2a. Projects & Phases
1. `Customer`, `Vehicle`, `Project`, `JobPhase` CRUD with relations
2. Tech dashboard: list all active projects/phases, start/stop timer
3. Active timer auto-stops on new timer start
4. Shop Manager dashboard: phase scheduling, status updates, assignment

#### 2b. Time Tracking
1. `TimeEntry` model: supports timer (`startTime`/`endTime`) and manual entry (`workDate` + `manualHours`)
2. Hybrid timer UI: running timer visible, start/stop buttons
3. Front-end: timer persists to local state; if app crashes, entry preserved for manual completion
4. Back-end: validate time entries per billing cycle on invoice generation

#### 2c. Inventory & Parts
1. `Part` CRUD (SKU, description, costPrice, sellingPrice, quantity, reorderThreshold, location)
2. `SpecialOrder` lifecycle: creation → PO sent → delivery confirmation → transfer to inventory or return
3. `PartConsumption` model:
   - Created by technician (scan/SKU + quantity + assigned phase)
   - If stock sufficient → auto Pending → awaiting manager approval → Approved
   - If stock insufficient or SKU unknown → Pending, flagged, requires shop manager approval
   - On Approval → inventory qty deducted, `sellingPriceLockedAt` recorded (for rate-at-billing)
   - Rejection → no inventory change, tech notified
4. Parts Manager dashboard: approval queue, inventory alerts, PO tracking

#### 2d. Quoting
1. `ProjectEstimate` (mutable) line items: chargeable, parts, special orders
2. Estimated vs. actual variance calculation with real-time update on time entry / part consumption
3. Front Desk: create/edit estimates, attach approval signature workflow (simplified: customer email confirmation)

#### 2e. Billing
1. `BillingCycle` model: associated to project, start/end date, invoiced flag
2. `Invoice` generation:
   - Chargeable hours from approved `TimeEntry` in cycle × applicable shop rate
   - Approved `PartConsumption` in cycle at `sellingPriceLockedAt` (or override)
   - Approved `SpecialOrder` items delivered in cycle
   - Deposit applied if configured
   - Line-item breakdown per phase
3. Invoice delivery: email (Resend) + in-app notification to customer portal
4. `Payment` tracking: method, amount, date; partial payments allowed
5. Front Desk dashboards: outstanding invoices, payment history

### Phase 3: Dashboards, Polish, Deployment (Week 6–8)
Goal: Role dashboards, reporting, PWA polish, production deployment.

1. Admin dashboard: user management, role management, system settings, audit log
2. Shop Manager dashboard: WIP across all projects, phase bottlenecks, profitability preview
3. Parts Manager dashboard: low-stock alerts, PO aging, incoming deliveries
4. Technician dashboard: my active timers, my recent entries, my assigned phases
5. Front Desk dashboard: estimates awaiting approval, invoices outstanding, customer list
6. Customer portal: vehicle progress timeline, invoice history, current balance, document download
7. Reporting:
   - Job profitability report (estimated vs. actual cost per project/phase)
   - Technician utilization report
   - Inventory valuation (cost basis)
   - Outstanding receivables aging
8. PWA: offline queue for manual time entries / part consumption; sync on reconnect
9. Email templates: invoice, estimate approval, PO confirmation, password reset
10. Production deployment to Cloud VPS; TLS via Let's Encrypt
11. Automated backups: PostgreSQL dumps to object storage
12. Load & smoke testing, performance profiling

## Database Schema (v1 — Prisma)

```prisma
// See annotated schema in Phase 2 task execution
```

## Validation / Acceptance Criteria

- [ ] Tech can start/stop timer on any phase; active timer stops on new start
- [ ] Tech can add parts by SKU scan or manual entry
- [ ] Part consumption with insufficient stock triggers manager approval flow
- [ ] Invoice correctly itemizes: hours × rate + approved parts + approved special orders
- [ ] Estimate variance updates in real time as hours and parts are consumed
- [ ] Customer receives email invoice; views balance in portal
- [ ] Shop Manager sees WIP across all projects
- [ ] All role-based route checks enforced server-side
- [ ] Full offline time-entry on tablet with sync on reconnect
- [ ] Automated encrypted backup + tested restore

## Risks

| Risk | Mitigation |
|---|---|
| Complex billing calculations cause invoice errors | Unit tests on pricing/combinatorics; integration tests with seed data |
| Special-order invoice integration misses deliveries | Explicit join contract between delivery confirmation and billing cycle lookup |
| Offline sync conflicts | Simple conflict resolution: server wins for time entries; last-write-wins acceptable for manual entries |
| Time-entry tampering / audit gaps | Immutable `createdAt`/`updatedAt`; route-level audit log table for state changes |
| Inventory discrepancy from consumption timing | Weekly cycle-close reconciliation report; phantom stock alerts |

## Out of Scope (Phase 1)

- Multi-location support
- Serialized / kit / assembly parts tracking
- Mobile push notifications
- Advanced accounting integrations (QuickBooks, Xero)
- Payroll / HR modules
- Vendor portal / supplier management
- Customer escalation / complaint ticketing

## Migration Notes for Implementation

- Start with a `001_initial_schema.prisma` migration
- Add `002_project_estimate.prisma`, `003_part_consumption.prisma` in sequence
- Seed admin user via migration or seed script
- All env vars documented in `.env.example`
