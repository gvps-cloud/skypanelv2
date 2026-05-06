---
description: Compact contributor guide for coding agents working in skypanelv2
alwaysApply: true
---

# AGENTS.md

Compact guidance for coding agents in `skypanelv2`. `CLAUDE.md` delegates here; treat this file as the source of truth when instruction files conflict.

## Project Structure

- `src/` — React 18 + Vite + TypeScript frontend. Pages in `src/pages/`, components in `src/components/`, shared UI via shadcn/ui in `src/components/ui/`.
- `api/` — Express 4 + TypeScript backend. Routes in `api/routes/`, services in `api/services/`, middleware in `api/middleware/`.
- `lib/` — Shared workspace packages (pnpm): `api-client-react` (TanStack Query hooks), `api-zod` (Zod schemas), `api-spec` (OpenAPI spec + Orval codegen), `db` (Drizzle ORM schema).
  - `lib/api-spec`: run `pnpm codegen` to regenerate clients from `openapi.yaml`.
  - `lib/db`: `pnpm push` / `pnpm push-force` to sync Drizzle schema to DB (development only).
  - Generated output under `lib/api-client-react/src/generated` and `lib/api-zod/src/generated` is Orval-generated; do not hand-edit.
- `migrations/` — Numbered SQL migrations (zero-padded `NNN_*.sql`); see Database section.
- `git-docs/` — Prose documentation; prefer root configs/scripts when docs disagree.
- Package manager split is intentional: root app scripts and `package-lock.json` use npm; `pnpm-workspace.yaml`/`pnpm-lock.yaml` are for `lib/*` workspace packages and catalog deps. Do not infer root React/Vite/Zod versions from the pnpm catalog — root is React 18 / Zod 4, catalog targets React 19 / Zod 3 for lib packages.
- Three product surfaces: public marketing pages, customer portal (dashboard/VPS/billing/support), admin dashboard.
- Key feature areas: VPS management, web hosting (Enhance), support tickets, blog/CMS, billing, organizations, activity logging, platform maintenance mode.

## Commands

- Install: `npm install` on Node `22.22.0` (`.nvmrc`, `package.json#engines`).
- Dev all: `npm run dev` (Vite `:5173` + Express `:3001`). Clean dev start: `npm run dev-up` (kills `3001`, `5173`, `8000` first).
- Frontend only: `npm run client:dev`. Backend only: `npm run server:dev` (`nodemon` -> `tsx api/server.ts`).
- Typecheck: `npm run check` (`tsc --noEmit`). Lint: `npm run lint` (ESLint warnings are allowed; errors should be fixed). There is a `biome.json` but no root Biome script.
- Build: `npm run build` (`tsc -b && vite build`). `predev`, `preclient:dev`, and `prebuild` run `npm run docs:api:sync` first.
- Tests: `npm test` or `npx vitest run`. Focus one file: `npx vitest run path/to/file.test.ts`.
- Security suite: `npm run test:security`. Full verification: `npm run verify:security`.
- Playwright e2e config auto-starts `npm run dev-up` outside CI; base URL defaults to `http://localhost:5173`.
- API docs: `npm run docs:api:sync` updates `src/lib/apiRouteManifest.ts`; `npm run docs:api:audit` checks coverage.
- Admin seed: `npm run seed:admin` (uses `DEFAULT_ADMIN_EMAIL`/`DEFAULT_ADMIN_PASSWORD` env vars).

## TypeScript & Lint Conventions

- `tsconfig.json` has `"strict": false`, `"noUnusedLocals": false`, `"noUnusedParameters": false`. Do not add strict assertions that the codebase doesn't enforce.
- ESLint: `@typescript-eslint/no-explicit-any` is `off`; unused vars/params prefixed with `_` are allowed. Do not "fix" these to stricter settings.
- Backend is ESM (`"type": "module"`): all local backend imports need `.js` extensions even when importing `.ts` sources.
- Root uses Zod 4 (`"zod": "4.1.12"`); pnpm catalog uses Zod 3 (`"zod": "3.25.76"`). The Zod API differs between major versions — use the correct import for the package context.

## Commit Conventions

- Conventional-commit prefixes: `feat:`, `fix:`, `refactor:`, `style:`, `enhance:`.
- Include component name and specific change in the message (e.g., `feat: add Console Showcase section with styling enhancements`).
- No generic or vague commit messages.

## Environment

- Copy `.env.example` to `.env`; backend loads `.env` in `api/app.ts` unless `IN_DOCKER` is set.
- Required core vars: `DATABASE_URL`, `JWT_SECRET`, `SSH_CRED_SECRET`. Generate secrets with `node scripts/generate-ssh-secret.js`.
- Encryption keys: `SSH_CRED_SECRET` encrypts SSH credentials; `PROVIDER_TOKEN_SECRET` encrypts provider API tokens (falls back to `SSH_CRED_SECRET` if unset). Both support rotation via `*_PREVIOUS` env vars. `node scripts/generate-encryption-key.js` generates an `ENCRYPTION_KEY` env var referenced in docs and `scripts/verify-env.js` but not read by any runtime code.
- Linode/VPS uses `LINODE_API_TOKEN`; PayPal uses `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE`; email falls back by `EMAIL_PROVIDER_PRIORITY` (`resend,smtp`).
- Enhance hosting config is optional but exact: `ENHANCE_API_URL` is panel origin only, no `/api`; `ENHANCE_API_KEY` is raw token, no `Bearer`; `ENHANCE_MASTER_ORG_ID` and `ENHANCE_DEFAULT_SERVER_GROUP_ID` are used by hosting flows.
- `CLIENT_URL` drives PayPal return/cancel URLs and must match the frontend origin.
- `api/app.ts` validates config on import and starts metrics/billing cron unless `STARTUP_SIDE_EFFECTS_ENABLED=false`; set that before importing the app for safe validation/test boots.

## Backend Rules

- `api/server.ts` is the listening entrypoint; `api/app.ts` builds middleware/routes and also serves `dist/` if it exists, regardless of `NODE_ENV`.
- Route/service files should import `config` from `api/config/index.ts`; do not read `process.env` directly except in config/bootstrap code.
- Apply auth/organization middleware at router level (`router.use(...)`) where possible. `/api` gets CSRF, API-key auth, smart rate limits, and rate-limit headers in `api/app.ts`.
- Route order in `api/app.ts` matters: public `/api/hosting` status routes and `/api/blog` must stay before `notesRoutes`, because `notesRoutes` is mounted at `/api` and applies global auth.
- Business errors usually return `{ error: "message" }`; provider/Linode errors should use `handleProviderError()` from `api/lib/errorHandling.ts`.
- Log meaningful successful mutations with `logActivity()` from `api/services/activityLogger.ts`.
- Common activity action types: `vps.created`, `vps.deleted`, `vps.rebuilt`, `vps.power_on`, `vps.power_off`, `ssh.session_started`, `billing.credited`, `support.ticket_created`, `support.ticket_replied`, `blog.post_created`, `blog.post_updated`. Use existing types; do not invent ad-hoc strings.
- Scope resource queries by `organization_id`. Many tables are multi-tenant; do not fetch by resource id alone.

## Frontend Rules

- Use `apiClient` from `src/lib/api.ts` for new API calls. It sends cookies/CSRF/org headers and handles 401 logout; do not add `Authorization` headers with it.
- Frontend API paths default to `/api`; Vite proxies `/api/` to `localhost:3001` in dev. Avoid hardcoding backend origins in client code.
- For rare raw `fetch` paths (uploads/downloads, API docs try-it, impersonation), use `buildApiUrl`/`API_BASE_URL`, `credentials: "include"`, and preserve required CSRF/org/API-key/bearer headers.
- Export TanStack Query key factories from hook files, e.g. `fooKeys.detail(id)`, and invalidate by those keys after mutations.
- Use `cn()` from `@/lib/utils` for conditional/composed Tailwind classes.
- Public marketing pages share `@/styles/home.css`; `MarketingNavbar` is fixed and offset by `--announcement-banner-height` from `AnnouncementBanner`.
- Logo source of truth is `public/favicon.svg`; `Logo` renders it as an image.
- Route guards in `src/App.tsx`: `<ProtectedRoute>` renders `AppLayout`; `<AdminRoute>` requires `user.role === 'admin'` and blocks impersonation; `<HostingEnabledRoute>` gates hosting pages; `<HostingMarketingGate>` redirects to `/` if hosting disabled; `<MaintenanceGuard>` redirects non-admins to `/maintenance`; `<RegistrationEnabledRoute>` redirects to `/login` if registration disabled.
- Vite build includes a `removeMockData` plugin that strips example emails, passwords, and API tokens from production bundles. Do not add sensitive-looking defaults to `src/` files expecting them to ship.

## Database & Migrations

- Two DB access patterns coexist: `api/` uses raw `pg` through `api/lib/database.ts` (the primary path); `lib/db` (`@workspace/db`) uses Drizzle ORM with `drizzle-kit` for schema definitions. New backend routes should use the raw `pg` `query()` helper from `api/lib/database.ts`.
- `@workspace/db` exports `./src/index.ts` (query helpers) and `./schema` (Drizzle schema definitions).
- Migrations are zero-padded SQL files in `migrations/`. Never modify an existing migration; add the next numbered `NNN_short_description.sql`.
- Apply pending migrations with `node scripts/run-migration.js`. Do not run `db:reset`, `db:reset:confirm`, or `db:fresh` unless explicitly requested; they destroy data.
- Migration runner validates SHA256 checksums; if a previously-applied migration has a changed checksum, it logs a warning and skips that file (does not error out).
- Schema conventions: UUID PKs (`gen_random_uuid()`), `TIMESTAMPTZ` timestamps, `deleted_at` for soft deletes, `JSONB DEFAULT '{}'` for config/metadata, explicit `ON DELETE CASCADE` or `ON DELETE SET NULL` on all foreign keys.

## Testing Notes

- Vitest config uses `globals: true`, `jsdom`, `@` -> `src`, `testTimeout: 15000`, and `fileParallelism: false` to avoid DB/rate-limiter state interference.
- Test include globs: `src/**/*.{test,spec}.*`, `tests/security/**/*`, `tests/integration/**/*`, and `api/**/*.test.ts`; `tests/e2e/**` is excluded from Vitest.
- Some backend route tests use the real `DATABASE_URL` and insert/delete rows directly; inspect setup/cleanup before adding cases and avoid destructive DB scripts.
- Common targeted command after hosting/API work: `npx vitest run api/routes/__tests__/hosting-store.test.ts api/tests/hosting-purchase-saga.test.ts`.

## Enhance Hosting Gotchas

- Official Enhance API reference is `repo-docs/enhance-oas3-api.yaml`; verify endpoint payloads there before changing hosting routes/services.
- Customer websites must use the customer Enhance org id, not the master org. Use `getHostingSubscriptionForOrganization()` when a route needs `enhance_customer_org_id`; `SELECT * FROM hosting_subscriptions` alone is not enough.
- Initial hosting checkout requires a real domain. Do not offer or auto-generate Enhance staging domains during checkout.
- Before creating Enhance provider/client calls, preserve `normalizeProviderToken()` usage for provider tokens.

## Architecture Hotspots

- Route registration and middleware order: `api/app.ts`. Hosting sub-routes (web, node, email, dns, wordpress, joomla, mysql, ftp, ssl, apps, backups, cron, ssh) are individually imported and mounted.
- Blog public and admin routes: `api/routes/blog.ts` (public), `api/routes/admin/blog.ts` (admin CMS).
- Support tickets: `api/routes/support.ts` (customer), `api/routes/admin/tickets.ts` (admin).
- Platform maintenance: `api/routes/admin/platform.ts`, `api/routes/siteStatus.ts`.
- Auth, org context, impersonation: `api/middleware/auth.ts` and organization routes.
- Hosting purchase/onboarding: `api/routes/hosting/store.ts`, `api/services/enhanceOnboardingService.ts`, `api/services/enhanceService.ts`.
- Hosting billing: `api/services/hostingBillingService.ts` — monthly recurring billing.
- Egress prepaid billing: `api/services/egressCreditService.ts`, `api/services/egressHourlyBillingService.ts`, `api/services/egress/` sub-directory.
- Fraud screening: `api/services/fraudLabsProService.ts`.
- Refund processing: `api/services/refundService.ts`.
- Theme behavior is dual-path: frontend `src/contexts/ThemeContext.tsx` and API route `api/routes/theme.ts`.
- Vite proxy config in `vite.config.ts` includes SSE/WebSocket handling for `/notifications/stream`.
