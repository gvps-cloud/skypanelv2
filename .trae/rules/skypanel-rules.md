# SkyPanel v2 — Project Rules

Comprehensive guidance for coding agents working in `skypanelv2`.

> **Source:** This file is derived from `AGENTS.md`. In case of conflicts, `AGENTS.md` is the source of truth.

## Project Overview

**skypanelv2** is an open-source cloud service reseller billing panel with multi-provider support and white-label branding.

### Three Product Surfaces

1. **Public marketing pages** — static-ish pages with fixed `MarketingNavbar` (offset by `--announcement-banner-height`), shared `src/styles/home.css`
2. **Customer portal** — dashboard, VPS management, billing, SSH console (`xterm.js`), support tickets, blog, hosting management
3. **Admin dashboard** — org management, user impersonation, platform controls, blog CMS, ticket management, maintenance mode

### Key Feature Areas

VPS management, web hosting (Enhance), support tickets, blog/CMS, billing, organizations, activity logging, platform maintenance mode.

### Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite + TypeScript |
| Backend | Express 4 + TypeScript |
| Database | PostgreSQL (raw `pg` + Drizzle ORM) |
| UI Components | shadcn/ui + Radix UI primitives |
| State Management | TanStack Query |
| Package Manager (root) | npm + package-lock.json |
| Package Manager (lib/) | pnpm + pnpm-workspace.yaml |

---

## Project Structure

```
skypanelv2/
├── src/                          # React frontend (Vite)
│   ├── pages/                    # Page components
│   ├── components/               # Shared components
│   │   └── ui/                   # shadcn/ui components
│   ├── lib/                      # Utilities, API client
│   └── contexts/                 # React contexts
├── api/                          # Express backend
│   ├── routes/                   # Route handlers
│   │   ├── admin/                # Admin routes
│   │   └── hosting/              # Hosting sub-routes
│   ├── services/                 # Business logic
│   ├── middleware/               # Express middleware
│   ├── lib/                      # Utilities
│   └── config/                   # Configuration
├── lib/                          # Shared workspace packages (pnpm)
│   ├── api-client-react/         # TanStack Query hooks
│   ├── api-zod/                  # Zod schemas
│   ├── api-spec/                 # OpenAPI spec + Orval codegen
│   └── db/                       # Drizzle ORM schema
├── git-docs/                     # Prose documentation; prefer root configs/scripts when docs disagree
├── migrations/                   # SQL migrations (zero-padded NNN_*.sql)
└── scripts/                      # Utility scripts
```

- `lib/api-spec`: run `pnpm codegen` to regenerate clients from `openapi.yaml`.
- `lib/db`: `pnpm push` / `pnpm push-force` to sync Drizzle schema to DB (development only).
- Generated output under `lib/api-client-react/src/generated` and `lib/api-zod/src/generated` is Orval-generated; do not hand-edit.

---

## Essential Commands

```bash
# Install dependencies
npm install  # Node 22.22.0 required

# Development (preferred — runs BOTH frontend + backend)
npm run dev-up        # RECOMMENDED: kills ports 3001/5173/8000 first, then starts both
npm run dev           # Starts both Vite :5173 + Express :3001 concurrently (no port cleanup)

# Development (single service only — use when you need just one side)
npm run client:dev    # Frontend ONLY (Vite :5173)
npm run server:dev    # Backend ONLY (nodemon + tsx :3001)

# Quality checks
npm run check         # TypeScript (tsc --noEmit)
npm run lint          # ESLint (warnings allowed, fix errors)

# Build & tests
npm run build         # tsc -b && vite build
npm test              # All Vitest tests
npx vitest run path/to/file.test.ts  # Single file

# Security
npm run test:security # Security test suite
npm run verify:security  # audit + scan + tests

# Database
node scripts/run-migration.js  # Apply pending migrations
npm run seed:admin     # Create default admin user

# Database (destructive - use with caution)
npm run db:fresh    # Reset + run all migrations (DESTROYS DATA)

# API docs
npm run docs:api:sync  # Sync API docs manifest
npm run docs:api:audit  # Check API docs coverage

# Testing
npm run test:watch     # Watch mode (development)
npm run test:coverage  # Coverage report

# Playwright e2e
npx playwright test    # Run e2e tests
```

Playwright e2e config auto-starts `npm run dev-up` outside CI; base URL defaults to `http://localhost:5173`.

---

## TypeScript & Linting Conventions

- `tsconfig.json` has `"strict": false`, `"noUnusedLocals": false`, `"noUnusedParameters": false`
- **Do not add stricter settings** that the codebase doesn't enforce
- ESLint: `@typescript-eslint/no-explicit-any` is `off`
- Unused vars/params prefixed with `_` are allowed (e.g., `_unused`)
- Backend is ESM (`"type": "module"`): all local imports need `.js` extensions even when importing `.ts` sources

```typescript
// ✅ Correct (ESM extension required)
import { query } from '../lib/database.js';
import { config } from '../config/index.js';

// ❌ Incorrect (will fail in backend)
import { query } from '../lib/database';
```

### Zod Version Awareness

| Context | Zod Version | Import |
|---------|-------------|--------|
| Root (src/, api/) | Zod 4 (`4.1.12`) | `import { z } from 'zod'` |
| lib/* packages | Zod 3 (`3.25.76`) | `import { z } from 'zod'` |

The Zod API differs between major versions — use the correct import for the package context.

---

## Environment Configuration

### Required Environment Variables

```
DATABASE_URL         # PostgreSQL connection string
JWT_SECRET            # JWT signing secret
SSH_CRED_SECRET       # SSH credentials encryption key
```

### Generating Secrets

```bash
node scripts/generate-ssh-secret.js
node scripts/generate-encryption-key.js
```

### Optional but Important

```
LINODE_API_TOKEN              # Linode/VPS provider
PAYPAL_CLIENT_ID              # PayPal integration
PAYPAL_CLIENT_SECRET
PAYPAL_MODE
CLIENT_URL                    # Frontend origin (for PayPal callbacks)

# Email (falls back by EMAIL_PROVIDER_PRIORITY)
EMAIL_PROVIDER_PRIORITY=resend,smtp

# Enhance hosting (optional but exact requirements)
ENHANCE_API_URL               # Panel origin only, no /api
ENHANCE_API_KEY               # Raw token, no Bearer prefix
ENHANCE_MASTER_ORG_ID
ENHANCE_DEFAULT_SERVER_GROUP_ID
```

### Encryption Key Rotation

Both `SSH_CRED_SECRET` and `PROVIDER_TOKEN_SECRET` support rotation via `*_PREVIOUS` env vars:
```
SSH_CRED_SECRET
SSH_CRED_SECRET_PREVIOUS
```

### Additional Variables

```
STARTUP_SIDE_EFFECTS_ENABLED=false  # Disable config validation and cron on import (for safe test boots)
DEFAULT_ADMIN_EMAIL                 # For npm run seed:admin
DEFAULT_ADMIN_PASSWORD              # For npm run seed:admin
```

`api/app.ts` validates config on import and starts metrics/billing cron unless `STARTUP_SIDE_EFFECTS_ENABLED=false`; set that before importing the app for safe validation/test boots.

---

## Commit Conventions

Use conventional-commit prefixes:

| Prefix | Use for |
|--------|---------|
| `feat:` | New features |
| `fix:` | Bug fixes |
| `refactor:` | Code refactoring |
| `style:` | Formatting, no logic change |
| `enhance:` | Enhancements to existing features |

**Always include component name and specific change:**

```
feat: add Console Showcase section with styling enhancements
fix: resolve race condition in VPS power operations
refactor: extract billing calculation helpers to service
```

**Never use generic messages:**
```
❌ "Updated code"
❌ "Fixed bug"
❌ "Changes made"
```

---

## Security-Sensitive Patterns

### Never Add Sensitive Defaults

The Vite build includes a `removeMockData` plugin that strips example emails, passwords, and API tokens from production bundles. **Do not add sensitive-looking defaults to `src/` files.**

### SSH Credentials & Tokens

- SSH credentials are encrypted via `SSH_CRED_SECRET`
- Provider API tokens are encrypted via `PROVIDER_TOKEN_SECRET` (falls back to `SSH_CRED_SECRET`)
- Both support rotation via `*_PREVIOUS` env vars

### Route Order Matters

In `api/app.ts`, public routes must come **before** protected routes:

```typescript
// ✅ Correct order
app.use('/api/hosting', hostingStatusRoutes);  // Public
app.use('/api/blog', blogRoutes);               // Public
app.use('/api', notesRoutes);                    // Protected

// ❌ Incorrect - will cause auth issues
app.use('/api', notesRoutes);                   // Protected
app.use('/api/blog', blogRoutes);               // Never reached
```

---

## Routing & Guards

Route guards in `src/App.tsx`:

| Guard | Use For |
|-------|---------|
| `<ProtectedRoute>` | Authenticated pages (renders `AppLayout` with sidebar) |
| `<AdminRoute>` | Admin-only pages (requires `user.role === 'admin'`) |
| `<StandaloneProtectedRoute>` | SSH console (auth without sidebar) |
| `<HostingEnabledRoute>` | Hosting pages (gated by feature flag) |
| `<HostingMarketingGate>` | Redirects to `/` if hosting disabled |
| `<MaintenanceGuard>` | Redirects non-admins during maintenance |
| `<RegistrationEnabledRoute>` | Redirects to `/login` if registration disabled |

---

## Architecture Hotspots

### Route Registration (`api/app.ts`)

Central bottleneck for all route registration. Hosting sub-routes are individually imported and mounted:

```typescript
// Hosting sub-routes
import hostingWebRoutes from './routes/hosting/web.js';
import hostingNodeRoutes from './routes/hosting/node.js';
import hostingEmailRoutes from './routes/hosting/email.js';
// ... etc
```

### Auth Context (`api/middleware/auth.ts`)

Handles JWT verification, org context, and impersonation.

- Admin routes require `user.role === 'admin'`
- Impersonation is supported but blocked in AdminRoute

### Multi-Tenant Scope

Many tables are multi-tenant. **Resource queries MUST be scoped by `organization_id`.**

```typescript
// ✅ Correct - scoped by organization
await query('SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2', [id, orgId]);

// ❌ Incorrect - fetches across all orgs
await query('SELECT * FROM vps_instances WHERE id = $1', [id]);
```

### Blog Public and Admin Routes

- `api/routes/blog.ts` — Public blog routes
- `api/routes/admin/blog.ts` — Admin CMS routes

### Support Tickets

- `api/routes/support.ts` — Customer ticket routes
- `api/routes/admin/tickets.ts` — Admin ticket management

### Platform Maintenance

- `api/routes/admin/platform.ts` — Toggles maintenance mode
- `api/routes/siteStatus.ts` — Site status endpoints

### Egress Prepaid Billing

- `api/services/egressCreditService.ts` — Egress credit management
- `api/services/egressHourlyBillingService.ts` — Hourly egress billing
- `api/services/egress/` — Egress sub-directory with additional services

### Fraud Screening

- `api/services/fraudLabsProService.ts` — FraudLabs Pro integration

### Refund Processing

- `api/services/refundService.ts` — Refund handling

### Vite Proxy Config

`vite.config.ts` includes SSE/WebSocket handling for `/notifications/stream`.

---

## Key File Locations

| Purpose | Path |
|---------|------|
| Backend entrypoint | `api/server.ts` |
| App builder (routes/middleware) | `api/app.ts` |
| Config (env vars) | `api/config/index.ts` |
| Database (raw pg) | `api/lib/database.ts` |
| API client | `src/lib/api.ts` |
| Auth context | `api/middleware/auth.ts` |
| Theme (frontend) | `src/contexts/ThemeContext.tsx` |
| Theme (API) | `api/routes/theme.ts` |
| Activity logging | `api/services/activityLogger.ts` |
| Error handling | `api/lib/errorHandling.ts` |

---

## Backend Rules

- `/api` gets CSRF, API-key auth, smart rate limits, and rate-limit headers in `api/app.ts`.
- `api/app.ts` validates config on import and starts metrics/billing cron unless `STARTUP_SIDE_EFFECTS_ENABLED=false`; set that before importing the app for safe validation/test boots.
- Route/service files should import `config` from `api/config/index.ts`; do not read `process.env` directly except in config/bootstrap code.
- Apply auth/organization middleware at router level (`router.use(...)`) where possible.
- Business errors usually return `{ error: "message" }`; provider/Linode errors should use `handleProviderError()` from `api/lib/errorHandling.ts`.

---

## Activity Logging

Log meaningful successful mutations with `logActivity()` from `api/services/activityLogger.ts`.

| Action Type | Use For |
|-------------|---------|
| `vps.created` | VPS instance created |
| `vps.deleted` | VPS instance deleted |
| `vps.rebuilt` | VPS OS rebuilt |
| `vps.power_on` | VPS powered on |
| `vps.power_off` | VPS powered off |
| `ssh.session_started` | SSH session started |
| `billing.credited` | Account credited |
| `support.ticket_created` | Support ticket created |
| `support.ticket_replied` | Support ticket replied |
| `blog.post_created` | Blog post created |
| `blog.post_updated` | Blog post updated |

Use existing types; do not invent ad-hoc strings.

---

## Package Manager Split

Package manager split is intentional: root app scripts and `package-lock.json` use npm; `pnpm-workspace.yaml`/`pnpm-lock.yaml` are for `lib/*` workspace packages and catalog deps. Do not infer root React/Vite/Zod versions from the pnpm catalog — root is React 18 / Zod 4, catalog targets React 19 / Zod 3 for lib packages.

---

## Reference Files

For domain-specific guidance, see:

- [always-applied.md](always-applied.md) — Global rules that always apply
- [backend.md](backend.md) — API routes, services, middleware
- [frontend.md](frontend.md) — React components, TanStack Query, routing
- [database.md](database.md) — Migrations, schema conventions
- [testing.md](testing.md) — Test patterns and conventions
- [hosting.md](hosting.md) — Enhance hosting specifics