# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Primary repository guidance lives in `AGENTS.md`. Use `AGENTS.md` as the source of truth for development commands, architecture details, and operational guidance. If this file and `AGENTS.md` disagree, follow `AGENTS.md`.

## High-Level Architecture

Three distinct product surfaces share the same codebase:

- **Public marketing pages** — static-ish pages with fixed `MarketingNavbar` (offset by `--announcement-banner-height`), shared `src/styles/home.css`
- **Customer portal** — dashboard, VPS management, billing, SSH console (`xterm.js`), support tickets
- **Admin dashboard** — org management, user impersonation, platform controls

The frontend is React 18 + Vite at root level. The backend is Express 4 + TypeScript in `api/`. Three workspace packages under `lib/` are managed by pnpm but the root app itself uses npm + `package-lock.json`.

Two database access patterns coexist: `api/lib/database.ts` (raw `pg`) is the primary path for backend routes; `lib/db` (Drizzle ORM) is a separate schema package. Migrations are numbered SQL files in `migrations/` — never modify existing ones, only append new numbered files.

The backend is ESM (`"type": "module"`), so all local imports need `.js` extensions even when the source is `.ts`.

## Key Commands

```bash
npm run dev          # Vite :5173 + Express :3001 concurrently
npm run dev-up       # Kill ports first, then dev (clean start)
npm run client:dev   # Frontend only
npm run server:dev   # Backend only (nodemon + tsx)

npm run check        # TypeScript (tsc --noEmit)
npm run lint         # ESLint (warnings allowed, fix errors)
npm run build        # tsc -b && vite build

npm test             # All Vitest tests
npx vitest run path/to/file.test.ts  # Single file

npm run test:security   # Security test suite
npm run verify:security # audit + scan + tests

npm run db:fresh    # Reset + run all migrations
npm run seed:admin  # Create default admin user

npm run docs:api:sync  # Sync API docs manifest → src/lib/apiRouteManifest.ts
```

## Architecture Hotspots

- **Route registration and middleware order** — `api/app.ts` is the central bottleneck. Hosting sub-routes (web, node, email, dns, wordpress, joomla, mysql, ftp, ssl, apps, backups, cron, ssh) are individually imported and mounted there.
- **Auth context** — `api/middleware/auth.ts` handles JWT verification, org context, and impersonation. Admin routes require `user.role === 'admin'`.
- **Hosting purchase flow** — `api/routes/hosting/store.ts` → `enhanceOnboardingService.ts` → `enhanceService.ts`. Customer websites use the customer Enhance org id, not the master org.
- **Billing** — hourly VPS billing via cron in `api/services/`, monthly hosting billing in `hostingBillingService.ts`, egress prepaid billing in `egressHourlyBillingService.ts`.
- **Multi-tenant scope** — resource queries must be scoped by `organization_id`. Many tables are multi-tenant; never fetch by resource id alone.
- **Theme** — dual-path: frontend `src/contexts/ThemeContext.tsx` and API route `api/routes/theme.ts`.

## TypeScript & Linting

`tsconfig.json` has `strict: false`, `noUnusedLocals: false`, `noUnusedParameters: false`. Do not introduce stricter settings.

ESLint: `@typescript-eslint/no-explicit-any` is `off`. Unused vars/params prefixed with `_` are allowed.

Root uses **Zod 4** (`"zod": "4.1.12"`); the pnpm catalog (for `lib/*` workspace packages) uses Zod 3. Import accordingly.

## Security-Sensitive Patterns

- Never add sensitive-looking defaults (example emails, passwords, API tokens) in `src/` files expecting them to ship — the Vite build strips these from production bundles via `removeMockData` plugin.
- SSH credentials and provider API tokens are encrypted via `SSH_CRED_SECRET` and `PROVIDER_TOKEN_SECRET` respectively, with rotation support via `*_PREVIOUS` env vars.
- Route order in `api/app.ts` matters: public `/api/hosting` status routes must stay before `notesRoutes` because `notesRoutes` applies global auth at `/api`.