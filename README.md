# SkyPanelV2

[zread](https://zread.ai/gvps-cloud/skypanelv2)
[CodeRabbit Pull Request Reviews](https://coderabbit.ai)
[TypeScript](https://www.typescriptlang.org/)
[React](https://react.dev/)
[Node.js](https://nodejs.org/)
[Vite](https://vitejs.dev/)
[PostgreSQL](https://www.postgresql.org/)
[Express](https://expressjs.com/)

## 🚀 GVPS Cloud Internal Management Platform

**SkyPanelV2** is the proprietary full-stack VPS management and billing platform powering **GVPSCloud's** Linode VPS reselling business. It provides a complete customer portal, admin dashboard, automated hourly billing, real-time SSH console access, multi-tenant organization management, and integrated support ticketing — all in a single deployable application.

> **⚠️ Internal Use Only**: This is a proprietary business system for gvpscloud operations. This documentation is intended for our internal development team and authorized personnel only.

> **📖 Agent & AI References**: See `[AGENTS.md](./AGENTS.md)` for coding agent guidance and `[CLAUDE.md](./CLAUDE.md)` for Claude Code-specific development instructions.

---

## 📋 Table of Contents

- [System Overview](#-system-overview)
- [High-Level Architecture](#-high-level-architecture)
- [Application Flow Diagrams](#-application-flow-diagrams)
- [Frontend Architecture](#-frontend-architecture)
- [Backend Architecture](#-backend-architecture)
- [Database Schema](#-database-schema)
- [Core Features](#-core-features)
- [Security Architecture](#-security-architecture)
- [Development Setup](#-development-setup)
- [Deployment](#-deployment)
- [Testing](#-testing)
- [Project Structure](#-project-structure)
- [Technical Documentation](#-technical-documentation)

---

## 🏗️ System Overview

### What is SkyPanelV2?

SkyPanelV2 is gvps-cloud's complete business operations platform for managing our Linode VPS reselling business. The platform is split into three distinct product surfaces:


| Surface              | Description                                                                     | Users               |
| -------------------- | ------------------------------------------------------------------------------- | ------------------- |
| **Public Marketing** | Home, pricing, FAQ, about, contact, status, legal pages                         | Anonymous visitors  |
| **Customer Portal**  | Dashboard, VPS management, billing, support, SSH console, organizations         | Authenticated users |
| **Admin Dashboard**  | User management, billing ops, platform settings, provider config, impersonation | Admin users         |


### Revenue Model

```
Linode Base Cost  →  Admin Markup (per plan)  →  Customer Hourly Rate
Example: $0.0075/hr  →  +$0.0068/hr markup  →  $0.0143/hr to customer
         ($5.00/mo)     (+$5.00/mo)             ($10.00/mo)
```

Billing is **hourly** — charges are deducted from the organization's prepaid wallet every hour via an automated cron scheduler. Customers fund their wallets through PayPal.

---

## 🏛️ High-Level Architecture

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ High-Level Architecture                                                    │
├────────────────────────────────────────────────────────────────────────────┤
│ Browser Client                                                             │
│   • React 18 SPA (TypeScript + Vite)                                       │
│   • xterm.js SSH terminal                                                  │
│                                                                            │
│ Frontend Layer                                                             │
│   • React Router v7 (route guards)                                         │
│   • TanStack Query (server state)                                          │
│   • Zustand (client state)                                                 │
│   • shadcn/ui + Tailwind component system                                  │
│                                                                            │
│ Backend API Layer (Express.js)                                             │
│   • Middleware stack: auth, CORS, Helmet, rate limiting                    │
│   • Route handlers serving REST endpoints                                  │
│   • Service layer for business logic                                       │
│   • Billing cron scheduler                                                 │
│                                                                            │
│ Data & External Services                                                   │
│   • PostgreSQL primary database                                            │
│   • WebSocket server for SSH bridge                                        │
│   • Linode/Akamai API for infrastructure                                   │
│   • PayPal REST API for payments                                           │
│   • Email providers (Resend · SMTP)                                        │
│   • PG LISTEN/NOTIFY for real-time events                                  │
│                                                                            │
│ Key Flows                                                                  │
│   SPA → Router → TanStack Query → Middleware → Routes → Services            │
│   SPA (SSE) ← PG ← Services                                                │
│   SPA (WebSocket) ↔ WS ↔ Linode (SSH2)                                     │
│   Services ↔ PostgreSQL / Linode / PayPal / Email                          │
│   Cron → Services for hourly billing                                       │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Application Flow Diagrams

### User Authentication Flow

```text
USER AUTHENTICATION FLOW
-----------------------------------------------------------------------------
1. Browser → Frontend: load /login
2. Frontend → API /api/auth/login: { email, password }
3. API → PostgreSQL: lookup user by email
4. API: bcrypt.compare(password, hash)
5. If user has 2FA:
     a. API → Frontend: { requires2FA: true, tempToken }
     b. Frontend → Browser: render OTP input
     c. Browser → Frontend: submit code
     d. Frontend → API /api/auth/verify-2fa: { tempToken, code }
     e. API: verify TOTP via otplib
6. API: jwt.sign({ userId, role })
7. API → Frontend: { token, user }
8. Frontend: AuthContext.setUser(), redirect to /dashboard

REGISTRATION FLOW (parallel path)
-----------------------------------------------------------------------------
1. Browser → Frontend: load /register
2. Frontend → API /api/auth/register: { email, password, name }
3. API → PostgreSQL: INSERT users
4. API → PostgreSQL: INSERT organizations (auto-create)
5. API → PostgreSQL: INSERT wallets (balance 0)
6. API → Email Service: send welcome email
7. API → Frontend: 201 { token, user }
```

### VPS Provisioning Flow

```text
VPS PROVISIONING FLOW
-----------------------------------------------------------------------------
1. User → Frontend: click "Create VPS"
2. Frontend → API /api/vps/providers
   • API queries service_providers (active = true)
   • Response: providers + allowed regions
3. Frontend → API /api/vps/plans?provider_id
   • API fetches vps_plans for provider
   • Response: plan specs with base + markup pricing
4. Frontend → API /api/vps/images?provider_id
   • API delegates to ProviderService → LinodeProviderService → Linode API /v4/images
   • Response: normalized image catalog
5. User configures plan/region/OS/password/SSH keys in UI
6. Frontend → API /api/vps (POST body with configuration)
7. API → DB: ensure wallet balance ≥ hourly rate
8. API → ProviderService → Linode API: create instance
   • Linode returns instance id + provisioning status
9. API → DB: insert vps_instances record
10. API → BillingService: billVPSCreation()
    • Billing service deducts first hour and records payment transaction
11. API → Frontend: 201 { instance }
12. Frontend → User: redirect to /vps/:id detail
```

### Hourly Billing Cycle

```text
HOURLY BILLING CYCLE (runs every 60 minutes)
-----------------------------------------------------------------------------
1. Scheduler → BillingService: runHourlyBilling()
2. BillingService → DB: fetch active VPS instances with last_billed_at ≤ 1 hour ago
3. For each instance:
     a. Load plan pricing (base + markup + backup)
     b. Compute hours elapsed and totalAmount = hourlyRate × hours
     c. Fetch wallet balance
     d. If balance sufficient:
          • Deduct wallet funds via PayPalService helper
          • Record payment_transactions entry
          • Insert vps_billing_cycles row (status: billed)
          • Update vps_instances.last_billed_at = NOW()
        Else (insufficient):
          • Insert vps_billing_cycles row (status: failed)
          • Emit warning for potential suspension
4. BillingService → Scheduler: summary { billedInstances, totalAmount, failures }
```

### SSH Console Access Flow

```text
SSH CONSOLE ACCESS FLOW
-----------------------------------------------------------------------------
1. Browser (xterm.js) → WebSocket Server: ws://host/api/vps/:id/ssh?token=JWT&rows=x&cols=y
2. WebSocket Server → Auth module: verify JWT and membership
3. Auth module → DB: fetch user + org membership → return success to WS server
4. WS server → DB: load vps_instance (IP + encrypted password) scoped to user org
5. WS server: decrypt stored credentials
6. WS server → SSH2 client: connect(host IP, root credentials)
7. SSH2 client ↔ VPS: TCP handshake on port 22 until ready
8. WS server → SSH2: open shell (term = xterm-256color, rows/cols as requested)
9. WS server → Browser: send { type: connected }
10. Interactive loop:
      • Browser inputs → WS server → SSH stream write
      • VPS output → SSH stream → WS server → Browser display
11. Resizes: Browser sends { rows, cols } → WS server → SSH stream.setWindow()
```

### Real-Time Notification Flow

```text
REAL-TIME NOTIFICATION FLOW
-----------------------------------------------------------------------------
1. User/system action → ActivityLogger.logActivity(event_type, entity, message)
2. ActivityLogger → DB: INSERT activity_logs row
3. DB trigger notify_new_activity() publishes payload via PG LISTEN/NOTIFY
   • Only fires for user-relevant events (vps.create, vps.boot, auth.login, etc.)
4. NotificationService listens on channel:
   • Receives payload, emits internal "notification" event
   • Streams payload to SSE endpoint subscribers
5. Browser connected to SSE endpoint receives event → updates badge/feed
```

### Organization & Multi-Tenancy Flow

```text
ORGANIZATION & MULTI-TENANCY MODEL
-----------------------------------------------------------------------------
User Account
  • Fields: id, email, role
  • Relationships: owns an organization, belongs to many via memberships

Organization (Tenant)
  • Attributes: id, name, slug, owner_id
  • Associated records: wallet (balance, currency), custom roles (permissions JSONB)

Membership Roles
  • Owner – full access
  • Admin – elevated access
  • Member – limited access

Org-Scoped Resources
  • VPS instances, SSH keys, support tickets, invoices, billing cycles, payment transactions

Invitations
  • Email + token + intended role; accepted via /organizations/invitations/:token

Relationship Summary
  • User owns Organization and may belong to multiple via Memberships
  • Organization links to Wallet, Roles, Members, Invitations, and all scoped resources
  • Members gain permissions derived from their role definitions
```

### Payment & Wallet Flow

```text
PAYMENT & WALLET FLOW
-----------------------------------------------------------------------------
1. User → Frontend: click "Add Funds" ($50)
2. Frontend → API /api/payments/create-order { amount: 50 }
3. API → PayPalService → PayPal REST API: create order → returns ORDER-123
4. PayPalService → Frontend: orderId for checkout
5. Frontend → User: show PayPal popup → user approves via PayPal UI
6. PayPal SDK → Frontend: onApprove callback fires
7. Frontend → API /api/payments/capture-order { orderId: ORDER-123 }
8. API → PayPalService → PayPal REST API: capture order → status COMPLETED
9. PayPalService → DB: increment wallet balance by $50 and insert payment_transactions row
10. API → Frontend: success + new balance → UI confirms funds added
11. Hourly billing cron later deducts usage fees from the wallet automatically
```

---

## 🖥️ Frontend Architecture

### Technology Stack


| Technology                | Purpose                                                   |
| ------------------------- | --------------------------------------------------------- |
| **React 18**              | Component-based UI framework                              |
| **TypeScript**            | Type-safe development                                     |
| **Vite**                  | Build tool and HMR dev server                             |
| **React Router v7**       | Client-side routing with route guards                     |
| **TanStack Query**        | Server state management with caching & optimistic updates |
| **Zustand**               | Lightweight client state management                       |
| **shadcn/ui**             | Accessible component library (Radix UI primitives)        |
| **Tailwind CSS**          | Utility-first styling                                     |
| **React Hook Form + Zod** | Form validation with schema-based validation              |
| **Framer Motion**         | Animations and transitions                                |
| **Recharts**              | Data visualization and charts                             |
| **xterm.js**              | Browser-based terminal emulator                           |
| **cmdk**                  | Command palette (Ctrl/Cmd + K)                            |


### Route Map

```text
FRONTEND ROUTE MAP
-----------------------------------------------------------------------------
Public (no auth)
  /           /pricing    /faq        /about
  /contact    /status     /terms      /privacy
  /docs       /docs/:categorySlug/:articleSlug
  /regions

Auth (redirect if logged in)
  /login      /register   /forgot-password   /reset-password

Protected (auth required)
  /dashboard              /vps              /vps/:id
  /ssh-keys               /organizations    /organizations/:id
  /billing                /billing/invoice/:id
  /billing/transaction/:id
  /billing/payment/success   /billing/payment/cancel
  /egress-credits
  /support                /settings         /activity
  /api-docs

Admin (admin role)
  /admin       /admin/user/:id

Invitation
  /organizations/invitations/:token
```

> ★ SSH access now launches from the VPS detail page (`/vps/:id`, or deep-linked with `/vps/:id?tab=ssh`) using an in-page modal terminal.

### React Context Providers

```text
REACT CONTEXT PROVIDER STACK (nesting order)
-----------------------------------------------------------------------------
QueryClientProvider (TanStack Query)
  ↓ ThemeProvider (theme presets, dark/light)
    ↓ AuthProvider (JWT token, user state, logout)
      ↓ ImpersonationProvider (admin acting-as state)
        ↓ BrowserRouter (React Router)
          ↓ AppRoutes
```

### Key Frontend Components


| Directory                       | Contents                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/components/ui/`            | Base shadcn/ui primitives (Button, Dialog, Input, Table, etc.)                                     |
| `src/components/admin/`         | Admin dashboard panels (UserManagement, VPSPlanWizard, CategoryManager, RateLimitMonitoring, etc.) |
| `src/components/VPS/`           | VPS creation wizard steps, SSH terminal, provider/region selectors, backup config                  |
| `src/components/billing/`       | Payment forms, transaction history, invoice views, PurchaseEgressCreditsDialog                     |
| `src/components/support/`       | Ticket creation, conversation threads, status management                                           |
| `src/components/organizations/` | Org management, member lists, invitation flows                                                     |
| `src/components/settings/`      | User profile, 2FA setup, API key management                                                        |
| `src/components/Dashboard/`     | Dashboard widgets, stats cards, activity summaries                                                 |
| `src/components/layouts/`       | Page layout wrappers                                                                               |


---

## ⚙️ Backend Architecture

### Technology Stack


| Technology              | Purpose                                            |
| ----------------------- | -------------------------------------------------- |
| **Express 4**           | HTTP framework with middleware pipeline            |
| **TypeScript (ESM)**    | Type-safe backend with ES module imports           |
| **PostgreSQL**          | Relational database with UUID PKs, JSONB, triggers |
| **JWT (jsonwebtoken)**  | Stateless authentication tokens                    |
| **bcryptjs**            | Password hashing                                   |
| **ssh2**                | SSH protocol client for terminal bridge            |
| **ws**                  | WebSocket server for SSH bridge                    |
| **Helmet**              | Security headers                                   |
| **express-rate-limit**  | Tiered rate limiting                               |
| **Handlebars**          | Email template rendering                           |
| **nodemailer + Resend** | Email delivery with provider fallback              |


### API Route Map

```text
API ROUTE MAP (grouped)
-----------------------------------------------------------------------------
Core
  /api/auth, /api/vps, /api/payments, /api/organizations,
  /api/support, /api/ssh-keys, /api/invoices, /api/egress, /api/api-keys

Activity & Notifications
  /api/activity, /api/activities, /api/notifications

Content & Configuration
  /api/faq, /api/contact, /api/theme, /api/pricing, /api/health,
  /api/documentation, /api/announcements

Admin Surface
  /api/admin, /api/admin/platform, /api/admin/billing,
  /api/admin/email-templates, /api/admin/contact,
  /api/admin/faq, /api/admin/github, /api/admin/category-mappings,
  /api/admin/ssh-keys, /api/admin/documentation,
  /api/admin/networking, /api/admin/announcements
```

**Core Routes:**

- `/api/auth` — login, register, 2FA, password reset
- `/api/vps` — CRUD, actions, providers, plans, images
- `/api/payments` — PayPal orders, wallet, capture
- `/api/organizations` — CRUD, members, invitations, roles
- `/api/support` — tickets, replies
- `/api/ssh-keys` — CRUD, Linode sync
- `/api/invoices` — list, detail, PDF

**Activity & Notifications:**

- `/api/activity` — user activity feed
- `/api/activities` — activity logging
- `/api/notifications` — SSE stream, mark read

**Content & Config:**

- `/api/faq` — public FAQ content
- `/api/contact` — contact form submission
- `/api/theme` — theme presets
- `/api/pricing` — public pricing data
- `/api/health` — health check

**Admin Routes (`/api/admin/`*):**

- `/api/admin` — users, stats, impersonation
- `/api/admin/platform` — platform settings
- `/api/admin/billing` — billing management
- `/api/admin/email-templates` — email template CRUD
- `/api/admin/contact` — contact messages
- `/api/admin/faq` — FAQ management
- `/api/admin/github` — GitHub integration
- `/api/admin/category-mappings` — white-label categories
- `/api/admin/ssh-keys` — admin SSH key management
- `/api/admin/documentation` — documentation article CRUD
- `/api/admin/networking` — rDNS and IPv6 networking config
- `/api/admin/announcements` — platform announcements

### Middleware Pipeline

```text
MIDDLEWARE PIPELINE
-----------------------------------------------------------------------------
Incoming Request
  → Helmet
  → CORS
  → Body parsers (JSON + URL-encoded)
  → Smart rate limiter (API routes only)
  → Rate-limit headers
  → Express router
      ↳ Per-route stack: authenticateToken → checkPermission → impersonation → express-validator → handler
```

### Service Layer Architecture

```text
SERVICE LAYER ARCHITECTURE
-----------------------------------------------------------------------------
HTTP Route Handlers (auth.ts, vps.ts, payments.ts, organizations.ts, support.ts)
   ↓ delegate to
Service Layer (authService, linodeService, billingService, paypalService,
              emailService, activityLogger, notificationService, invoiceService,
              themeService, categoryMappingService, transferBillingService, etc.)

Service Layer depends on:
  • Provider abstraction: ProviderFactory → IProviderService → LinodeProviderService/BaseProviderService
  • Shared libraries: database.ts, crypto.ts, providerTokens.ts, whiteLabel.ts, validation.ts
  • Background workers: BillingCronService (24h reminders), Hourly Scheduler, NotificationService (LISTEN/NOTIFY)
```

### Provider Architecture (Linode)

```text
PROVIDER ARCHITECTURE (LINODE)
-----------------------------------------------------------------------------
Database tables
  • service_providers: id, name, type='linode', encrypted API key, allowed regions
  • provider_region_overrides: provider_id + region filters

Factory Flow
  service_providers record → normalizeProviderToken() → ProviderFactory.create(type, token)

Provider Interface (IProviderService)
  createInstance, getInstance, listInstances, performAction,
  getPlans, getImages, getRegions, validateCredentials

Implementation
  ProviderFactory returns LinodeProviderService which wraps linodeService
  • Makes REST calls to api.linode.com/v4
  • Maintains in-memory cache for plans/images/regions
  • Applies provider_region_overrides filtering on regions
```

---

## 🗄️ Database Schema

### Entity Relationship Diagram

```text
DATABASE ENTITY OVERVIEW (selected tables)
-----------------------------------------------------------------------------
users (PK uuid)
  email (unique), password_hash, name, role, phone, timezone, preferences JSONB,
  reset_token/expires, two_factor fields, active_organization_id (FK)

organizations (PK uuid)
  name, slug (unique), owner_id (FK), settings JSONB, website, address, tax_id

organization_members (PK uuid)
  organization_id (FK), user_id (FK), role (owner/admin/member), role_id (FK)

organization_roles (PK uuid)
  organization_id (FK), name, permissions JSONB, is_default

organization_invitations (PK uuid)
  organization_id, email, token (unique), role, status, invited_by

wallets (PK uuid)
  organization_id, balance, currency

vps_instances (PK uuid)
  organization_id, plan_id, provider_instance_id, label, status, ip_address,
  configuration JSONB, last_billed_at, provider_type, provider_id, backup_frequency,
  created_by

vps_plans (PK uuid)
  name, provider_plan_id, provider_id, base_price, markup_price, specifications JSONB,
  active flag, backup pricing/upcharge columns, type_class

vps_billing_cycles (PK uuid)
  vps_instance_id, organization_id, billing period start/end, hourly_rate,
  total_amount, status, payment_transaction_id, metadata JSONB

payment_transactions (PK uuid)
  organization_id, amount, currency, payment_method/provider, provider_transaction_id,
  status, description, metadata

support_tickets / support_ticket_replies
  ticket fields (subject, message, status, priority, category, has_staff_reply),
  replies reference ticket_id + user_id with is_staff_reply flag

service_providers (PK uuid)
  name, type, encrypted API key, configuration JSONB, active flag, allowed_regions, display_order

activity_logs / activity_feed
  activity_log rows link to user_id (nullable), organization_id, event_type, entity, status, metadata

user_ssh_keys / user_api_keys
  SSH keys scoped to organization; API keys scoped to user with hashed values + permissions JSONB

platform_settings & email_templates
  key/value JSONB pairs and template definitions

invoices (PK uuid)
  organization_id, amount, status

Relationship highlights
  • users own organizations and belong via organization_members
  • organizations link to wallets, vps_instances, tickets, payments, billing cycles, SSH keys, invoices
  • vps_plans define vps_instances; service_providers supply plans and host instances
  • tickets have many replies; users create activity_logs and user_api_keys
```

### Migration History

The database schema is managed through **51 sequential SQL migrations** in the `migrations/` directory:


| Migration | Description |
| --------- | ----------- |
| `001` | Initial schema — users, orgs, wallets, VPS, tickets, plans, payments, providers, activity logs, billing cycles, SSH keys, FAQ, contact, platform settings |
| `002` | Relax activity_logs constraint |
| `003` | Remove legacy container artifacts |
| `004` | Add VPS notes |
| `005` | Drop PaaS tables |
| `006` | Add 2FA columns to users |
| `007` | Add VPS plan type/class and regions |
| `008` | Add VPS category mappings (white-label) |
| `009–010` | Add VPS reference and snapshot to support tickets |
| `011–015` | Organization roles, invitations, activity feed, role assignments, default role seeding |
| `016–018` | Billing view permission adjustments, remove pending from payment_transactions, add created_by to VPS instances |
| `019–022` | Active organization for users, email templates, theme preset normalization, billing view admin role |
| `023–024` | Migrate SSH keys to org scope, add created_by |
| `025–033` | Egress billing system — tables, pricing, credits, permissions, config, adjustments |
| `034` | Region display labels |
| `035` | Egress FAQ items |
| `036–045` | Documentation system — creation, seeding, comprehensive docs, branding fixes, deduplication |
| `046` | Scrub Linode references from documentation |
| `047` | FAQ dedup and unique constraint |
| `048` | Add RLS to billing/egress tables |
| `049` | Fix org role migration for unknown roles |
| `050` | Create announcements system |
| `051` | Add low-balance email template |


---

## ✨ Core Features

### 🖥️ VPS Management

- **Linode API Integration** — Direct provisioning via the `IProviderService` abstraction layer
- **Multi-Step Creation Wizard** — Provider → Plan → Region → OS/StackScript → SSH Keys → Backup config → Review
- **SSH Console** — Full browser-based terminal via WebSocket bridge + xterm.js with resize support
- **Instance Actions** — Boot, shutdown, reboot, delete with real-time status polling
- **Backup Management** — Configurable daily/weekly backups with admin-defined upcharge pricing
- **White-Label Categories** — Admin-defined category mappings for plan display names
- **StackScript Support** — Curated marketplace apps with user-defined field configuration

### 💰 Billing & Payments

- **Prepaid Wallet System** — Organization-scoped wallets funded via PayPal
- **Automated Hourly Billing** — Cron scheduler runs every 60 minutes, deducting `(base_price + markup + backup_cost) / 730` per hour
- **Network Transfer Billing** — Tracks outbound transfer usage against pool quotas with overage cost projection
- **PayPal Integration** — Create order → user approval → capture flow with webhook support
- **Invoice Generation** — Automatic invoice creation linked to billing cycles
- **Billing Summary** — Real-time dashboard showing monthly spend, all-time spend, active VPS count, monthly estimate, and transfer usage
- **Low Balance Alerts** — Daily cron checks for wallets below $5 with active services

### 👥 Organizations & Multi-Tenancy

- **Organization-Based Isolation** — All resources (VPS, wallets, tickets, SSH keys, invoices) are scoped to organizations
- **Custom Roles** — Admin-defined roles with granular JSONB permission sets
- **Email Invitations** — Token-based invitation flow with accept/decline endpoints
- **Member Management** — Owner, admin, and member role hierarchy
- **Active Organization** — Users can switch between organizations they belong to

### 🔐 Authentication & Security

- **JWT Authentication** — Stateless tokens with configurable expiration (default: 7 days)
- **Two-Factor Authentication** — TOTP-based 2FA with QR code setup via `otplib`
- **Password Reset** — Token-based email flow with expiration
- **Admin Impersonation** — Admins can act as any user for support purposes with visual banner indicator
- **AES-256 Encryption** — SSH credentials and provider API tokens encrypted at rest
- **Row-Level Security** — PostgreSQL RLS on `user_api_keys` table
- **Tiered Rate Limiting** — Configurable per-role limits (anonymous/authenticated/admin) with per-user overrides

### ⚡ Real-Time Features

- **PostgreSQL LISTEN/NOTIFY** — Database triggers fire notifications for user-relevant events
- **Server-Sent Events (SSE)** — Push notifications to connected browser clients
- **WebSocket SSH Bridge** — Real-time bidirectional terminal I/O
- **Live Ticket Updates** — Real-time message delivery via PG notify channels per ticket/org

### 🛠️ Admin Dashboard

- **User Management** — Search, view, edit, impersonate, promote users
- **Platform Settings** — Global configuration (branding, contact info, availability hours)
- **Provider Configuration** — Manage Linode API tokens, allowed regions, display order
- **VPS Plan Wizard** — Map Linode plan IDs to retail pricing with markup and backup upcharges
- **Email Templates** — Handlebars-based email template CRUD
- **FAQ & Contact Management** — Admin-editable FAQ categories/items and contact methods
- **Category Mappings** — White-label plan category names
- **Rate Limit Monitoring** — View and configure rate limit metrics and per-user overrides
- **GitHub Integration** — Optional GitHub token for update checking
- **Billing Administration** — View all billing cycles, failed charges, wallet balances

### 📱 UI/UX

- **Responsive Design** — Mobile-first with dedicated mobile hooks (`use-mobile.tsx`, `use-orientation.tsx`, `use-virtual-keyboard.tsx`)
- **Theme System** — Backend-stored theme presets with dark/light mode support
- **Command Palette** — Ctrl/Cmd + K for quick navigation via `cmdk`
- **Accessibility** — ARIA-compliant Radix UI primitives throughout
- **Loading States** — Skeleton loaders, progress indicators, optimistic updates
- **Error Boundaries** — Graceful error handling with fallback UI

---

## 🔐 Security Architecture

### Data Protection

```text
SECURITY ARCHITECTURE SNAPSHOT
-----------------------------------------------------------------------------
Encryption at Rest
  • Passwords – bcrypt hashes
  • SSH credentials – AES-256 via SSH_CRED_SECRET
  • Provider API tokens – AES-256 via ENCRYPTION_KEY
  • JWT tokens – HMAC-SHA256 signatures

Encryption in Transit
  • HTTPS/TLS (Caddy-managed certificates)
  • WSS for WebSocket terminals
  • Optional SSL for DB connections

Access Control Layers
  • RBAC (admin vs user) + org-scoped authorization
  • Organization isolation applied to all queries
  • Row-level security on user_api_keys
  • Tiered rate limiting per role with overrides
```

### Rate Limiting Tiers


| Tier              | Default Max Requests | Window     |
| ----------------- | -------------------- | ---------- |
| **Anonymous**     | 1,000                | 15 minutes |
| **Authenticated** | 5,000                | 15 minutes |
| **Admin**         | 10,000               | 15 minutes |
All tiers are configurable via environment variables. Per-user overrides can be set by admins via the `user_rate_limit_overrides` table.

---

## 🚀 Development Setup

### Prerequisites


| Requirement    | Version | Notes                                 |
| -------------- | ------- | ------------------------------------- |
| **Node.js**    | 22.22.0 | See `.nvmrc`                          |
| **npm**        | 9+      | Bundled with Node.js                  |
| **PostgreSQL** | 12+     | Local or cloud (Neon, Supabase, etc.) |
| **Git**        | Latest  | For cloning                           |


### Required API Keys


| Service                                                       | Purpose                   | Where to Get                                                    |
| ------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------- |
| **Linode API Token**                                          | VPS infrastructure        | [Linode Cloud Manager](https://cloud.linode.com/profile/tokens) |
| **PayPal Client ID & Secret**                                 | Payment processing        | [PayPal Developer](https://developer.paypal.com/)               |
| **Resend API Key** *(at least one email provider required)*   | Email delivery            | [Resend Dashboard](https://resend.com/)                         |
| **SMTP Credentials** *(at least one email provider required)* | Email delivery (fallback) | Your SMTP provider                                              |


### Quick Start

```bash
# 1. Clone and install
git clone https://github.com/gvps-cloud/skypanelv2.git
cd skypanelv2
npm install

# 2. Configure environment
cp .env.example .env
node scripts/generate-ssh-secret.js  # Generates SSH_CRED_SECRET

# 3. Edit .env with your values (see below)

# 4. Setup database
npm run db:fresh       # Reset + run all migrations
npm run seed:admin     # Create admin user

# 5. Apply branding (updates docs, FAQ, contact info to match .env)
node scripts/seed-branding.js

# 6. Start development
npm run dev            # Frontend (5173) + Backend (3001)
```

### Essential Environment Variables

```bash
# Database (required)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/skypanelv2

# Security (required)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
SSH_CRED_SECRET=<generated-by-script>
ENCRYPTION_KEY=your-32-character-encryption-key

# PayPal (required for payments)
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_MODE=sandbox

# Linode (required for VPS)
LINODE_API_TOKEN=your-linode-api-token

# Branding
VITE_COMPANY_NAME=YourBrand
COMPANY_NAME=YourBrand
COMPANY_BRAND_NAME=YourBrand

# Networking (used for VPS reverse DNS)
RDNS_BASE_DOMAIN=ip.rev.yourdomain.com

# Default Admin Seed (optional, used by scripts/create-test-admin.js)
# DEFAULT_ADMIN_EMAIL=admin@yourdomain.com
# DEFAULT_ADMIN_PASSWORD=ChangeMeImmediately
```

> ⚠️ **Branding**: After setting the env vars above, run `node scripts/seed-branding.js` to update the database with your brand name in documentation articles, FAQ items, contact methods, and networking config. Migrations use generic placeholders; this script replaces them with your configured values.
> For the complete environment variable reference, see `[repo-docs/ENVIRONMENT_VARIABLES.md](./repo-docs/ENVIRONMENT_VARIABLES.md)` and `[.env.example](./.env.example)`.

### Icons & Logo

The site icon and logo are sourced from a single file: `**public/favicon.svg`**. This SVG is used everywhere:


| Usage                  | Location                                               |
| ---------------------- | ------------------------------------------------------ |
| Browser tab favicon    | `index.html` → `<link rel="icon" href="/favicon.svg">` |
| Public navbar logo     | `src/components/MarketingNavbar.tsx` → `<Logo>`        |
| Dashboard sidebar logo | `src/components/AppSidebar.tsx` → `<Logo>`             |
| Footer logo            | `src/components/MarketingFooter.tsx` → `<Logo>`        |


The `Logo` component (`src/components/Logo.tsx`) renders an `<img>` tag pointing to `/favicon.svg`, so all surfaces stay in sync automatically.

**To change the icon:**

1. Replace `public/favicon.svg` with your new SVG
2. Regenerate raster icons using [realfavicongenerator.net](https://realfavicongenerator.net/) — upload your SVG and download the full icon package
3. Place the generated files in `public/` (`favicon.ico`, `favicon-96x96.png`, `apple-touch-icon.png`, etc.)
4. Update `public/site.webmanifest` if icon filenames change

See `[PWA_SETUP.md](./PWA_SETUP.md)` for additional PWA-specific icon requirements (192×192 and 512×512 PNGs).

### Default Admin Credentials

Credentials are configurable via `DEFAULT_ADMIN_EMAIL` and `DEFAULT_ADMIN_PASSWORD` environment variables (set in `.env`).


| Field    | Default             |
| -------- | ------------------- |
| Email    | `admin@example.com` |
| Password | `Admin123#`         |


### Development Commands

```bash
# ─── Development ───────────────────────────────────
npm run dev              # Start frontend + backend concurrently
npm run dev-up           # Kill ports first, then start dev
npm run client:dev       # Frontend only (Vite on :5173)
npm run server:dev       # Backend only (Express on :3001)

# ─── Database ──────────────────────────────────────
npm run db:fresh         # Reset database + run all migrations
npm run db:reset         # Interactive reset with confirmation
npm run db:reset:confirm # Reset without prompt
npm run seed:admin       # Create default admin user

# ─── Quality ───────────────────────────────────────
npm run check            # TypeScript type checking
npm run lint             # ESLint validation
npm run build            # TypeScript check + Vite production build

# ─── API Docs ──────────────────────────────────────
npm run docs:api:sync    # Sync API docs manifest (auto-runs on dev/build)
npm run docs:api:audit   # Audit API documentation coverage

# ─── Production ────────────────────────────────────
npm run build            # Build for production
npm run start            # Start production server + Vite preview
npm run pm2:start        # Build and start with PM2
npm run pm2:reload       # Graceful PM2 reload
npm run pm2:stop         # Stop PM2 processes
npm run pm2:list         # List PM2 processes

# ─── Utilities ─────────────────────────────────────
npm run kill-ports       # Kill processes on 3001, 5173, 8000
npm run pwa:icons        # Generate PWA icons
```

---

## 🚀 Deployment

### Production Architecture

```text
PRODUCTION ARCHITECTURE
-----------------------------------------------------------------------------
Internet → HTTPS (port 443) → Caddy reverse proxy (auto-SSL)
  • Caddy proxies /api/* → skypanelv2-api (Express + WebSocket on port 3001, managed by PM2)
  • Caddy proxies /* → skypanelv2-ui (Vite preview on port 5173, also under PM2)

Backend integrations from skypanelv2-api:
  • PostgreSQL database
  • Linode API for infrastructure
  • PayPal API for payments
  • Email providers (Resend / SMTP)
```

### Production Checklist

#### Security

- Strong `JWT_SECRET` (32+ characters, randomly generated)
- Unique `SSH_CRED_SECRET` and `ENCRYPTION_KEY`
- Secure database password
- HTTPS/SSL configured via Caddy
- PayPal **live** credentials (not sandbox)
- `NODE_ENV=production`
- Rate limiting configured appropriately
- Database backups enabled

#### Configuration

- Linode production API token
- Production SMTP/Resend credentials
- `CLIENT_URL` set to production domain
- CORS origins configured for production domain
- `TRUST_PROXY=1` (single reverse proxy) or `2` (Cloudflare + proxy)

### Deployment with PM2

```bash
# Clone and setup
git clone https://github.com/gvps-cloud/skypanelv2.git
cd skypanelv2
npm install

# Configure environment
cp .env.example .env
# Edit .env with production values

# Setup database
npm run db:fresh
npm run seed:admin

# Build and start
npm run pm2:start

# Monitor
pm2 monit
pm2 logs skypanelv2-api
pm2 logs skypanelv2-ui
```

### Health Check

```bash
curl https://panel.gvps.cloud/api/health
```

### Maintenance

```bash
# PM2 status
pm2 list
pm2 logs

# Database backup
pg_dump skypanelv2 > backup_$(date +%Y%m%d).sql

# Update deployment
git pull origin main
npm install
npm run build
npm run pm2:reload
```

---

## 🧪 Testing

### Test Stack


| Tool                      | Purpose                          |
| ------------------------- | -------------------------------- |
| **Vitest**                | Unit and integration test runner |
| **React Testing Library** | Component testing with jsdom     |
| **Supertest**             | HTTP API endpoint testing        |
| **Playwright**            | End-to-end browser testing       |
| **fast-check**            | Property-based testing           |


### Test Locations


| Location                 | Type                                  |
| ------------------------ | ------------------------------------- |
| `src/**/*.test.tsx`      | Frontend component tests (co-located) |
| `api/services/*.test.ts` | Backend service tests                 |
| `api/tests/`             | Backend API tests                     |
| `tests/e2e/`             | Playwright E2E tests                  |


### Running Tests

```bash
# Note: Check package.json for current test script availability
# The repo includes Vitest, RTL, Supertest, and Playwright configurations

# Type checking
npm run check

# Linting
npm run lint

# Build verification
npm run build
```

### Manual Testing Checklist

1. **Database Setup**: `npm run db:fresh && npm run seed:admin`
2. **Auth Flow**: Login, register, 2FA setup, password reset
3. **VPS Lifecycle**: Create → monitor → SSH → reboot → delete
4. **Billing**: Add funds via PayPal → verify wallet → check hourly deductions
5. **Organizations**: Create org → invite member → accept invitation → switch org
6. **Support**: Create ticket → staff reply → close ticket
7. **Admin**: User management → impersonation → platform settings → plan configuration

---

## 📁 Project Structure

```
skypanelv2/
├── api/                              # Backend API (Express.js + TypeScript)
│   ├── app.ts                        # Express app wiring, middleware, route registration
│   ├── server.ts                     # HTTP server bootstrap, SSH bridge init, billing scheduler
│   ├── index.ts                      # Entry point
│   ├── config/
│   │   └── index.ts                  # Environment config, rate limit parsing, validation
│   ├── lib/                          # Shared backend utilities
│   │   ├── database.ts               # PostgreSQL query/transaction helpers
│   │   ├── crypto.ts                 # AES-256 encrypt/decrypt
│   │   ├── providerTokens.ts         # Provider API token resolution
│   │   ├── providerRegions.ts        # Region filtering logic
│   │   ├── whiteLabel.ts             # White-label category mapping
│   │   ├── validation.ts             # Input validation helpers
│   │   ├── security.ts               # Security utilities
│   │   ├── ipDetection.ts            # Client IP resolution
│   │   ├── errorHandling.ts          # Error formatting
│   │   ├── diagnostics.ts            # System diagnostics
│   │   ├── fsUtils.ts                # File system helpers
│   │   └── animalSuffix.ts           # Random label generation
│   ├── middleware/
│   │   ├── auth.ts                   # JWT authentication (sets req.user)
│   │   ├── permissions.ts            # Organization-based RBAC
│   │   ├── rateLimiting.ts           # Tiered rate limiting + headers
│   │   ├── security.ts               # Helmet, CORS, nonce-based CSP
│   │   ├── csrfProtection.ts         # CSRF token middleware for API routes
│   │   └── requireHttps.ts           # Force HTTPS in production
│   ├── routes/
│   │   ├── admin/                    # Admin-only route handlers
│   │   │   ├── billing.ts            # Admin billing management
│   │   │   ├── categoryMappings.ts   # White-label category CRUD
│   │   │   ├── contact.ts            # Contact message management
│   │   │   ├── emailTemplates.ts     # Email template CRUD
│   │   │   ├── platform.ts           # Platform settings
│   │   │   ├── sshKeys.ts            # Admin SSH key management
│   │   │   ├── networking.ts         # rDNS and IPv6 config
│   │   │   └── announcements.ts      # Platform announcements
│   │   ├── auth.ts                   # Login, register, 2FA, password reset
│   │   ├── vps.ts                    # VPS CRUD, actions, providers, plans
│   │   ├── payments.ts               # PayPal order creation/capture
│   │   ├── organizations.ts          # Org CRUD, members, invitations, roles
│   │   ├── support.ts                # Ticket CRUD, replies
│   │   ├── sshKeys.ts                # SSH key management + Linode sync
│   │   ├── invoices.ts               # Invoice listing/detail
│   │   ├── activity.ts               # User activity feed
│   │   ├── activities.ts             # Activity logging
│   │   ├── notifications.ts          # SSE notification stream
│   │   ├── admin.ts                  # Admin user management, stats
│   │   ├── adminFaq.ts               # Admin FAQ management
│   │   ├── faq.ts                    # Public FAQ content
│   │   ├── contact.ts                # Contact form submission
│   │   ├── pricing.ts                # Public pricing data
│   │   ├── theme.ts                  # Theme preset management
│   │   ├── github.ts                 # GitHub integration
│   │   ├── health.ts                 # Health check endpoint
│   │   ├── documentation.ts          # Public documentation articles
│   │   ├── adminDocumentation.ts     # Admin documentation CRUD
│   │   ├── announcements.ts          # Public announcements
│   │   └── apiKeys/                  # User API key routes
│   └── services/
│       ├── providers/                # Cloud provider abstraction
│       │   ├── IProviderService.ts   # Provider interface contract
│       │   ├── BaseProviderService.ts # Shared provider logic
│       │   ├── LinodeProviderService.ts # Linode implementation
│       │   ├── ProviderFactory.ts    # Provider instantiation
│       │   └── index.ts              # Provider exports
│       ├── authService.ts            # JWT token management
│       ├── billingService.ts         # Hourly billing engine
│       ├── billingCronService.ts     # 24h billing reminder cron
│       ├── egressBillingService.ts   # Transfer pool tracking (monthly)
│       ├── egressCreditService.ts    # Pre-paid egress credit management
│       ├── egressHourlyBillingService.ts # Hourly egress billing
│       ├── betterStackService.ts     # Better Stack uptime integration
│       ├── bruteForceProtectionService.ts # Brute force lockout
│       ├── ipService.ts              # IP address management
│       ├── linodeService.ts          # Linode REST API wrapper
│       ├── paypalService.ts          # PayPal order/capture/wallet
│       ├── emailService.ts           # Email with provider fallback
│       ├── emailTemplateService.ts   # Handlebars template rendering
│       ├── invoiceService.ts         # Invoice generation
│       ├── activityLogger.ts         # Activity log recording
│       ├── activityFeed.ts           # Activity feed queries
│       ├── activityEmailService.ts   # Activity email notifications
│       ├── notificationService.ts    # PG LISTEN/NOTIFY → EventEmitter
│       ├── userNotificationPreferences.ts # User notification settings
│       ├── themeService.ts           # Theme configuration
│       ├── categoryMappingService.ts # White-label categories
│       ├── providerService.ts        # Provider CRUD
│       ├── providerResourceCache.ts  # Cached provider data
│       ├── platformStatsService.ts   # Admin dashboard stats
│       ├── githubService.ts          # GitHub API integration
│       ├── invitations.ts            # Organization invitation logic
│       ├── roles.ts                  # Role/permission management
│       ├── sshBridge.ts              # WebSocket SSH terminal bridge
│       ├── tokenBlacklistService.ts  # JWT token blacklist
│       ├── rateLimitMetrics.ts       # Rate limit metrics collection
│       ├── rateLimitConfigValidator.ts # Rate limit config validation
│       └── rateLimitOverrideService.ts # Per-user rate limit overrides
│
├── src/                              # Frontend (React SPA)
│   ├── App.tsx                       # Root component, route definitions, providers
│   ├── main.tsx                      # React DOM entry point
│   ├── index.css                     # Global styles + Tailwind imports
│   ├── components/
│   │   ├── ui/                       # shadcn/ui base components
│   │   ├── admin/                    # Admin dashboard components
│   │   ├── VPS/                      # VPS creation wizard, SSH terminal
│   │   ├── billing/                  # Payment and billing components (PurchaseEgressCreditsDialog)
│   │   ├── support/                  # Ticket management components
│   │   ├── organizations/            # Org management components
│   │   ├── settings/                 # User settings components
│   │   ├── Dashboard/                # Dashboard widgets
│   │   ├── SSHKeys/                  # SSH key management
│   │   ├── data-table/               # Reusable data table
│   │   ├── layouts/                  # Layout wrappers
│   │   ├── hooks/                    # Component-level hooks
│   │   ├── AppLayout.tsx             # Main app shell with sidebar
│   │   ├── AppSidebar.tsx            # Navigation sidebar
│   │   ├── PublicLayout.tsx          # Public page layout
│   │   ├── MarketingNavbar.tsx       # Public navigation bar
│   │   ├── MarketingFooter.tsx       # Public footer
│   │   ├── NotificationDropdown.tsx  # Notification bell dropdown
│   │   ├── ActivityFeed.tsx          # Activity feed component
│   │   └── ErrorBoundary.tsx         # Error boundary wrapper
│   ├── pages/                        # Route page components
│   │   ├── admin/                    # Admin pages
│   │   ├── user/                     # User-specific pages
│   │   ├── HomeRedesign.tsx          # Landing page
│   │   ├── Dashboard.tsx             # User dashboard
│   │   ├── VPS.tsx                   # VPS list
│   │   ├── VPSDetail.tsx             # VPS detail view
│   │   ├── Billing.tsx               # Billing overview
│   │   ├── Organizations.tsx         # Organization management
│   │   └── ...                       # Other page components
│   ├── contexts/
│   │   ├── AuthContext.tsx            # Authentication state + JWT
│   │   ├── ThemeContext.tsx           # Theme management
│   │   ├── ImpersonationContext.tsx   # Admin impersonation state
│   │   └── BreadcrumbContext.tsx      # Navigation breadcrumbs
│   ├── hooks/                        # Reusable React hooks
│   ├── services/                     # Frontend API service wrappers
│   ├── lib/                          # Utility libraries
│   │   ├── api.ts                    # Axios API client + auto-logout
│   │   ├── utils.ts                  # General utilities (cn, etc.)
│   │   ├── billingUtils.ts           # Billing calculation helpers
│   │   ├── brand.ts                  # Branding utilities
│   │   └── ...                       # Other utilities
│   ├── theme/
│   │   └── presets.ts                # Theme preset definitions
│   ├── types/                        # TypeScript type definitions
│   └── styles/                       # Page-specific CSS
│
├── migrations/                       # Sequential SQL migrations (001–051)
├── scripts/                          # Node.js utility scripts
│   ├── run-migration.js              # Apply pending migrations
│   ├── reset-database.js             # Interactive DB reset
│   ├── seed-admin.js                 # Create default admin
│   ├── generate-ssh-secret.js        # Generate encryption key
│   ├── audit-api-docs.mjs            # API docs audit
│   └── ...                           # Admin, diagnostic, migration helpers
├── public/                           # Static assets (icons, logos)
├── data/                             # Static data files
├── repo-docs/                        # Internal documentation
│   ├── ADMIN_COMPONENTS.md           # Admin component reference
│   ├── ADMIN_TROUBLESHOOTING.md      # Admin troubleshooting guide
│   └── ENVIRONMENT_VARIABLES.md      # Complete env var reference
├── AGENTS.md                         # AI agent coding guidelines
├── CLAUDE.md                         # Claude Code development reference
├── ecosystem.config.cjs              # PM2 process configuration
├── vite.config.ts                    # Vite build configuration
├── vitest.config.ts                  # Vitest test configuration
├── playwright.config.ts              # Playwright E2E configuration
├── tailwind.config.js                # Tailwind CSS configuration
├── tsconfig.json                     # TypeScript configuration
├── package.json                      # Dependencies and scripts
└── .env.example                      # Environment variable template
```

---

## 📚 Technical Documentation

### Internal References


| Document                                                                                       | Description                                                                              |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `[AGENTS.md](./AGENTS.md)`                                                                     | Coding agent guidelines — current app state, structure, patterns, and practical guidance |
| `[CLAUDE.md](./CLAUDE.md)`                                                                     | Claude Code reference — commands, architecture, schema, services, middleware, patterns   |
| `[repo-docs/ENVIRONMENT_VARIABLES.md](./repo-docs/ENVIRONMENT_VARIABLES.md)`                   | Complete environment variable reference                                                  |
| `[repo-docs/ADMIN_COMPONENTS.md](./repo-docs/ADMIN_COMPONENTS.md)`                             | Admin dashboard component reference                                                      |
| `[repo-docs/ADMIN_TROUBLESHOOTING.md](./repo-docs/ADMIN_TROUBLESHOOTING.md)`                   | Admin troubleshooting guide                                                              |
| `[api/services/providers/ARCHITECTURE.md](./api/services/providers/ARCHITECTURE.md)`           | Provider service architecture (Linode)                                                   |
| `[api/services/providers/README.md](./api/services/providers/README.md)`                       | Provider service documentation                                                           |
| `[api/services/providers/CACHING.md](./api/services/providers/CACHING.md)`                     | Provider caching strategy                                                                |
| `[api/services/providers/API_DOCUMENTATION.md](./api/services/providers/API_DOCUMENTATION.md)` | Provider API documentation                                                               |
| `[scripts/README.md](./scripts/README.md)`                                                     | Utility scripts reference                                                                |


### Key Architectural Patterns


| Pattern                    | Implementation                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| **Service Layer**          | Business logic in `api/services/`, HTTP handling in `api/routes/`                              |
| **Database Helper**        | All queries via `api/lib/database.ts` (`query()`, `transaction()`)                             |
| **Provider Abstraction**   | `IProviderService` interface → `ProviderFactory` → `LinodeProviderService`                     |
| **React Context**          | Global state via `AuthContext`, `ThemeContext`, `ImpersonationContext`, `BreadcrumbContext`    |
| **TanStack Query**         | Server state with caching, optimistic updates, and automatic refetching                        |
| **Multi-Tenant Isolation** | All resource queries scoped to `organization_id`                                               |
| **Protected Routes**       | Frontend route guards (`ProtectedRoute`, `AdminRoute`, `PublicRoute`) backed by JWT middleware |
| **Real-Time Events**       | PG triggers → `LISTEN/NOTIFY` → `NotificationService` EventEmitter → SSE                       |


---

## 📞 Internal Contacts


| Team            | Responsibilities                                              |
| --------------- | ------------------------------------------------------------- |
| **Development** | Technical issues, bug reports, feature requests, code reviews |
| **Operations**  | Production deployment, monitoring, database management        |
| **Support**     | Customer issues, billing inquiries, VPS provisioning support  |


---

## 📄 License

This is proprietary software owned by gvps.cloud. All rights reserved.

**Confidential**: This codebase and documentation are confidential and proprietary to gvps.cloud. Unauthorized access, use, or distribution is prohibited.

---

**Built and maintained by the gvps.cloud development team**
