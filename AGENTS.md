# AGENTS.md

Compact guidance for coding agents in `skypanelv2`. `CLAUDE.md` delegates here; treat this file as the source of truth when instruction files conflict.

## Project Structure

- `src/` — React 18 + Vite + TypeScript frontend.
  - `src/pages/` — Page components.
  - `src/components/` — UI components.
  - `src/components/ui/` — shadcn/ui primitives.
- `api/` — Express 4 + TypeScript backend.
  - `api/routes/` — REST endpoints.
  - `api/services/` — Business logic layer.
  - `api/middleware/` — Request pipeline (auth, rate limiting, etc.).
- `lib/` — Shared workspace packages (managed by pnpm).
  - `lib/api-client-react` — TanStack Query hooks.
  - `lib/api-spec` — OpenAPI spec + Orval codegen (`pnpm codegen` to update).
  - `lib/api-zod` — Zod schemas generated from spec.
  - `lib/db` — Drizzle ORM schema and query helpers.
- `migrations/` — Numbered SQL migrations (zero-padded `NNN_*.sql`).
- `git-docs/` — Detailed prose documentation.
- **Package Manager Split**: Root app uses `npm` (`package-lock.json`); `lib/*` workspace packages use `pnpm` (`pnpm-lock.yaml`). Do not infer root versions from the pnpm catalog.
- **Product Surfaces**:
  - **Public Marketing**: Home, pricing, FAQ, legal. Uses `MarketingNavbar` and `src/styles/home.css`.
  - **Customer Portal**: Dashboard, VPS management, billing, support tickets, hosting.
  - **Admin Dashboard**: Org/User management, platform controls, blog CMS.

## Commands

### Development
- `npm run dev`: Start frontend (Vite :5173) and backend (Express :3001) concurrently.
- `npm run dev-up`: Clean start (kills ports 3001, 5173, 8000 first).
- `npm run client:dev`: Frontend only.
- `npm run server:dev`: Backend only (`nodemon` -> `tsx api/server.ts`).
- `npm run start`: Start production API server.
- `npm run pm2:start`: Build and start with PM2.

### Verification & Quality
- `npm run check`: TypeScript type check (`tsc --noEmit`).
- `npm run lint`: ESLint validation (warnings allowed; errors must be fixed).
- `npm run build`: Full production build (`tsc -b && vite build`).
- `npm test`: Run all Vitest tests.
- `npx vitest run path/to/file.test.ts`: Run specific test file.
- `npm run test:security`: Run security test suite.
- `npm run verify:security`: Full security verification (audit + scan + tests).
- `npm run verify:prod`: Full production verification (check, lint, test, security, coverage, scan, env).
- `npm run verify:env`: Verify all required environment variables.

### Database & Setup
- `npm run db:fresh`: Reset database and run all migrations.
- `npm run seed:admin`: Create default admin user.
- `npm run docs:api:sync`: Sync API docs manifest to `src/lib/apiRouteManifest.ts`.
- `node scripts/seed-branding.js`: Apply `.env` branding to database content.

### Targeted Tests
- **Hosting API**: `npx vitest run api/routes/__tests__/hosting-store.test.ts api/tests/hosting-purchase-saga.test.ts`
- **Security**: `npx vitest run tests/security/`
- **Support/API**: `npx vitest run api/routes/__tests__/support-ticket-vps-org-scope.test.ts`

## TypeScript & Lint Conventions

- **TS Config**: `strict: false`, `noUnusedLocals: false`, `noUnusedParameters: false`. Do not introduce stricter settings.
- **Linting**: `@typescript-eslint/no-explicit-any` is `off`. Unused vars/params prefixed with `_` are allowed.
- **ESM Backend**: Backend is ESM (`"type": "module"`); all local backend imports MUST have `.js` extensions even when importing `.ts` sources.
- **Zod Version Split**: Root app uses **Zod 4** (`4.1.12`); `lib/*` workspace packages use **Zod 3**. Use the correct import based on package context.

## Commit Conventions

- **Prefixes**: Use `feat:`, `fix:`, `refactor:`, `style:`, `enhance:`.
- **Detail**: Include component name and specific change. Avoid generic messages like "update code" or "fix bug".

## Environment

- **Required Core**: `DATABASE_URL`, `JWT_SECRET`, `SSH_CRED_SECRET`.
- **Encryption**:
  - `SSH_CRED_SECRET`: Encrypts SSH credentials.
  - `PROVIDER_TOKEN_SECRET`: Encrypts provider API tokens (falls back to `SSH_CRED_SECRET` if unset).
  - Rotation supported via `*_PREVIOUS` environment variables.
- **Enhance Hosting**:
  - `ENHANCE_API_URL`: Panel origin only (no `/api` suffix).
  - `ENHANCE_API_KEY`: Raw token only (do NOT include "Bearer ").
  - `ENHANCE_MASTER_ORG_ID` and `ENHANCE_DEFAULT_SERVER_GROUP_ID` required for hosting flows.
- **PayPal**: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE`.
- **Email**: `EMAIL_PROVIDER_PRIORITY` (`resend,smtp`).
- **Site**: `CLIENT_URL` drives PayPal return/cancel redirects.
- **Toggles**: `STARTUP_SIDE_EFFECTS_ENABLED=false` disables metrics persistence and billing cron on startup (useful for safe test boots).
- **Branding**: `VITE_COMPANY_NAME`, `COMPANY_NAME`, `COMPANY_BRAND_NAME`. Run `node scripts/seed-branding.js` after changing.

## Backend Rules

- **Configuration**: Import `config` from `api/config/index.ts`; do not read `process.env` directly in routes/services.
- **Auth**: `api/middleware/auth.ts` handles JWT and impersonation. Admin routes require `user.role === 'admin'`.
- **Route Order**: In `api/app.ts`, public routes (`/api/hosting` status and `/api/blog`) MUST be defined before `notesRoutes` to avoid global auth middleware.
- **Error Handling**: Business errors return `{ error: "message" }`. Use `handleProviderError()` from `api/lib/errorHandling.ts` for provider/Linode errors.
- **Activity Logging**: Use `logActivity()` from `api/services/activityLogger.ts`. Use existing types: `vps.created`, `vps.deleted`, `vps.rebuilt`, `vps.power_on`, `vps.power_off`, `ssh.session_started`, `billing.credited`, `support.ticket_created`, `support.ticket_replied`, `blog.post_created`, `blog.post_updated`.
- **Multi-tenancy**: Resource queries MUST be scoped by `organization_id`. Never fetch by resource ID alone.
- **Bottleneck**: `api/app.ts` is the central point for middleware and route registration. It also serves `dist/` if present.

## Frontend Rules

- **API Calls**: Use `apiClient` from `src/lib/api.ts`. It handles cookies/CSRF/org headers; do not manually add `Authorization` headers.
- **State**: Export TanStack Query key factories from hook files (e.g., `fooKeys.detail(id)`) and invalidate using these keys.
- **Styling**: Use `cn()` from `@/lib/utils` for conditional Tailwind classes.
- **Layout**: `MarketingNavbar` is fixed and offset by `--announcement-banner-height` from `AnnouncementBanner`.
- **Logo**: Source of truth is `public/favicon.svg`; the `Logo` component renders it as an image.
- **Guards**: Route guards in `src/App.tsx` (`<ProtectedRoute>`, `<AdminRoute>`, etc.) manage access.
- **Build**: Vite build includes `removeMockData` plugin that strips example emails/passwords/tokens from production bundles. Do not add sensitive defaults in `src/` files.

## Database & Migrations

- **Dual System**: 
  - Primary Path: raw `pg` via `api/lib/database.ts` (used by backend routes).
  - Schema/Types: Drizzle ORM via `lib/db`. New backend routes should still use the raw `pg` `query()` helper.
- **Migrations**: Zero-padded SQL files in `migrations/`.
  - **Append Only**: Never modify an existing migration; add the next numbered file.
  - **Checksums**: Runner validates SHA256 checksums; logs warnings for changed files but continues.
- **Schema Conventions**: UUID PKs (`gen_random_uuid()`), `TIMESTAMPTZ` timestamps, `deleted_at` for soft deletes, `JSONB DEFAULT '{}'`, and explicit `ON DELETE CASCADE` or `ON DELETE SET NULL`.

## Testing Notes

- **Configuration**: `globals: true`, `jsdom`, `fileParallelism: false` (prevents DB/rate-limiter state interference).
- **Globs**:
  - `src/**/*.{test,spec}.*`
  - `tests/security/**/*`
  - `tests/integration/**/*`
  - `api/**/*.test.ts`
- **E2E**: Playwright tests in `tests/e2e/**` are excluded from Vitest and run separately.
- **DB State**: Some route tests use the real `DATABASE_URL`. Use transactions with rollback or cleanup in `afterEach`/`afterAll`. Avoid `db:fresh` in test suites.

## Enhance Hosting Gotchas

- **API Ref**: Official reference is `repo-docs/enhance-oas3-api.yaml`.
- **Orgs**: Customer websites MUST use the customer Enhance org id, not the master org. Use `getHostingSubscriptionForOrganization()` to retrieve `enhance_customer_org_id`.
- **Checkout**: Initial hosting purchase requires a real domain; do not auto-generate staging domains.
- **Tokens**: Use `normalizeProviderToken()` before making provider/client calls.

## Architecture Hotspots

- **Route/Middleware**: `api/app.ts`.
- **Billing**:
  - VPS: Hourly cron in `api/services/`.
  - Hosting: Monthly recurring in `hostingBillingService.ts`.
  - Egress: Prepaid credits via `egressCreditService.ts` and `egressHourlyBillingService.ts`.
- **Feature Areas**:
  - Blog: `api/routes/blog.ts` (public) and `api/routes/admin/blog.ts` (CMS).
  - Tickets: `api/routes/support.ts` (customer) and `api/routes/admin/tickets.ts` (admin).
  - Maintenance: `api/routes/admin/platform.ts` toggles mode; `MaintenanceGuard` in `src/App.tsx` redirects non-admins.
  - Theme: Dual-path (frontend `src/contexts/ThemeContext.tsx` and API `api/routes/theme.ts`).
  - Notifications: PG LISTEN/NOTIFY $\rightarrow$ `NotificationService` $\rightarrow$ SSE endpoint.

## mmx-cli Reference

CLI for MiniMax API. Use `mmx <resource> <command> [flags]`.

### Global Flags
- `--api-key <key>`: API key override.
- `--region <region>`: `global` (default) or `cn`.
- `--base-url <url>`: API base URL override.
- `--output <format>`: `text` or `json`.
- `--quiet`: Suppress non-essential output.
- `--verbose`: Print HTTP request/response details.
- `--timeout <seconds>`: Request timeout (default: 300).
- `--no-color`: Disable ANSI colors.
- `--dry-run`: Show intended action without executing.
- `--non-interactive`: Disable interactive prompts (CI/Agent mode).
- `--version`: Print version.
- `--help`: Show help.

### Commands

#### Auth
- `mmx auth login`: Authenticate via OAuth or API key.
- `mmx auth status`: Show auth state and quota snapshot.
- `mmx auth refresh`: Refresh OAuth token.
- `mmx auth logout`: Revoke tokens and clear credentials.

#### Text Generation
- `mmx text chat --message <text> [flags]`
  - `--model <model>`: Model ID (default: `MiniMax-M2.7`).
  - `--message <text>`: Message text (repeatable, use `role:text` to set role).
  - `--messages-file <path>`: JSON messages array (use `-` for stdin).
  - `--system <text>`: System prompt.
  - `--max-tokens <n>`: Max tokens (default: 4096).
  - `--temperature <n>`: Sampling temperature (0.0, 1.0].
  - `--top-p <n>`: Nucleus sampling threshold.
  - `--stream`: Stream response tokens.
  - `--tool <json-or-path>`: Tool definition (repeatable).

#### Image Generation
- `mmx image generate --prompt <text> [flags]`
  - `--aspect-ratio <ratio>`: e.g. `16:9`, `1:1`.
  - `--n <count>`: Number of images (default: 1).
  - `--seed <n>`: Random seed for reproduction.
  - `--width <px>`: Custom width [512, 2048], multiple of 8.
  - `--height <px>`: Custom height [512, 2048], multiple of 8.
  - `--prompt-optimizer`: Auto-optimize prompt.
  - `--aigc-watermark`: Embed AI watermark.
  - `--subject-ref <params>`: Consistency ref (`type=character,image=path-or-url`).
  - `--out <path>`: Save to exact path.
  - `--response-format <format>`: `url` (default) or `base64`.
  - `--out-dir <dir>`: Download images to directory.
  - `--out-prefix <prefix>`: Filename prefix.

#### Video Generation
- `mmx video generate --prompt <text> [flags]`
  - `--model <model>`: `MiniMax-Hailuo-2.3` (T2V/I2V), `Hailuo-02` (SEF), `S2V-01` (S2V).
  - `--first-frame <path>`: First frame image.
  - `--last-frame <path>`: Last frame image (enables SEF).
  - `--subject-image <path>`: Subject reference (switches to S2V-01).
  - `--callback-url <url>`: Webhook for completion.
  - `--download <path>`: Save video on completion.
  - `--no-wait` / `--async`: Return task ID immediately.
  - `--poll-interval <seconds>`: Polling interval (default: 5).
- `mmx video task get`: Query video task status.

#### Speech Synthesis
- `mmx speech synthesize --text <text> [flags]`
  - `--model <model>`: `speech-2.8-hd` (default), `2.6`, `02`.
  - `--text-file <path>`: Read text from file (use `-` for stdin).
  - `--voice <id>`: Voice ID (default: `English_expressive_narrator`).
  - `--speed <n>`, `--volume <n>`, `--pitch <n>`: Audio adjustments.
  - `--format <fmt>`: Audio format (default: `mp3`).
  - `--sample-rate <hz>`, `--bitrate <bps>`, `--channels <n>`: Quality settings.
  - `--language <code>`: Language boost.
  - `--subtitles`: Include timing data.
  - `--pronunciation <from/to>`: Custom pronunciation (repeatable).
  - `--out <path>`: Save audio to file.
  - `--stream`: Stream raw audio to stdout.
- `mmx speech voices`: List available system voices.

#### Music Generation
- `mmx music generate --prompt <text> [flags]`
  - `--lyrics <text>`: Lyrics with structure tags (`[Intro]`, `[Chorus]`, etc.).
  - `--lyrics-file <path>`: Read lyrics from file.
  - `--lyrics-optimizer`: Auto-generate lyrics from prompt.
  - `--instrumental`: No vocals.
  - `--vocals <text>`, `--genre <text>`, `--mood <text>`, `--instruments <text>`: Style settings.
  - `--tempo <text>`, `--bpm <number>`, `--key <text>`: Musical settings.
  - `--avoid <text>`, `--use-case <text>`, `--structure <text>`, `--references <text>`, `--extra <text>`: Fine-tuning.
  - `--model <model>`: `music-2.6` (rec), `music-2.6-free` (default), `music-2.5+`, `music-2.5`.
  - `--output-format <fmt>`: `hex` (default) or `url`.
  - `--aigc-watermark`: Embed AI watermark.
  - `--format <fmt>`, `--sample-rate <hz>`, `--bitrate <bps>`: Audio settings.
  - `--stream`: Stream raw audio.
  - `--out <path>`: Save to file.
- `mmx music cover`: Generate a cover based on reference audio.

#### Search & Vision
- `mmx search query --q <query>`: Search web via MiniMax.
- `mmx vision describe`: Describe an image using MiniMax VLM.

#### System
- `mmx quota show`: Display token plan usage and remaining quotas.
- `mmx config show`: Display current configuration.
- `mmx config set`: Set a config value.
- `mmx config export-schema`: Export CLI commands as JSON tool schemas.
