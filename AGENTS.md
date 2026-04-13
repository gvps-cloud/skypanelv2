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
- `npm run build` — `tsc -b && vite build` (runs `docs:api:sync` via `prebuild` hook)
- `npm run check` — type-check without emitting (`tsc --noEmit`)
- `npm run lint` — ESLint (warnings ok, 0 errors)

### Testing

**No `npm test` script exists.** Run directly:

- `npx vitest run tests/security/` — security tests (the primary test suite)
- `npx vitest run` — all tests

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

For one-off calls, `API_BASE_URL` is also exported. Get JWT token from `useAuth()` context hook.

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

`api/server.ts` starts hourly billing, egress billing, and 24h low-balance reminders on boot. "0 instances billed" log output is normal with an empty VPS fleet.

### TypeScript Strictness

`strict: false`, `noUnusedLocals: false`, `noUnusedParameters: false` in `tsconfig.json`. ESLint allows `@typescript-eslint/no-explicit-any` (off) and uses `_` prefix for unused vars (warn).

### ESM Module Resolution

`tsconfig.json` uses `"moduleResolution": "bundler"` — no `.js` extensions needed in frontend imports (Vite resolves them). Only backend imports need `.js`.

### Provider Token Resolution

Always use `normalizeProviderToken()` from `api/lib/providerTokens.js` before creating provider instances.

### Site Logo

Single source of truth: `public/favicon.svg`. The `Logo` component (`src/components/Logo.tsx`) renders it as `<img>`. To update icons, replace `favicon.svg` and regenerate via [realfavicongenerator.net](https://realfavicongenerator.net).

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

53 total (001–053, sequential). Located in `migrations/`. Each runs in a transaction with SHA256 checksum validation.

## App Structure (top-level)

```text
api/            Express backend (routes, services, middleware, config)
src/            React frontend (pages, components, hooks, services, contexts)
migrations/     SQL migrations (never modify existing)
scripts/        DB, admin, diagnostics, maintenance utilities
public/         Static assets (favicon.svg is logo source of truth)
```

## Environment Setup

Copy `.env.example` to `.env`. Required values:

```bash
DATABASE_URL=postgresql://...
JWT_SECRET=...
SSH_CRED_SECRET=32-char-key
ENCRYPTION_KEY=32-char-key
```

Node.js **22.22.0** (see `.nvmrc`). npm is the package manager.

Generate secrets:
- `node scripts/generate-ssh-secret.js`
- `node scripts/generate-encryption-key.js`

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
