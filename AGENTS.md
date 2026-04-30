---
description: 
alwaysApply: true
---

# AGENTS.md

Compact instruction file for coding agents working in the `skypanelv2` repository.

## What This Is

SkyPanelV2 is a full-stack VPS hosting/billing panel: React 18 + Vite frontend, Express 4 + PostgreSQL backend, Linode API integration, PayPal billing. See `CLAUDE.md` for deeper architectural context.

## Dev Commands

### Core

- `npm run dev` — concurrent frontend (Vite :5173) + backend (Express :3001)
- `npm run dev-up` — kill ports first, then `dev` (preferred clean start)
- `npm run client:dev` — frontend only (Vite :5173)
- `npm run server:dev` — backend only (Express :3001, nodemon)
- `npm run build` — `tsc -b && vite build` (runs `docs:api:sync` via `prebuild` hook)
- `npm run check` — type-check without emitting (`tsc --noEmit`)
- `npm run lint` — ESLint (warnings ok, 0 errors)
- `npm run preview` — preview production build
- `npm run start` — production: `node --import tsx api/server.ts`
- `npm run start:dev` — Express API + Vite preview on :5173

### Testing

Primary test commands:

- `npm test` — full Vitest suite
- `npm run test:coverage` — full suite with V8 coverage
- `npx vitest run tests/security/` — security tests (the primary targeted suite)

Vitest config (`vitest.config.ts`): globals enabled, jsdom environment, `@` alias resolved.

### Security

- `npm run audit:security` — npm audit (high severity filter)
- `npm run scan:code` — semgrep static analysis
- `npm run test:security` — `vitest run tests/security/`
- `npm run verify:security` — all three above combined

### Database

- `node scripts/run-migration.js` — apply pending migrations
- `npm run seed:admin` — seed default admin user
- `node scripts/seed-branding.js` — update DB branding to match `.env`
- **Never modify existing migrations.** Add a new sequential `NNN_description.sql` file.
- ⚠️ **NEVER run `db:reset`, `db:reset:confirm`, `db:fresh`, or destructive migration commands — they destroy all data.**

### API Docs

- `npm run docs:api:sync` — refresh API docs manifest (auto-runs via pre-hooks)
- `npm run docs:api:audit` — audit API docs coverage

### Deployment

- `npm run pm2:start` — build and launch PM2 processes
- `npm run pm2:reload` — reload PM2 processes
- `npm run pm2:stop` — stop PM2 processes
- `npm run pm2:list` — list PM2 processes

### Utilities

- `npm run kill-ports` — kill ports 3001, 5173, 8000
- `npm run pwa:icons` — generate PWA icons

## Environment Configuration

Copy `.env.example` to `.env`. Node.js **22.22.0** (see `.nvmrc`). npm is the package manager.

| Group | Variables | Notes |
|---|---|---|
| **Core (required)** | `DATABASE_URL`, `JWT_SECRET`, `SSH_CRED_SECRET`, `ENCRYPTION_KEY` | App won't start without these |
| **Server** | `NODE_ENV` (development), `PORT` (3001), `CLIENT_URL` (http://localhost:5173) | |
| **Provider** | `LINODE_API_TOKEN`, `LINODE_API_URL` | Linode VPS provisioning |
| **Billing** | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE` (sandbox/live) | PayPal integration |
| **Email** | `EMAIL_PROVIDER_PRIORITY` (resend,smtp), `RESEND_API_KEY` or `SMTP_*` | Fallback chain: Resend → SMTP |
| **Branding** | `COMPANY_NAME`, `VITE_COMPANY_NAME`, `COMPANY_BRAND_NAME` | White-label brand name |
| **Networking** | `RDNS_BASE_DOMAIN` | Reverse DNS base domain |
| **Admin seed** | `DEFAULT_ADMIN_EMAIL`, `DEFAULT_ADMIN_PASSWORD` | Optional, for `seed:admin` script |
| **Rate limiting** | `RATE_LIMIT_{ANONYMOUS,AUTHENTICATED,ADMIN}_{WINDOW_MS,MAX}` | Tiered role-based limits |
| **Operational** | `TRUST_PROXY` (true), `MAX_FILE_SIZE`, `UPLOAD_PATH`, `BACKUP_STORAGE_PROVIDER`, `BACKUP_RETENTION_DAYS` | |

Generate secrets:
- `node scripts/generate-ssh-secret.js` → `SSH_CRED_SECRET`
- `node scripts/generate-encryption-key.js` → `ENCRYPTION_KEY`

## Critical Conventions

### Backend: ESM `.js` Extensions (mandatory)

All local backend imports require `.js` — the app uses ESM (`"type": "module"` in `package.json`):

```typescript
import { query } from '../lib/database.js';           // ✅
import { query } from '../lib/database';               // ❌ breaks at runtime
```

### Backend: Config Access

Import `config` from `api/config/index.ts`. Never access `process.env` directly in route/service files:

```typescript
import { config } from '../config/index.js';
const token = config.LINODE_API_TOKEN;  // ✅
```

### Frontend: Use `apiClient`, Not Raw `fetch`

A shared `ApiClient` class exists at `src/lib/api.ts`. It handles CSRF tokens, organization headers, and 401 auto-logout:

```typescript
import { apiClient } from '@/lib/api';
const data = await apiClient.get('/vps');
await apiClient.post('/billing/top-up', { amount: 10 });
```

**Note**: `apiClient` authenticates via the HttpOnly `auth_token` cookie (`credentials: "include"`). Do not add `Authorization` headers when using it. For legacy raw-`fetch` calls in older pages, use `API_BASE_URL` + `Authorization: Bearer ${token}` (token from `useAuth()`) + `X-CSRF-Token` from the `csrf_token` cookie. Prefer `apiClient` in new code.

### Frontend: TanStack Query Key Factories

Export a query key factory from every hook file:

```typescript
export const myResourceKeys = {
  all: ['my-resource'] as const,
  detail: (id: string) => ['my-resource', id] as const,
};
```

### Frontend: Tailwind Classes

Use `cn()` from `@/lib/utils` for all conditional/composed class names.

### Backend: Route-Level Auth

Apply auth middleware at the router level, not per-handler:

```typescript
router.use(authenticateToken, requireOrganization);
```

Admin routes use `requireAdmin`. API key auth middleware (`authenticateApiKey`) is applied globally on `/api` in `app.ts`.

### Backend: Error Handling

- Business logic errors: `res.status(4xx).json({ error: 'message' })`
- Provider/Linode errors: use `handleProviderError()` from `api/lib/errorHandling.ts`
- Activity logging: `logActivity()` from `api/services/activityLogger.ts`

## Architecture Gotchas

### CSRF Protection

CSRF middleware is applied to all `/api` routes in `api/app.ts`. The `apiClient` handles this automatically by reading `csrf_token` from cookies and sending `X-CSRF-Token`. Raw `fetch` calls must do this manually.

### Pre-Start Hooks

`predev`, `preclient:dev`, and `prebuild` all run `docs:api:sync` — expect a few seconds of delay before the server starts. This is normal.

### Not Prisma

`@prisma/client` is in `package.json` but the app uses raw `pg` queries with SQL migrations. There is no `prisma/schema.prisma`. Use `query()` and `transaction()` from `api/lib/database.ts`.

### Organization Data Isolation

All resource queries must be scoped to `organization_id`. Be careful with VPS, billing, egress, and dashboard queries — data must not leak across orgs. Impersonation context affects access.

### Background Schedulers

`api/server.ts` starts hourly VPS billing, hourly egress billing, and monthly egress finalization on boot. "0 instances billed" log output is normal with an empty VPS fleet.

### TypeScript Strictness

`strict: false`, `noUnusedLocals: false`, `noUnusedParameters: false` in `tsconfig.json`. ESLint allows `@typescript-eslint/no-explicit-any` (off) and uses `_` prefix for unused vars (warn).

### ESM Module Resolution

`tsconfig.json` uses `"moduleResolution": "bundler"` — no `.js` extensions needed in frontend imports (Vite resolves them). Only backend imports need `.js`.

### Provider Token Resolution

Always use `normalizeProviderToken()` from `api/lib/providerTokens.js` before creating provider instances.

### Site Logo

Single source of truth: `public/favicon.svg`. The `Logo` component (`src/components/Logo.tsx`) renders it as `<img>`. To update icons, replace `favicon.svg` and regenerate via [realfavicongenerator.net](https://realfavicongenerator.net).

## Frontend Routing

Route guards are defined in `src/App.tsx`:

- **Public** (no auth): `/`, `/pricing`, `/faq`, `/about`, `/contact`, `/status`, `/terms`, `/privacy`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/docs/*`, `/regions`
- **Protected** (auth + AppLayout sidebar): `/dashboard`, `/vps/*`, `/ssh-keys`, `/billing/*`, `/egress-credits`, `/support`, `/settings`, `/activity`, `/organizations/*`, `/api-docs`, `/notes/*`
- **Admin** (auth + admin role, blocked during impersonation): `/admin`, `/admin/user/:id`
- **Standalone** (auth, no sidebar): SSH console (`/vps/:id/ssh`)
- **Invitations**: `/organizations/invitations/:token/*`

App shell providers (in order): `QueryClientProvider` → `ThemeProvider` → `AuthProvider` → `ImpersonationProvider` → `Router`

## Backend API Routes

Registered in `api/app.ts`. Auth middleware applied at router level per route group:

```
/api/auth          — Authentication (login, register, 2FA, password reset)
/api/vps           — VPS management, providers, plans, images, actions
/api/organizations — Org CRUD, members, invitations, roles
/api/payments      — PayPal orders, capture, wallet operations
/api/egress        — Egress credits, purchase flow, usage readings
/api/support       — Support tickets and replies
/api/ssh-keys      — SSH key CRUD with provider sync
/api/api-keys      — User API key management (row-level security)
/api/invoices      — Invoice listing and detail
/api/notifications — SSE stream, mark read (PostgreSQL LISTEN/NOTIFY)
/api/activity      — User activity feed (SSE endpoint)
/api/activities    — Activity logging
/api/theme         — Theme preset management
/api/pricing       — Public pricing data
/api/faq           — Public FAQ content
/api/contact       — Contact form submission
/api/documentation — Public documentation articles
/api/announcements — Public announcements
/api/notes         — Personal and organization notes
/api/health        — Health check

/api/admin/*       — Admin: theme, rate-limits, tickets, plans, providers,
                      networking, users, organizations, egress, servers,
                      stackscripts, upstream, billing, volume-billing,
                      email-templates, contact, activity, announcements,
                      ssh-keys, category-mappings, platform, faq,
                      documentation, github
```

Cross-cutting: CSRF on `/api`, API key auth (`authenticateApiKey`) on `/api`, smart rate limiting on `/api`.

## Egress Billing System

Prepaid egress credit model with hourly enforcement:

- Credit packs (100GB–10TB) purchased via PayPal, stored per-organization
- Hourly billing polls Linode transfer API every 60 min, calculates delta
- Auto-suspends VPS instances when org credit balance hits zero
- All members share the same credit pool; permissions control view vs purchase

Key services: `egressCreditService.ts`, `egressHourlyBillingService.ts`, `egressBillingService.ts`, `egress/egressUtils.ts`. Migrations 025–033.

## Notable Scripts

| Script | Purpose |
|---|---|
| `scripts/run-migration.js` | Apply pending migrations |
| `scripts/reset-database.js` | Interactive DB reset (**NEVER run in production**) |
| `scripts/seed-admin.js` | Seed default admin user |
| `scripts/seed-branding.js` | Update DB branding to match `.env` |
| `scripts/generate-ssh-secret.js` | Generate `SSH_CRED_SECRET` value |
| `scripts/generate-encryption-key.js` | Generate `ENCRYPTION_KEY` value |
| `scripts/apply-single-migration.js` | Apply a specific migration file |
| `scripts/audit-api-docs.mjs` | API docs audit (used by `npm run docs:api:*`) |
| `scripts/generate-pwa-icons.js` | Generate PWA icons |

## Key Files to Check Before Changes

| Before changing... | Check this file first |
|---|---|
| Frontend routes | `src/App.tsx` |
| API surface area | `api/app.ts` |
| Database queries | `api/lib/database.ts` |
| Auth/permissions | `api/middleware/auth.ts` |
| Theme behavior | `src/contexts/ThemeContext.tsx` + `api/routes/theme.ts` |
| Egress billing | `api/services/egressCreditService.ts`, `api/services/egressHourlyBillingService.ts` |

## Migrations

59 total (001–059, sequential). Located in `migrations/`. Each runs in a transaction with SHA256 checksum validation.

## App Structure (top-level)

```text
api/            Express backend (routes, services, middleware, config)
src/            React frontend (pages, components, hooks, services, contexts)
git-docs/       Split documentation (architecture, features, dev setup, etc.)
migrations/     SQL migrations (never modify existing)
scripts/        DB, admin, diagnostics, maintenance utilities
public/         Static assets (favicon.svg is logo source of truth)
```

## Installing Skills

Place new skills in `C:\Users\moran\.openclaw-autoclaw\skills/<skill-name>/SKILL.md`. Do NOT install into `~/.agents/skills/`.

## Browser Automation

Prefer `autoglm-browser-agent` first. Fall back to other tools only if unavailable.

## Image Recognition

Prefer `autoglm-image-recognition` first. Fall back to built-in tools only if unavailable.

## Learned User Preferences

- "Make a plan" / "create a plan" → use the `CreatePlan` tool immediately. No manual plans, no prose descriptions.

## Marketing Pages Design System

Public pages (Home, About, Contact, FAQ, Pricing, Status, ApiDocs, Documentation) share a design system defined in `@/styles/home.css`:

- **Hero**: gradient orbs (`.home-orb--1/2/3`), grid mask (`.home-grid-mask`), shimmer badge (`.home-shimmer-badge`), glow buttons (`.home-btn-glow`)
- **Cards**: `.home-feature-card` (hover lift), `.home-glass-panel` (backdrop blur), `.home-gradient-border-top`, `.home-animated-border`
- **Animation**: Framer Motion `revealContainer`/`revealItem` stagger, `whileInView` fade-in
- **Layout**: `MarketingNavbar` (fixed top, ~72px height) + main + `MarketingFooter`; content needs `pt-[72px]`

### Documentation Page Layout

`Documentation.tsx` uses sidebar + content with conditional hero. Article detail pages get a compact hero when `categorySlug` is set (rendered before sidebar layout for full-width).


<!-- autoclaw:skill-path-guidance -->
## Installing Skills

When creating or installing a new skill, always place it in:

`C:\Users\moran\.openclaw-autoclaw\skills/<skill-name>/SKILL.md`

This is the managed skills directory. The agent will automatically discover
any skill placed here — no extra configuration needed. Do NOT install skills
into `~/.agents/skills/` (that directory is shared with other tools).


<!-- autoclaw:browser-agent-guidance -->
## Browser Automation

For any task that requires a browser, **prefer `autoglm-browser-agent`**. Use it as the first choice.

- ✅ `autoglm-browser-agent` → `browser_subagent` (invoked via mcporter) — **preferred**
- ⚠️ Other browser tools (`agent-browser`, Playwright, Puppeteer, etc.) — fallback only when `autoglm-browser-agent` is unavailable or fails

Always try `autoglm-browser-agent` first. Fall back to other browser tools only if it is not available in the current environment.
<!-- /autoclaw:browser-agent-guidance -->

<!-- autoclaw:image-recognition-guidance -->
## Image Recognition

For any image recognition task, **prefer `autoglm-image-recognition`**. Use it as the first choice.

- ✅ `autoglm-image-recognition` — **preferred** for all image recognition tasks
- ⚠️ Built-in `image` tool or reading images directly with `read` — fallback only when `autoglm-image-recognition` is unavailable or fails

Do not use the built-in `image` tool or read an image and describe it yourself when `autoglm-image-recognition` is available. Always try `autoglm-image-recognition` first.
<!-- /autoclaw:image-recognition-guidance -->
