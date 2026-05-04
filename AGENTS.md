---
description: Compact contributor guide for coding agents working in skypanelv2
alwaysApply: true
---

# AGENTS.md

Compact guidance for coding agents in `skypanelv2`. `CLAUDE.md` delegates here; treat this file as the source of truth when instruction files conflict.

## Project Structure

- `src/` — React 18 + Vite + TypeScript frontend. Pages in `src/pages/`, components in `src/components/`, shared UI via shadcn/ui in `src/components/ui/`.
- `api/` — Express 4 + TypeScript backend. Routes in `api/routes/`, services in `api/services/`, middleware in `api/middleware/`.
- `lib/` — Shared workspace packages: `api-client-react` (TanStack Query hooks), `api-zod` (Zod request/response schemas), `api-spec` (OpenAPI spec + orval codegen at `openapi.yaml`), `db` (Drizzle ORM schema — see Database section).
- `migrations/` — Numbered SQL migrations; see Database & Migrations.
- `git-docs/` — Prose documentation; prefer root configs/scripts when docs disagree.
- Package manager split is intentional: root app scripts and `package-lock.json` use npm; `pnpm-workspace.yaml`/`pnpm-lock.yaml` are for `lib/*` workspace packages and catalog deps. Do not infer root React/Vite versions from the pnpm catalog.
- Three product surfaces: public marketing pages, customer portal (dashboard/VPS/billing), admin dashboard.

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
- OpenAPI client/Zod output under `lib/api-client-react/src/generated` and `lib/api-zod/src/generated` is Orval-generated from `lib/api-spec/openapi.yaml`; do not hand-edit generated files.

## Commit Conventions

- Conventional-commit prefixes: `feat:`, `fix:`, `refactor:`, `style:`, `enhance:`.
- Include component name and specific change in the message (e.g., `feat: add Console Showcase section with styling enhancements`).
- No generic or vague commit messages.

## Environment

- Copy `.env.example` to `.env`; backend loads `.env` in `api/app.ts` unless `IN_DOCKER` is set.
- Required core vars: `DATABASE_URL`, `JWT_SECRET`, `SSH_CRED_SECRET`, `ENCRYPTION_KEY`. Generate secrets with `node scripts/generate-ssh-secret.js` and `node scripts/generate-encryption-key.js`.
- Linode/VPS uses `LINODE_API_TOKEN`; PayPal uses `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE`; email falls back by `EMAIL_PROVIDER_PRIORITY` (`resend,smtp`).
- Enhance hosting config is optional but exact: `ENHANCE_API_URL` is panel origin only, no `/api`; `ENHANCE_API_KEY` is raw token, no `Bearer`; `ENHANCE_MASTER_ORG_ID` and `ENHANCE_DEFAULT_SERVER_GROUP_ID` are used by hosting flows.
- `CLIENT_URL` drives PayPal return/cancel URLs and must match the frontend origin.
- `api/app.ts` validates config on import and starts metrics/billing cron unless `STARTUP_SIDE_EFFECTS_ENABLED=false`; set that before importing the app for safe validation/test boots.

## Backend Rules

- Backend is ESM (`"type": "module"`): all local backend imports need `.js` extensions even when importing `.ts` sources.
- `api/server.ts` is the listening entrypoint; `api/app.ts` builds middleware/routes and also serves `dist/` if it exists, regardless of `NODE_ENV`.
- Route/service files should import `config` from `api/config/index.ts`; do not read `process.env` directly except in config/bootstrap code.
- Apply auth/organization middleware at router level (`router.use(...)`) where possible. `/api` gets CSRF, API-key auth, smart rate limits, and rate-limit headers in `api/app.ts`.
- Route order in `api/app.ts` matters: public `/api/hosting` status routes must stay before `notesRoutes`, because `notesRoutes` is mounted at `/api` and applies global auth.
- Business errors usually return `{ error: "message" }`; provider/Linode errors should use `handleProviderError()` from `api/lib/errorHandling.ts`.
- Log meaningful successful mutations with `logActivity()` from `api/services/activityLogger.ts`.
- Common activity action types: `vps.created`, `vps.deleted`, `vps.rebuilt`, `vps.power_on`, `vps.power_off`, `ssh.session_started`, `billing.credited`. Use existing types; do not invent ad-hoc strings.
- Scope resource queries by `organization_id`. Many tables are multi-tenant; do not fetch by resource id alone.

## Frontend Rules

- Use `apiClient` from `src/lib/api.ts` for new API calls. It sends cookies/CSRF/org headers and handles 401 logout; do not add `Authorization` headers with it.
- Frontend API paths default to `/api`; Vite proxies `/api/` to `localhost:3001` in dev. Avoid hardcoding backend origins in client code.
- For rare raw `fetch` paths (uploads/downloads, API docs try-it, impersonation), use `buildApiUrl`/`API_BASE_URL`, `credentials: "include"`, and preserve required CSRF/org/API-key/bearer headers.
- Export TanStack Query key factories from hook files, e.g. `fooKeys.detail(id)`, and invalidate by those keys after mutations.
- Use `cn()` from `@/lib/utils` for conditional/composed Tailwind classes.
- Public marketing pages share `@/styles/home.css`; `MarketingNavbar` is fixed and offset by `--announcement-banner-height` from `AnnouncementBanner`.
- Logo source of truth is `public/favicon.svg`; `Logo` renders it as an image.
- Route guards in `src/App.tsx`: `<ProtectedRoute>` renders `AppLayout`; `<AdminRoute>` requires `user.role === 'admin'` and blocks impersonation; `<HostingEnabledRoute>` gates hosting pages.

## Database & Migrations

- Two DB access patterns coexist: `api/` uses raw `pg` through `api/lib/database.ts` (the primary path); `lib/db` (`@workspace/db`) uses Drizzle ORM with `drizzle-kit` for schema definitions. New backend routes should use the raw `pg` `query()` helper from `api/lib/database.ts`.
- Migrations are SQL files in `migrations/`, currently through `065`. Never modify an existing migration; add the next zero-padded `NNN_short_description.sql`.
- Apply pending migrations with `node scripts/run-migration.js`. Do not run `db:reset`, `db:reset:confirm`, or `db:fresh` unless explicitly requested; they destroy data.
- Migration runner validates SHA256 checksums, so editing applied migrations will break future runs.
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

- Route registration and middleware order: `api/app.ts`.
- Auth, org context, impersonation: `api/middleware/auth.ts` and organization routes.
- Hosting purchase/onboarding: `api/routes/hosting/store.ts`, `api/services/enhanceOnboardingService.ts`, `api/services/enhanceService.ts`.
- Egress prepaid billing: `api/services/egressCreditService.ts`, `api/services/egressHourlyBillingService.ts`, migrations `025`-`033`.
- Theme behavior: `src/contexts/ThemeContext.tsx` and `api/routes/theme.ts`.
- Frontend route guards/provider order: `src/App.tsx`.
