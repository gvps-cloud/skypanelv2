---
description:
alwaysApply: true
---

# AGENTS.md

Compact guidance for OpenCode sessions in `skypanelv2`. `CLAUDE.md` delegates here; treat this file as the source of truth when instruction files conflict.

## Project

- Full-stack VPS/hosting billing panel: React 18 + Vite frontend in `src/`, Express 4 + TypeScript backend in `api/`, PostgreSQL via raw `pg` queries and SQL migrations.
- Runtime/package manager from executable config: Node `22.22.0` (`.nvmrc`, `package.json#engines`), npm scripts are primary even though `pnpm-workspace.yaml` and `lib/*` package manifests exist.
- Backend entrypoints: `api/app.ts` wires middleware/routes; `api/server.ts` starts the API and background schedulers. Frontend entrypoints: `src/main.tsx`, `src/App.tsx`.
- Detailed prose docs live in `git-docs/`; prefer root configs/scripts when docs disagree.

## Commands

- Install: `npm install`.
- Dev all: `npm run dev` (Vite `:5173` + Express `:3001`). Clean dev start: `npm run dev-up` (kills `3001`, `5173`, `8000` first).
- Frontend only: `npm run client:dev`. Backend only: `npm run server:dev` (`nodemon` -> `tsx api/server.ts`).
- Typecheck: `npm run check` (`tsc --noEmit`). Lint: `npm run lint` (warnings are allowed; 0 errors expected).
- Build: `npm run build` (`tsc -b && vite build`). `predev`, `preclient:dev`, and `prebuild` run `npm run docs:api:sync` first.
- Tests: `npm test` or `npx vitest run`. Focus one file/path with `npx vitest run path/to/file.test.ts`.
- Security suite: `npm run test:security` or `npx vitest run tests/security/`. Full security verification: `npm run verify:security`.
- Playwright e2e config auto-starts `npm run dev-up` outside CI; base URL defaults to `http://localhost:5173`.
- API docs: `npm run docs:api:sync` updates `src/lib/apiRouteManifest.ts`; `npm run docs:api:audit` checks coverage.

## Environment

- Copy `.env.example` to `.env`; backend loads `.env` in `api/app.ts` unless `IN_DOCKER` is set.
- Required core vars include `DATABASE_URL`, `JWT_SECRET`, `SSH_CRED_SECRET`, and `ENCRYPTION_KEY`. Generate secrets with `node scripts/generate-ssh-secret.js` and `node scripts/generate-encryption-key.js`.
- Linode/VPS uses `LINODE_API_TOKEN`; PayPal uses `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE`; email falls back by `EMAIL_PROVIDER_PRIORITY` (`resend,smtp`).
- Enhance hosting config is optional but exact: `ENHANCE_API_URL` is panel origin only, no `/api`; `ENHANCE_API_KEY` is raw token, no `Bearer`; `ENHANCE_MASTER_ORG_ID` and `ENHANCE_DEFAULT_SERVER_GROUP_ID` are used by hosting flows.
- `CLIENT_URL` drives PayPal return/cancel URLs and must match the frontend origin.

## Backend Rules

- Backend is ESM (`"type": "module"`): all local backend imports need `.js` extensions even when importing `.ts` sources.
- Route/service files should import `config` from `api/config/index.ts`; do not read `process.env` directly except in config/bootstrap code.
- Apply auth/organization middleware at router level (`router.use(...)`) where possible. `/api` gets CSRF, API-key auth, smart rate limits, and rate-limit headers in `api/app.ts`.
- Business errors usually return `{ error: "message" }`; provider/Linode errors should use `handleProviderError()` from `api/lib/errorHandling.ts`.
- Log meaningful successful mutations with `logActivity()` from `api/services/activityLogger.ts`.
- Scope resource queries by `organization_id`. Many tables are multi-tenant; do not fetch by resource id alone.

## Frontend Rules

- Use `apiClient` from `src/lib/api.ts` for new API calls. It sends cookies/CSRF/org headers and handles 401 logout; do not add `Authorization` headers with it.
- Older raw `fetch` paths must include `API_BASE_URL`, bearer token from `useAuth()`, and `X-CSRF-Token` from the `csrf_token` cookie.
- Export TanStack Query key factories from hook files, e.g. `fooKeys.detail(id)`, and invalidate by those keys after mutations.
- Use `cn()` from `@/lib/utils` for conditional/composed Tailwind classes.
- Public marketing pages share `@/styles/home.css`; `MarketingNavbar` is fixed and content needs top padding (`pt-[72px]`).
- Logo source of truth is `public/favicon.svg`; `Logo` renders it as an image.

## Database & Migrations

- This is not Prisma. `@prisma/client` may exist in dependencies, but app data access is raw `pg` through `api/lib/database.ts`.
- Migrations are SQL files in `migrations/`, currently through `062`. Never modify an existing migration; add the next zero-padded `NNN_short_description.sql`.
- Apply pending migrations with `node scripts/run-migration.js`. Do not run `db:reset`, `db:reset:confirm`, or `db:fresh` unless explicitly requested; they destroy data.
- Migration runner validates SHA256 checksums, so editing applied migrations will break future runs.

## Testing Notes

- Vitest config uses `globals: true`, `jsdom`, `@` -> `src`, `testTimeout: 15000`, and `fileParallelism: false` to avoid DB/rate-limiter state interference.
- Test include globs: `src/**/*.{test,spec}.*`, `tests/security/**/*`, `tests/integration/**/*`, and `api/**/*.test.ts`; `tests/e2e/**` is excluded from Vitest.
- Some backend route tests use the real `DATABASE_URL`; inspect setup/cleanup before adding cases and avoid destructive DB scripts.
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
