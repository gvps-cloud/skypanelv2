# AGENTS.md

Compact guidance for coding agents in `skypanelv2`. `CLAUDE.md` delegates here; treat this file as the source of truth when instruction files conflict.

Detailed patterns live in `.github/instructions/` - read these before touching matching areas, then verify against nearby code when something looks stale:
- `.github/instructions/api-routes.instructions.md`
- `.github/instructions/frontend.instructions.md`
- `.github/instructions/migrations.instructions.md`
- `.github/instructions/tests.instructions.md`

## Project Structure

- `src/` - React 18 + Vite + TypeScript frontend. Path alias `@/` -> `./src/` (tsconfig + vite).
- `api/` - Express 4 + TypeScript backend (ESM, root `"type": "module"`).
- `lib/` - Shared workspace packages (pnpm workspace; root uses npm). Versions pinned via `pnpm-workspace.yaml` `catalog:`. Use `npm install` at root and `pnpm install` inside `lib/*`.
  - `lib/api-client-react` - TanStack Query generated hooks.
  - `lib/api-spec` - OpenAPI spec + Orval codegen (`pnpm -C lib/api-spec codegen`).
  - `lib/api-zod` - Zod schemas generated from spec.
  - `lib/db` - Drizzle ORM schema and query helpers. Exports `@workspace/db` (main) and `@workspace/db/schema` (sub-path).
- `migrations/` - Numbered SQL migrations (zero-padded `NNN_*.sql`).
- `git-docs/` - Prose documentation (architecture, features, deployment, etc.).
- `repo-docs/` - Internal reference docs (e.g., ENVIRONMENT_VARIABLES.md, enhance-integration.md).
- **Node**: Pinned to `22.22.0` (`engines` in `package.json`). Use matching version.
- Three product surfaces: Public Marketing (marketing navbar + `src/styles/home.css`), Customer Portal (dashboard, VPS, billing, tickets, hosting), Admin Dashboard (org/user mgmt, blog CMS, platform controls, rate limit monitoring).

## Commands

### Development
- `npm run dev`: Frontend (Vite :5173) + Backend (Express :3001) concurrently.
- `npm run dev-up`: Kills ports 3001, 5173, 8000 first, then dev (clean start).
- `npm run client:dev`: Frontend only (`vite --host`).
- `npm run server:dev`: Backend only (`nodemon` -> `tsx api/server.ts`).
- `npm run start`: Production API server (`prestart` kills ports 3001/5173/8000).
- `npm run start:dev`: Production-like dev (no Vite HMR, uses `vite preview --port 5173 --strictPort` + `tsx api/server.ts`).
- `npm run pm2:start`: Build + start with PM2.
- `npm run pm2:reload`: Graceful PM2 reload.
- `npm run pm2:stop`: Stop PM2 processes.
- `npm run pm2:list`: List PM2 processes.
- `npm run kill-ports`: Kill ports 3001, 5173, 8000.

### Verification & Quality
- `npm run check`: TypeScript type check (`tsc --noEmit`).
- `npm run lint`: ESLint validation (warnings allowed; errors must be fixed).
- `npm run build`: Full production build (`prebuild` hook syncs API docs first -> `tsc -b && vite build`).
- `npm test`: Run all Vitest tests.
- `npm run test:watch`: Vitest watch mode.
- `npm run test:unit`: Unit tests only (`api/` + `src/`).
- `npm run test:coverage`: All tests with coverage.
- `npx vitest run path/to/file.test.ts`: Run specific test file.
- `npx vitest run api/routes/__tests__/`: Run all tests in a directory.
- `npm run test:security`: Security test suite.
- `npm run audit:security`: npm audit (high+ severity).
- `npm run scan:code`: Semgrep security scan.
- `npm run verify:security`: audit + scan + tests.
- `npm run verify:env`: Validate `.env` against required variables (`node scripts/verify-env.js`).
- `npm run verify:prod`: check + lint + test + test:security + test:coverage + scan:code + docs:api:audit + audit:security + verify:env.
- `npm run docs:api:sync`: Sync API docs manifest to `src/lib/apiRouteManifest.ts` (auto-runs via `predev`/`prebuild`/`preclient:dev`).
- `npm run docs:api:audit`: Audit API doc coverage.

### Database
- `npm run db:fresh`: Reset database + run all migrations (**DESTROYS DATA**).
- `npm run db:reset`: Reset database with confirmation prompt.
- `npm run db:reset:confirm`: Reset database without confirmation.
- `npm run seed:admin`: Create default admin user (`node scripts/ensure-admin-user.js`).
- `node scripts/run-migration.js`: Apply pending migrations only.
- `node scripts/seed-branding.js`: Apply `.env` branding to database content.

### Utilities
- `npm run pwa:icons`: Generate PWA icons.
- `npm run preview`: Vite preview server.
- `npm run linode:types:sync`: Sync Linode API types from OpenAPI spec.
- `pnpm -C lib/api-spec codegen`: Regenerate typed clients from OpenAPI spec (requires pnpm).

### Targeted Tests
- **Hosting API**: `npx vitest run api/routes/__tests__/hosting-store.test.ts api/tests/hosting-purchase-saga.test.ts`
- **Security**: `npx vitest run tests/security/`
- **Support/API**: `npx vitest run api/routes/__tests__/support-ticket-vps-org-scope.test.ts`

## TypeScript & Lint Conventions

- **TS Config**: `strict: false`, `noUnusedLocals: false`, `noUnusedParameters: false`, `noFallthroughCasesInSwitch: false`. Do not introduce stricter settings.
- **Linting**: `@typescript-eslint/no-explicit-any` is `off`. Unused vars/params prefixed with `_` are allowed. `no-empty` and `no-control-regex` are `off`.
- **ESM Backend**: All local backend imports MUST have `.js` extensions even when importing `.ts` sources.
- **Zod Version Split**: Root app uses **Zod 4** (`4.1.12`); `lib/*` workspace packages use **Zod 3** (pnpm catalog: `3.25.76`). Use the correct import based on package context.
- **React Version Boundary**: Root app uses React **18.3.1**; pnpm catalog pins React **19.1.0** for `lib/*` packages. Mind this when working across the root/lib boundary.

## Repo-Specific Quirks

- **Tailwind `blue` -> teal**: `tailwind.config.js` maps `blue: colors.teal`. Adding `blue-500` gives teal, not blue.
- **PostCSS warning**: `postcss.config.js` says "DO NOT EDIT THIS FILE" three times. Leave it alone.
- **Config Proxy**: `api/config/index.ts` exports `config` as a `Proxy` that reads `process.env` at property access time, not import time. Routes/services must `import { config }` - never read `process.env` directly.
- **`dotenv` guard**: `api/app.ts` and `api/lib/database.ts` only load `.env` if `process.env.IN_DOCKER` is not set. Docker Compose passes env vars directly.
- **`validateConfig()` at import time**: `api/app.ts` calls `validateConfig()` at module level. In production, it calls `process.exit(1)` if critical config (JWT_SECRET, DATABASE_URL, etc.) is missing or placeholder.
- **API key auth globally**: `authenticateApiKey` middleware runs at the `/api` level (`api/app.ts:344`), setting `req.user` for requests with `X-API-Key` or `Bearer sk_live_*` headers, before route-specific auth. Note: `smartRateLimit` runs earlier and now supports cookie-token extraction, so rate limiting also counts authenticated users and checks IP rules (trusted/blocked) before API key auth is resolved.
- **Frontend route guards** (from `src/App.tsx`):
  - `<PublicRoute>`: Redirects to `/dashboard` if authenticated.
  - `<ProtectedRoute>`: Auth + sidebar (`AppLayout`).
  - `<AdminRoute>`: Requires `user.role === 'admin'`; blocks impersonating admins.
  - `<VpsEnabledRoute>`: Feature-flag gated for VPS; redirects to `/dashboard` if disabled.
  - `<HostingEnabledRoute>`: Feature-flag gated for hosting; redirects to `/dashboard` if disabled.
  - `<HostingMarketingGate>`: Redirects to `/` if hosting disabled.
  - `<RegistrationEnabledRoute>`: Redirects to `/login` if registration disabled.
  - `<MaintenanceGuard>`: Redirects non-admins to `/maintenance` during maintenance mode.
- **Vite proxy SSE**: `vite.config.ts` special-cases `/notifications/stream` for SSE - sets `Accept: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`. Preserve this if modifying proxy config.
- **`pre*` hooks**: `predev`, `prebuild`, `preclient:dev` all auto-run `docs:api:sync`. You don't need to run it manually before these commands.
- **`STARTUP_SIDE_EFFECTS_ENABLED`**: Setting to `false` disables metrics persistence, billing cron, Bunny CDN refresh, notification service listeners, and ticket notification listeners on startup. Useful for test boots and safe local development.

## Environment

See `repo-docs/ENVIRONMENT_VARIABLES.md` for the full reference. Key required vars:
- `DATABASE_URL`, `JWT_SECRET`, `SSH_CRED_SECRET`, `ENCRYPTION_KEY`, `CLIENT_URL`
- Encryption rotation via `*_PREVIOUS` env vars (e.g., `SSH_CRED_SECRET_PREVIOUS`, `PROVIDER_TOKEN_SECRET_PREVIOUS`)
- Enhance hosting: `ENHANCE_API_URL`, `ENHANCE_API_KEY`, `ENHANCE_MASTER_ORG_ID`, `ENHANCE_DEFAULT_SERVER_GROUP_ID`
- `STARTUP_SIDE_EFFECTS_ENABLED=false` for safe test boots
- Run `node scripts/seed-branding.js` after changing branding vars

## Backend Rules

- **Config**: Import `config` from `api/config/index.ts`; never read `process.env` directly in routes/services.
- **Auth**: `api/middleware/auth.ts` handles JWT and impersonation. Admin routes require `user.role === 'admin'`.
- **Route Order**: In `api/app.ts`, public routes (`/api/hosting` status and `/api/blog`) MUST be defined before `notesRoutes` to avoid global auth middleware.
- **Error Handling**: Business errors return `{ error: "message" }`. Use `handleProviderError()` from `api/lib/errorHandling.ts` for provider/Linode errors.
- **Activity Logging**: Use `logActivity()` from `api/services/activityLogger.ts`. Common types: `vps.created`, `vps.deleted`, `vps.power_on`, `vps.power_off`, `ssh.session_started`, `billing.credited`, `support.ticket_created`, `support.ticket_replied`, `blog.post_created`, `blog.post_updated`.
- **Multi-tenancy**: Resource queries MUST be scoped by `organization_id`. Never fetch by resource ID alone.
- **Rate Limiting**: `smartRateLimit` in `api/middleware/rateLimiting.ts` now classifies users by cookie/Bearer token, applies per-user overrides, per-IP rules (trusted/blocked), and separate dashboard vs API buckets. Dashboard endpoints get a higher base limit.
- **Bottleneck**: `api/app.ts` is the central point for middleware and route registration. It also serves `dist/` if present (regardless of `NODE_ENV`).

## Frontend Rules

- **API Calls**: Use `apiClient` from `src/lib/api.ts`. It handles cookies/CSRF/org headers; do not manually add `Authorization` headers.
- **Path Alias**: `@/` resolves to `./src/` in both tsconfig and vite. Use `@/lib/api`, `@/contexts/ThemeContext`, etc.
- **React Router v7**: The app uses `react-router-dom` v7.13.2. v7 has API differences from v6 - check existing route patterns before writing new routes.
- **State**: Export TanStack Query key factories from hook files (e.g., `fooKeys.detail(id)`) and invalidate using these keys.
- **Styling**: Use `cn()` from `@/lib/utils` for conditional Tailwind classes.
- **Logo**: Source of truth is `public/favicon.svg`; the `Logo` component renders it as an image.
- **Build**: Vite build includes `removeMockData` plugin that strips example emails/passwords/tokens from production bundles. Do not add sensitive defaults in `src/` files.

## CLI (TUI Admin Console)

- **Location**: `cli/` is a separate **Bun** package. Do not use npm/pnpm inside `cli/`. Install with `cd cli && bun install`.
- **Entry point**: `cli/skypanel.tsx` validates `SKYPANEL_API_URL` and `SKYPANEL_API_TOKEN`, tests connectivity/admin role via `/api/auth/me`, then boots the OpenTUI renderer.
- **Launch**: `npm run skypanel` (from root, delegates to `cd cli && bun run skypanel.tsx`).
- **API client**: `cli/lib/client.ts` — HTTP client with JWT/API-key auth (`sk_live_*` uses `X-API-Key`), normalized base URLs (accepts with or without trailing `/api`), and response wrapper parsing (`{ users }`, `{ stats }`, `{ posts, pagination }`, etc.).
- **Screens**: Live API consumers under `cli/screens/`. All make real admin API calls to `/api/admin/*` endpoints.
- **Shared components**: `cli/components/` — DataTable, DetailPanel, FormDialog, ConfirmDialog, Toast, Sidebar, StatusBar.
- **Theme**: Centralized in `cli/theme.ts` — palette + `getStatusColor()`. All components import from it; do not hardcode colors.
- **Legacy removed**: The old scripting CLI (`cli/skypanel.mjs`, `cli/commands/*.mjs`, `cli/lib/database.mjs`, `cli/lib/redis.mjs`, `cli/lib/output.mjs`) was fully removed. The CLI is **TUI-only**.
- **TypeScript**: `cli/tsconfig.json` is independent. Use `npx tsc --noEmit --project cli/tsconfig.json` to typecheck.

## Database & Migrations

- **Dual System**: Primary path = raw `pg` via `api/lib/database.ts` (used by backend routes). Drizzle ORM via `lib/db` is for schema/types only - new routes should use the `query()` helper.
- **Append Only**: Never modify an existing migration; add the next numbered file (zero-padded `NNN_*`). Check the highest existing number in `migrations/` before creating a new one.
- **Migration Naming/Conventions**: See `.github/instructions/migrations.instructions.md`.

## Testing Notes

- **Config**: `globals: true`, `jsdom`, `fileParallelism: false` (prevents DB/rate-limiter state interference), `testTimeout: 15000`. `VITE_API_URL` is preset to `http://localhost:3001/api` - no need to set it in test files.
- **Vitest includes**: `src/**/*.{test,spec}.*`, `tests/security/**/*`, `tests/integration/**/*`, `api/**/*.test.ts`.
- **E2E**: Playwright tests in `tests/e2e/**` are excluded from Vitest and run separately (`npx playwright test`).
- **Test patterns, mocking, fixtures**: See `.github/instructions/tests.instructions.md`.

## Architecture Hotspots

- **Route/Middleware**: `api/app.ts` - the central bottleneck for all middleware and route registration.
- **Billing**:
  - VPS: Hourly cron in `api/services/`.
  - Hosting: Monthly recurring in `hostingBillingService.ts`.
  - Egress: Prepaid credits via `egressCreditService.ts` and hourly enforcement via `egressHourlyBillingService.ts`.
- **Key areas**:
  - Blog (`api/routes/blog.ts` + `api/routes/admin/blog.ts`)
  - Tickets (`api/routes/support.ts` + `api/routes/admin/tickets.ts`)
  - Maintenance (`api/routes/admin/platform.ts` + `MaintenanceGuard` in `src/App.tsx`)
  - Theme (dual-path frontend `ThemeContext` + API `api/routes/theme.ts`)
  - Notifications (PG LISTEN/NOTIFY -> `NotificationService` -> SSE endpoint)
  - Rate limiting (`api/middleware/rateLimiting.ts` + admin override/IP-rule services)
