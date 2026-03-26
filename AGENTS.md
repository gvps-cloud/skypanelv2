# AGENTS.md

This file documents the current state of the `skypanelv2` repository so coding agents can work against the app as it exists today rather than older assumptions.

## What This Application Is

SkyPanelV2 is a full-stack VPS hosting and billing panel with:

- Public marketing, pricing, status, FAQ, contact, legal, and API docs pages
- User authentication and account management
- VPS management, detail screens, and SSH console access
- Billing, invoices, transactions, and PayPal payment flows
- Support, notifications, and activity history
- Organizations, invitations, and membership workflows
- Egress (network transfer) billing with prepaid credit packs and hourly enforcement
- Admin tools for users, billing, platform settings, FAQ/contact content, email templates, GitHub/update integrations, and impersonation

## Current Stack

### Frontend

- React 18
- TypeScript
- Vite
- React Router DOM 7
- TanStack Query
- Tailwind CSS
- shadcn/ui and Radix UI primitives
- React Hook Form + Zod
- Framer Motion
- Xterm.js for SSH console UI

### Backend

- Express 4
- TypeScript with ESM modules
- PostgreSQL via `pg`
- JWT authentication
- Helmet, CORS, express-validator, and custom rate limiting middleware

### Integrations

- Linode API
- PayPal server/client SDKs
- Resend and SMTP email delivery
- Optional GitHub token support
- PM2-based production process management
- Caddy deployment helpers

## Development Commands

### Core App

- `npm run dev` - Start frontend and backend development servers concurrently
- `npm run dev-up` - Kill ports `3001`, `5173`, and `8000`, then start dev
- `npm run client:dev` - Start Vite dev server
- `npm run server:dev` - Start backend dev server with `nodemon`
- `npm run build` - Run TypeScript build and Vite production build
- `npm run check` - Type-check without emitting
- `npm run lint` - Run ESLint
- `npm run preview` - Preview the built frontend
- `npm run start` - Run the production API server and Vite preview together

### API Docs / Metadata

- `npm run docs:api:sync` - Refresh API docs manifest data
- `npm run docs:api:audit` - Audit API docs coverage

These sync automatically before `dev`, `client:dev`, and `build`.

### Database / Reset

- `npm run db:reset` - Interactive database reset
- `npm run db:reset:confirm` - Reset database without prompt
- `npm run db:fresh` - Reset database and apply migrations
- `npm run seed:admin` - Seed the default admin user

### Runtime / Deployment Helpers

- `npm run kill-ports` - Kill ports `3001`, `5173`, and `8000`
- `npm run pm2:start` - Build and launch PM2 processes
- `npm run pm2:reload` - Reload PM2 processes
- `npm run pm2:stop` - Stop and delete PM2 processes
- `npm run pm2:list` - List PM2 processes
- `npm run pwa:icons` - Generate PWA icons

## Environment Configuration

Copy `.env.example` to `.env`.

### Core Required Values

```bash
NODE_ENV=development
PORT=3001
CLIENT_URL=http://localhost:5173
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/skypanelv2
JWT_SECRET=your-super-secret-jwt-key-here
SSH_CRED_SECRET=your-32-character-encryption-key
ENCRYPTION_KEY=your-32-character-encryption-key
```

### Branding

```bash
COMPANY_NAME=SkyPanelV2
VITE_COMPANY_NAME=SkyPanelV2
COMPANY_BRAND_NAME=SkyPanelV2
```

### External Services

```bash
LINODE_API_TOKEN=your-linode-api-token
LINODE_API_URL=https://api.linode.com/v4
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_MODE=sandbox
EMAIL_PROVIDER_PRIORITY=resend,smtp
RESEND_API_KEY=
SMTP_HOST=mail.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_USERNAME=smtp-user@example.com
SMTP_PASSWORD=super-secure-password
FROM_EMAIL=noreply@example.com
FROM_NAME=SkyPANELv2
CONTACT_FORM_RECIPIENT=support@example.com
```

### Operational Settings

```bash
TRUST_PROXY=true
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
BACKUP_STORAGE_PROVIDER=local
BACKUP_RETENTION_DAYS=30
```

### Rate Limiting

The current environment file exposes configurable role-based limits:

- `RATE_LIMIT_ANONYMOUS_WINDOW_MS`
- `RATE_LIMIT_ANONYMOUS_MAX`
- `RATE_LIMIT_AUTHENTICATED_WINDOW_MS`
- `RATE_LIMIT_AUTHENTICATED_MAX`
- `RATE_LIMIT_ADMIN_WINDOW_MS`
- `RATE_LIMIT_ADMIN_MAX`

The current defaults in `.env.example` are much higher than the older values previously documented.

## Current Application Structure

```text
api/
  app.ts                Express app wiring and route registration
  server.ts             API server bootstrap
  config/               Environment and runtime config
  lib/                  Shared backend helpers
  middleware/           Auth, permissions, rate limiting, validation
  routes/               Public, authenticated, and admin API routes
  services/             Business logic and background/process services

src/
  App.tsx               Main router and route guards
  components/           Reusable UI and feature-specific components
  contexts/             Auth, theme, breadcrumb, and impersonation state
  hooks/                Reusable frontend hooks
  lib/                  API client and utilities
  pages/                Public, user, and admin route pages
  services/             Frontend service wrappers
  styles/               Page-specific styles
  theme/                Theme preset/token definitions
  types/                Shared frontend types

migrations/             SQL migrations
scripts/                Database, migration, admin, diagnostics, and maintenance scripts
public/                 Static assets and icons
repo-docs/              Internal docs and audit artifacts
deploy/                 Deployment-related templates
```

## Frontend Routing Overview

### Public Pages

- `/` via `HomeRedesign`
- `/pricing`
- `/faq`
- `/about`
- `/contact`
- `/status`
- `/terms`
- `/privacy`
- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`
- Organization invitation acceptance routes

### Authenticated User Pages

- `/dashboard`
- `/vps`
- `/vps/:id`
- `/vps/:id/ssh`
- `/ssh-keys`
- `/organizations`
- `/organizations/:id`
- `/billing`
- `/billing/invoice/:id`
- `/billing/transaction/:id`
- `/billing/payment/success`
- `/billing/payment/cancel`
- `/support`
- `/settings`
- `/activity`
- `/api-docs`
- `/egress-credits`

### Admin Pages

- `/admin`
- `/admin/user/:id`

The app shell currently relies on:

- `AuthProvider`
- `ThemeProvider`
- `ImpersonationProvider`
- public/authenticated/admin route guards in `src/App.tsx`

## Backend API Overview

The Express app currently registers these route groups:

- `/api/auth`
- `/api/payments`
- `/api/admin`
- `/api/admin/platform`
- `/api/admin/email-templates`
- `/api/admin/contact`
- `/api/admin/billing`
- `/api/vps`
- `/api/support`
- `/api/activity`
- `/api/activities`
- `/api/invoices`
- `/api/notifications`
- `/api/theme`
- `/api/health`
- `/api/contact`
- `/api/faq`
- `/api/admin/faq`
- `/api/admin/github`
- `/api/ssh-keys`
- `/api/organizations`
- `/api/pricing`
- `/api/egress`
- `/api/api-keys` - User API key management with row-level security

Cross-cutting backend behavior includes:

- Config validation at startup
- Helmet and CORS middleware
- JSON and URL-encoded body parsing
- API-only smart rate limiting and response headers
- Metrics collection and persistence startup
- Billing cron startup
- Production serving of the built frontend from `dist`

## Key Architectural Patterns

### Database Access

Use shared database helpers from `api/lib/` rather than creating ad hoc connections inside route handlers.

### Route / Service Split

Keep HTTP request/response handling in route files and business logic in `api/services/` whenever possible.

### Auth and Permissions

- JWT auth is applied through backend middleware
- Frontend route guards are convenience layers, not the source of truth
- Admin impersonation is a core feature and affects access-sensitive work

### Theming

Theme behavior spans frontend context/state and backend theme APIs. Review `src/contexts/ThemeContext.tsx`, `src/theme/`, and `api/routes/theme.ts` before changing theme behavior.

### Organizations and Billing Scope

Organizations, invitations, and billing visibility are tightly related areas. Be careful when modifying resource queries, access control, or dashboard summaries so data does not leak across users or orgs.

### Egress Billing System

SkyPanelV2 implements a **prepaid egress credit model with hourly enforcement** to prevent network transfer abuse:

- **Credit packs** (100GB, 1TB, 5TB, 10TB) are purchased via PayPal and stored per-organization
- **Hourly billing** polls Linode transfer API every 60 minutes, calculating delta from the last reading
- **Auto-shutoff** suspends VPS instances when an organization's credit balance hits zero
- **Organization-scoped**: all members share the same credit pool; permissions control who can view vs. purchase

Key services:
- `api/services/egressCreditService.ts` — credit balance, purchase, deduction, manual add
- `api/services/egressHourlyBillingService.ts` — hourly billing orchestrator
- `api/services/egressBillingService.ts` — transfer pool tracking and overage projection
- `api/services/egress/egressUtils.ts` — Linode transfer API helpers

Key routes:
- `GET /api/egress/credits` — org credit balance
- `GET /api/egress/credits/history` — purchase history
- `GET /api/egress/credits/packs` — available packs
- `POST /api/egress/credits/purchase` — initiate PayPal purchase
- `POST /api/egress/credits/purchase/complete` — complete purchase
- `GET /api/egress/usage/:vpsId` — per-VPS hourly readings
- Admin routes under `/api/egress/admin/*` for manual credit management and billing triggers

Key frontend files:
- `src/pages/EgressCredits.tsx` — dedicated egress credits page
- `src/pages/Organizations.tsx` — org Egress tab with credit management
- `src/pages/VPSDetail.tsx` — egress usage section in Networking tab
- `src/components/admin/EgressCreditManager.tsx` — admin credit management UI
- `src/components/admin/EgressPackSettings.tsx` — admin pack pricing config
- `src/services/egressService.ts` — frontend API client

Database migrations 026–033 implement the egress system (tables: `organization_egress_credits`, `egress_credit_packs`, `vps_egress_hourly_readings`, etc.). Note: 34 migrations total (001–034, with 006 skipped).

## Testing Notes

The repo includes:

- Vitest
- React Testing Library
- Supertest
- Playwright

There is currently no `npm run test` or `npm run test:watch` script in `package.json`, so do not assume those commands exist.

## Useful Scripts

Notable scripts currently present in `scripts/` include:

- `run-migration.js`
- `reset-database.js`
- `create-test-admin.js`
- `ensure-admin-user.js`
- `promote-to-admin.js`
- `update-admin-password.js`
- `audit-api-docs.mjs`
- `generate-ssh-secret.js`
- `generate-pwa-icons.js`
- `update-theme-to-mono.js`
- provider/data migration helpers
- verification/debug helpers for admins, settings, plans, migrations, and schema state

## Practical Guidance for Agents

- Check `package.json` before referencing scripts
- Check `src/App.tsx` before documenting or changing routes
- Check `api/app.ts` before documenting or changing API surface area
- Prefer existing helpers/services instead of duplicating logic
- Be careful with org-aware data access, billing visibility, and impersonation
- Treat public marketing pages and authenticated panel flows as separate product surfaces when making changes
