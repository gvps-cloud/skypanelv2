# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

This project hosts **SkyPanel v2**, a cloud service reseller billing panel ported from Vercel.

- Frontend: `artifacts/skypanel/` (React + Vite, react-router-dom), served at `/`.
- Backend: `artifacts/api-server/` (Express 4, ported from `.migration-backup/api/`), served at `/api`. Source lives under `src/api/`. Database access via `pg` against the Replit Postgres `DATABASE_URL`. Migrations are SQL files under `artifacts/api-server/migrations/` and were applied via `node run-migrations.mjs` (59 files, tracked in `schema_migrations`).
- Dev defaults set in the api-server `dev` script: `NODE_ENV=development`, `STARTUP_SIDE_EFFECTS_ENABLED=false` (skips billing cron, BunnyCDN refresh, SSH bridge, notification schedulers), `JWT_SECRET=...` (dev placeholder; override via env for real use).
- Optional integrations not configured by default: Linode (`LINODE_API_TOKEN`), PayPal (`PAYPAL_CLIENT_*`), Resend/SMTP, BetterStack, BunnyCDN, Redis. Auth, theme, announcements, pricing list, and registration/login flows work without them; VPS provisioning, payments, and email delivery require their respective secrets.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
