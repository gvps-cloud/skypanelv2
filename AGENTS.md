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
- `node scripts/seed-branding.js` - Update database branding (docs, FAQ, contact, rDNS) to match .env

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

> **Note:** These are example values. Set these to match your deployment brand.

```bash
COMPANY_NAME=SkyPanelV2
VITE_COMPANY_NAME=SkyPanelV2
COMPANY_BRAND_NAME=SkyPanelV2
```

### Networking

```bash
RDNS_BASE_DOMAIN=ip.rev.example.com
```

### Admin Seed Defaults (optional)

```bash
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=Admin123#
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
public/                 Static assets, icons, and favicon.svg (single source of truth for site logo)
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

Database migrations 025–032 implement the egress system (tables: `organization_egress_credits`, `egress_credit_packs`, `vps_egress_hourly_readings`, etc.). Note: 47 migrations total (001–047, sequential).

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
- The site logo/favicon is a single source of truth: `public/favicon.svg` — the `Logo` component (`src/components/Logo.tsx`) renders it as an `<img>` tag, and `index.html` links it as the browser favicon. To update icons, replace `favicon.svg` and regenerate raster variants via [realfavicongenerator.net](https://realfavicongenerator.net/)

## Cursor Cloud specific instructions

### Environment

- **Node.js 22.22.0** is required (matches `.nvmrc`). Use `nvm use` to activate.
- **npm** is the package manager (lockfile: `package-lock.json`).
- All secrets (`DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `SSH_CRED_SECRET`, etc.) are injected as environment variables via Cursor Secrets. The `.env` file must be generated from `.env.example` by mapping these injected env vars at setup time — it is **not** committed to the repo.
- The `DATABASE_URL` points to an **external PostgreSQL instance** (not localhost). All migrations and seed data are already applied. Do **not** run `db:fresh`, `db:reset`, or destructive migration commands.
- Redis is available via the injected `REDIS_URL` and is used for token blacklist and brute-force protection.

### Running the app

- `npm run dev` starts both Vite (port 5173) and Express API (port 3001) concurrently.
- `npm run dev-up` is the preferred clean-start command — it kills ports 3001/5173/8000 first.
- The Vite dev server proxies `/api/` requests to the Express backend automatically.
- Access the app at `http://localhost:5173`.

### Lint / Type check / Tests

- `npm run lint` — ESLint (expect warnings, 0 errors).
- `npm run check` — TypeScript type check (`tsc --noEmit`).
- `npx vitest run tests/security/` — runs security tests (the only test suite with a defined path). There is no `npm test` script.
- API docs sync (`npm run docs:api:sync`) runs automatically via pre-hooks before `dev`, `client:dev`, and `build`.

### Gotchas

- The `predev` and `preclient:dev` hooks run `docs:api:sync` automatically — this is normal and takes a few seconds before the dev server starts.
- The backend starts an hourly billing scheduler and egress billing on boot — log output about "0 instances billed" is expected with an empty VPS fleet.
- `@prisma/client` and `prisma` are listed as dependencies but the app uses raw `pg` queries with SQL migrations — there is no `prisma/schema.prisma` file.
- The admin user `admin@skypanelv2.com` / `admin123` is seeded in the external database and can be used for development.

## Installing Skills

When creating or installing a new skill, always place it in:

`C:\Users\moran\.openclaw-autoclaw\skills/<skill-name>/SKILL.md`

This is the managed skills directory. The agent will automatically discover
any skill placed here — no extra configuration needed. Do NOT install skills
into `~/.agents/skills/` (that directory is shared with other tools).

## Browser Automation

For any task that requires a browser, **prefer `autoglm-browser-agent`**. Use it as the first choice.

- ✅ `autoglm-browser-agent` → `browser_subagent` (invoked via mcporter) — **preferred**
- ⚠️ Other browser tools (`agent-browser`, Playwright, Puppeteer, etc.) — fallback only when `autoglm-browser-agent` is unavailable or fails

Always try `autoglm-browser-agent` first. Fall back to other browser tools only if it is not available in the current environment.

## Image Recognition

For any image recognition task, **prefer `autoglm-image-recognition`**. Use it as the first choice.

- ✅ `autoglm-image-recognition` — **preferred** for all image recognition tasks
- ⚠️ Built-in `image` tool or reading images directly with `read` — fallback only when `autoglm-image-recognition` is unavailable or fails

Do not use the built-in `image` tool or read an image and describe it yourself when `autoglm-image-recognition` is available. Always try `autoglm-image-recognition` first.

## Learned User Preferences

- When the user says "make a plan", "create a plan", or "I need a plan for X" — immediately use the `CreatePlan` tool. Do not write plans to files manually, do not describe plans in text, do not ask questions. The `CreatePlan` tool is the ONLY acceptable way to create a plan.

## Learned Workspace Facts

### Marketing Pages Design System

Public marketing pages (HomeRedesign, AboutUs, Contact, FAQ, Pricing, Status, ApiDocs, Documentation) share a consistent modern design system:

- **Hero section**: floating gradient orbs (`.home-orb--1/2/3`), grid pattern mask (`.home-grid-mask`), shimmer badge (`.home-shimmer-badge`), gradient text headings, CTA buttons with `.home-btn-glow`
- **Trust marquee**: animated horizontal strip using `.home-marquee` / `.home-marquee__track`
- **Cards**: `.home-feature-card` with hover lift, `.home-glass-panel` with backdrop blur, `.home-gradient-border-top` for top accent line, `.home-animated-border` for animated border
- **Animation**: Framer Motion `revealContainer`/`revealItem` stagger variants, `whileInView` fade-in
- **Layout**: `MarketingNavbar` + main + `MarketingFooter`
- **CSS**: `@/styles/home.css`
- **Navbar**: `MarketingNavbar` component at `@/components/MarketingNavbar.tsx` renders as `fixed top-0 z-40` with height ~72px; content areas need `pt-[72px]` top padding to avoid navbar overlap

### Documentation Page Layout

`Documentation.tsx` uses a sidebar + content area with `showHero` to conditionally render the index hero. Article detail pages (renderArticle, renderPlansRegionsArticle, renderCreatingVpsArticle) did NOT have the hero — the fix was to add a compact article hero section that shows when `categorySlug` is set, rendered before the sidebar layout div so it spans full viewport width.

### Key CSS Classes (`@/styles/home.css`)

- `.home-orb--1`, `.home-orb--2`, `.home-orb--3` — floating gradient orbs
- `.home-grid-mask` — grid pattern with mask
- `.home-shimmer-badge` — shimmer effect on badges
- `.home-btn-glow` — glow effect on CTA buttons
- `.home-marquee`, `.home-marquee__track` — trust marquee
- `.home-feature-card` — hover lift card
- `.home-glass-panel` — backdrop blur panel
- `.home-gradient-border-top` — top accent line
- `.home-animated-border` — animated border
- `.home-cta-shell` — CTA section shell with orbs

