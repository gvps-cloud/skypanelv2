# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Important**: Always read `[AGENTS.md](./AGENTS.md)` alongside this file. AGENTS.md documents the current state of the repository and provides practical guidance for coding agents. This file (CLAUDE.md) provides Claude Code-specific development instructions and deeper architectural context.

## Development Commands

### Core Development

- `npm run dev` - Start concurrent frontend (Vite) and backend (nodemon) development servers
- `npm run dev-up` - Kill ports 3001/5173/8000 and start development servers (preferred for clean startup)
- `npm run client:dev` - Frontend only (Vite dev server on port 5173)
- `npm run server:dev` - Backend only (Express API on port 3001)
- `npm run build` - TypeScript check + Vite build for production
- `npm run lint` - ESLint validation
- `npm run check` - TypeScript type checking without emitting files
- `npm run preview` - Preview production build locally

### API Documentation

- `npm run docs:api:sync` - Sync API documentation (auto-runs via pre* hooks on `dev`, `client:dev`, and `build`)
- `npm run docs:api:audit` - Audit and validate API documentation coverage

### Security

- `npm run audit:security` - Run npm audit with high severity filter
- `npm run scan:code` - Run semgrep static analysis
- `npm run test:security` - Run security tests with Vitest
- `npm run verify:security` - Run all security checks (audit + scan + test)

### Testing

> **Note**: There is no `npm test` script. Run `npx vitest run tests/security/` for the security test suite, or `npx vitest run` for all tests. The repo includes Vitest, React Testing Library, Supertest, and Playwright.

### Database Management

- `npm run db:fresh` - Reset database and run all migrations (WARNING: destroys all data - use only in development)
- `npm run db:reset` - Interactive database reset with confirmation
- `npm run db:reset:confirm` - Reset database without prompt
- `npm run seed:admin` - Create default admin user
- `node scripts/seed-branding.js` - Update database branding (docs, FAQ, contact, rDNS) to match .env

### Production Deployment

- `npm run start` - Launch production Express server + Vite preview
- `npm run pm2:start` - Build and start with PM2 process manager
- `npm run pm2:reload` - Reload PM2 processes gracefully
- `npm run pm2:stop` - Stop PM2 processes
- `npm run pm2:list` - List PM2 processes

### Utilities

- `npm run kill-ports` - Kill processes on ports 3001, 5173, and 8000
- `npm run pwa:icons` - Generate PWA icons

## Architecture Overview

SkyPanelV2 is a full-stack cloud service reseller billing panel with multi-tenant organization support. It provides three distinct product surfaces:

1. **Public marketing pages** — Home, pricing, FAQ, about, contact, status, legal, docs, regions
2. **Authenticated customer portal** — Dashboard, VPS management, billing, support, SSH console, organizations, egress credits, API docs
3. **Admin dashboard** — User management, billing ops, platform settings, provider config, impersonation, documentation, announcements, networking

### Frontend (`src/`)

- **React 18** SPA with TypeScript and Vite
- **shadcn/ui** component library with Tailwind CSS (Radix UI primitives), configured via `components.json`
- **TanStack Query** for server state management with optimistic updates (30s staleTime, 1 retry, refetchOnWindowFocus)
- **Zustand** for client state management (selected stores for UI state)
- **React Router v7** for routing with protected route guards:
  - `ProtectedRoute`: Auth required → AppLayout with sidebar
  - `StandaloneProtectedRoute`: Auth required → AppLayout without sidebar (SSH console)
  - `AdminRoute`: Auth + `user.role === 'admin'` + not impersonating → AppLayout (admin dashboard)
  - `PublicRoute`: Redirects to `/dashboard` if already logged in
- **React Hook Form + Zod** for form validation with schema-based validation
- **Framer Motion** for animations with accessibility considerations
- **Recharts** for data visualization with responsive containers
- **xterm.js** for browser-based SSH terminal emulation with fit/addon packages
- **cmdk** for command palette (Ctrl/Cmd + K) with persistent state
- **TipTap** for rich text editing with code highlighting (lowlight)
- **qrcode** for 2FA QR code generation using otplib

### Backend (`api/`)

- **Express 4** REST API with TypeScript ESM modules
- **PostgreSQL** database with UUID primary keys, JSONB columns, triggers, and `LISTEN/NOTIFY`
- **JWT authentication** with role-based access (admin/user) and HttpOnly cookie storage
- **Rate limiting** with tiered configuration (anonymous/authenticated/admin) and per-user overrides stored in database
- **CSRF protection** on `/api` routes
- **Comprehensive middleware** stack:
  - `security.ts`: Helmet, CSP with nonce, CORS, referrer policy, XSS protection
  - `auth.ts`: JWT verification, token blacklist, organization validation, impersonation context
  - `permissions.ts`: Role-based and organization membership checking (single/any/all permission variants)
  - `rateLimiting.ts`: Tiered limits with X-RateLimit headers, metrics, Redis support
- **WebSocket server** for SSH bridge (ws + ssh2) providing browser-based terminal access
- **Background schedulers** running on 60-minute intervals from `server.ts`
- **Notification service** using PostgreSQL `LISTEN/NOTIFY` → EventEmitter → SSE for real-time updates
- **Provider abstraction layer** (`IProviderService`) enabling multiple cloud providers
- **Row-level security** on `user_api_keys` table for API key protection
- **API key authentication** middleware that sets `req.user` when API key is provided

### Key Features

- **Multi-tenant organizations** with role-based access control and custom roles stored in JSONB permissions
- **Linode VPS provisioning** via `IProviderService` abstraction layer with region filtering
- **Automated hourly billing** with wallet-based prepaid system and insufficient balance handling
- **Egress (network transfer) billing** with prepaid credit packs, hourly enforcement, and auto-suspend when credits reach zero
- **Email service** with provider priority/fallback (Resend → SMTP) and template management
- **Activity logging and feed** system for audit trails with real-time notifications via PostgreSQL LISTEN/NOTIFY
- **2FA (Two-Factor Authentication)** support via TOTP with QR code generation
- **Admin impersonation** for customer support with visual banner and audit logging
- **Command palette** navigation with persistent state and frequent updates
- **API documentation auto-sync** on build with validation
- **Rich text documentation** system with categories and articles
- **Platform announcements** with public banner display

## TypeScript Configuration

- **Path alias**: `@/*` → `./src/*` (configured in both `tsconfig.json` and `vite.config.ts`)
- **Strict mode**: Disabled (`"strict": false`)
- **Module system**: ESNext with ESM (backend requires `.js` extensions on local imports)
- **Includes**: Both `src/` and `api/` directories
- **No unused vars as error**: `noUnusedLocals` and `noUnusedParameters` are `false`
- **Lint exceptions**: `@typescript-eslint/no-explicit-any` is off; unused vars emit warnings (not errors)

## Build Pipeline (Vite)

The Vite config (`vite.config.ts`) includes several important features:

- **`removeMockData()` plugin**: Automatically strips mock emails, passwords, and API tokens from production builds
- **PWA support**: `vite-plugin-pwa` with Workbox auto-update, 10MB file size limit, API caching (NetworkFirst, 5min)
- **Dev proxy**: `/api/` proxies to `http://localhost:3001` with WebSocket and SSE support
- **Environment prefix**: Only `VITE_` prefixed variables are exposed to the client bundle
- **Host**: `0.0.0.0` for network access during development

## Environment Configuration

Copy `.env.example` to `.env` and configure. See AGENTS.md for the complete list of available variables.

### Required for Development

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/skypanelv2
JWT_SECRET=your-super-secret-jwt-key-here
SSH_CRED_SECRET=your-32-character-encryption-key
ENCRYPTION_KEY=your-32-character-encryption-key
```

### Additional Notable Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `NODE_ENV` | `development` | Runtime environment |
| `PORT` | `3001` | API server port |
| `CLIENT_URL` | `http://localhost:5173` | Frontend URL (CORS) |
| `JWT_EXPIRES_IN` | `7d` | Token expiration |
| `VPS_TAG` | `skypanelv2` | Tag applied to provisioned VPS instances |
| `RDNS_BASE_DOMAIN` | — | Reverse DNS base domain |
| `DEFAULT_ADMIN_EMAIL` | `admin@example.com` | Admin seed email override |
| `DEFAULT_ADMIN_PASSWORD` | `Admin123#` | Admin seed password override |
| `COMPANY_NAME` / `VITE_COMPANY_NAME` | `SkyPanelV2` | Brand name (server + client) |
| `TRUST_PROXY` | `true` | Trust X-Forwarded-* headers |

### Rate Limiting Configuration

Rate limits are configurable via `RATE_LIMIT_*` environment variables with tiered defaults for anonymous (1000/15min), authenticated (5000/15min), and admin (10000/15min) users. Per-user overrides are stored in `user_rate_limit_overrides`. Development mode applies a 100x multiplier.

Specialized limiters: `loginRateLimiter` (5/15min), `passwordResetRateLimiter` (configurable, 100x in dev), `apiKeyMutationRateLimiter`, `billingMutationRateLimiter`, `adminMutationRateLimiter`.

## Database Schema

### Core Tables

- `users` - User accounts with authentication, 2FA, preferences, active_organization_id
- `organizations` - Multi-tenant organization management (with show_on_homepage flag)
- `organization_members` - Organization membership with role_id FK
- `organization_roles` - Custom roles with granular JSONB permissions
- `organization_invitations` - Email-based organization invitations with token
- `wallets` - Organization wallet balances (one per org)
- `payment_transactions` - PayPal billing integration (wallet debits and credits)
- `invoices` - Billing invoices
- `vps_instances` - VPS hosting instances (org-scoped)
- `vps_plans` - VPS plans with base_price, markup_price, backup pricing
- `vps_billing_cycles` - Hourly billing tracking with metadata
- `service_providers` - Cloud provider configuration (type constrained to 'linode')
- `user_ssh_keys` - SSH keys (organization-scoped)
- `user_api_keys` - API key management with row-level security (RLS enabled)
- `support_tickets` - Customer support tickets with has_staff_reply flag
- `support_ticket_replies` - Support ticket conversation threads with PG notify triggers
- `activity_logs` - Detailed system activity logging with is_read/read_at
- `activity_feed` - User notification feed
- `platform_settings` - Global platform configuration (key-value JSONB)
- `email_templates` - Email template management
- `organization_egress_credits` - Egress credit balances per organization
- `egress_credit_packs` - Available credit packs with pricing
- `vps_egress_hourly_readings` - Hourly transfer usage readings

### Database Migrations

SQL migrations are in the `migrations/` directory (52 total: 001–052, sequential). Apply pending migrations with `node scripts/run-migration.js`. Each migration runs in a transaction with SHA256 checksum validation. **Never modify an existing migration** — add a new sequential file instead.

## API Routes

### Core Routes (`/api/`)

- `/api/auth` - Authentication (login, register, 2FA, password reset)
- `/api/vps` - VPS instance management, providers, plans, images, actions
- `/api/organizations` - Organization CRUD, members, invitations, roles
- `/api/payments` - PayPal order creation, capture, wallet operations
- `/api/support` - Support ticket management and replies
- `/api/ssh-keys` - SSH key CRUD with Linode sync
- `/api/invoices` - Invoice listing and detail
- `/api/egress` - Egress credit management, purchase flow, usage readings
- `/api/api-keys` - User API key management (with row-level security)
- `/api/documentation` - Public documentation articles
- `/api/announcements` - Public announcements

### Admin Routes (`/api/admin/`)

- `/api/admin` - User management, stats, impersonation
- `/api/admin/platform` - Platform settings CRUD
- `/api/admin/billing` - Billing management and oversight
- `/api/admin/email-templates` - Email template CRUD
- `/api/admin/contact` - Contact form message management
- `/api/admin/faq` - FAQ category/item/update management
- `/api/admin/github` - GitHub integration and update checking
- `/api/admin/category-mappings` - VPS category white-labeling
- `/api/admin/ssh-keys` - Admin SSH key management
- `/api/admin/activity` - Admin activity log
- `/api/admin/documentation` - Admin documentation CRUD
- `/api/admin/networking` - Admin networking config (rDNS, IPv6)
- `/api/admin/announcements` - Platform announcements management

### Content & Feed Routes

- `/api/activity` - User activity feed (SSE endpoint for real-time)
- `/api/activities` - Activity logging
- `/api/notifications` - Notification management (SSE stream, mark read)
- `/api/faq` - Public FAQ content
- `/api/contact` - Contact form submission
- `/api/theme` - Theme preset management
- `/api/pricing` - Public pricing data
- `/api/health` - Health check endpoint

## Services

### Core Services (`api/services/`)

- `authService` - JWT token management and authentication logic
- `linodeService` - Linode/Akamai REST API wrapper with caching
- `billingService` - Hourly VPS billing engine (wallet deductions)
- `egressCreditService` - Pre-paid egress credit management (balance tracking)
- `egressHourlyBillingService` - Hourly transfer usage polling and credit deduction
- `egressBillingService` - Transfer pool tracking and overage projection (monthly billing)
- `paypalService` - PayPal order creation, capture, wallet deduction
- `emailService` - Email sending with provider fallback (Resend → SMTP)
- `emailTemplateService` - Handlebars-based email template rendering
- `invoiceService` - Invoice generation and management
- `notificationService` - PostgreSQL LISTEN/NOTIFY → EventEmitter singleton for real-time push
- `activityLogger` - Activity logging with real-time PostgreSQL notification triggers

### Provider Services (`api/services/providers/`)

- `IProviderService` - Interface contract for all provider implementations
- `BaseProviderService` - Shared provider logic and caching
- `LinodeProviderService` - Linode-specific implementation
- `ProviderFactory` - Provider instantiation from type + token

## Key Service Patterns

### Database Operations

Use `api/lib/database.ts` helpers:

```typescript
import { query, transaction } from '../lib/database.js';

const result = await query('SELECT * FROM users WHERE id = $1', [userId]);

const result = await transaction(async (client) => {
  await client.query('UPDATE wallets SET balance = balance - $1 WHERE organization_id = $2', [amount, orgId]);
  await client.query('INSERT INTO payment_transactions (...) VALUES (...)', [...]);
  return { success: true };
});
```

### Frontend API Calls

Use the `ApiClient` class from `src/lib/api.ts` (not raw `fetch()`). It handles CSRF token extraction, organization ID header injection, and auto-logout on 401:

```typescript
import { ApiClient } from '@/lib/api';
const client = new ApiClient();
const data = await client.get('/vps');
```

For quick one-off calls, use the `API_BASE_URL` constant:

```typescript
import { API_BASE_URL } from '@/lib/api';
const response = await fetch(`${API_BASE_URL}/endpoint`, {
  credentials: 'include',
  headers: { 'Authorization': `Bearer ${token}` },
});
```

Get the JWT token from the `useAuth()` context hook (`src/contexts/AuthContext.tsx`).

### TanStack Query Pattern

Export a **query key factory** object from every hook file, then use it in `useQuery`, `useMutation`, and `invalidateQueries`:

```typescript
export const myResourceKeys = {
  all: ['my-resource'] as const,
  detail: (id: string) => ['my-resource', id] as const,
};
```

### Authentication Middleware

Protected routes use JWT authentication middleware that sets `req.user` with `{ userId, role, email }`.

### Provider Token Resolution

```typescript
import { normalizeProviderToken } from '../lib/providerTokens.js';
const token = await normalizeProviderToken(providerId);
const provider = ProviderFactory.create('linode', token);
```

### Multi-Tenant Data Isolation

**Critical**: All resource queries MUST be scoped to `organization_id` to prevent cross-organization data leakage. This includes:

- Direct queries in services
- Query builder usage
- Raw SQL queries (avoid when possible)
- Aggregation queries
- Join operations

### Real-Time Architecture

PostgreSQL `LISTEN/NOTIFY` → `notificationService` EventEmitter → SSE endpoint (`/api/notifications`) for real-time updates including:

- Activity feed notifications
- Billing alerts
- System announcements

### Background Services

Server startup (`api/server.ts`) initializes these recurring services:

1. **Hourly VPS Billing**: `BillingService.runHourlyBilling()` — runs every 60 minutes
2. **Hourly Egress Billing**: `EgressHourlyBillingService.runHourlyBilling()` — runs every 60 minutes
3. **Monthly Egress Billing**: `EgressBillingService.executeLiveBilling()` — runs on the 1st of each month
4. **24h Billing Reminders**: `BillingCronService` — runs every 24 hours for low-balance notifications
5. **Notification Service**: PostgreSQL LISTEN/NOTIFY listener for real-time push
6. **Ticket Notification Service**: Support ticket notification listener
7. **SSH Bridge**: WebSocket server for browser-based terminal access
8. **Metrics Collection**: Request metrics with periodic persistence

## Security Architecture

### Data Protection

- **Passwords**: bcrypt hashing with salt
- **SSH credentials**: AES-256-GCM encryption via `SSH_CRED_SECRET`
- **Provider API tokens**: AES-256-GCM encryption via `ENCRYPTION_KEY` with key versioning support
- **JWT tokens**: HMAC-SHA256 signed with configurable expiration (default: 7 days)
- **Row-level security**: PostgreSQL RLS on `user_api_keys` table preventing unauthorized API key access
- **Secrets Management**: Separate encryption keys for different data types (credentials vs tokens)

### Access Control

- **Role-based access control**: Admin vs user roles with organization-scoped data access
- **Organization-based data isolation**: All resource queries scoped to `organization_id` (enforced via middleware and service layer)
- **Custom organization roles**: Granular JSONB permissions stored in `organization_roles` table; use `RoleService.checkPermission()` for validation
- **Admin impersonation**: `X-Impersonating` header swaps request context with visual banner and audit logging
- **2FA Support**: TOTP-based two-factor authentication with QR code generation
- **API Keys**: Row-level security on `user_api_keys` table with encryption and usage tracking

## Theme System

Theme behavior spans frontend context/state and backend APIs — review both before changes.

- **ThemeContext** (`src/contexts/ThemeContext.tsx`): 15 built-in presets (teal, mono, red, violet, emerald, amber, rose, blue, slate, orange, zinc, stone, aurora, midnight, sage) with dynamic loading from `/api/theme`
- **Light/Dark mode**: Managed separately by `useTheme` hook (`src/hooks/useTheme.ts`) using `user-theme-preference` localStorage key; defaults to dark
- **CSS Variables**: Each preset defines HSL tokens for both light and dark modes
- **Persistence**: `skypanelv2:theme` localStorage key for preset selection
- **Backend**: `/api/theme` endpoint returns theme configuration

## Important Notes for Agents

- **Always check `package.json`** before referencing npm scripts
- **Always check `src/App.tsx`** before documenting or changing frontend routes
- **Always check `api/app.ts`** before documenting or changing API surface area
- **Always check `api/lib/database.ts`** before writing database queries (use helpers)
- **Email providers** are Resend and generic SMTP — see `api/config/index.ts`
- **Billing runs hourly** from `server.ts`, not from `billingCronService` (which handles 24h reminder checks)
- **Organization isolation** is critical — be careful with queries that could leak data across orgs (always verify `organization_id` scoping)
- **Default admin credentials**: Generated via `scripts/seed-admin.js` (not hardcoded); configurable via `DEFAULT_ADMIN_EMAIL`/`DEFAULT_ADMIN_PASSWORD` env vars
- **Pre-commit hooks**: NEVER skip or disable — they protect against bad commits
- **Database reset commands**: NEVER run — they destroy production data (`db:fresh`, `db:reset`, `db:reset:confirm`)
- **Migration scripts**: Apply with `node scripts/run-migration.js` — never run destructive migrations manually
- **TypeScript pathing**: Uses `vite-tsconfig-paths` plugin — check `tsconfig.json` for path mappings
- **Environment validation**: Critical secrets validated at startup in `config/index.ts` — import `config` object, never access `process.env` directly in route/service files
- **Provider token normalization**: Always use `normalizeProviderToken()` before creating providers
- **Organization role checking**: Use `RoleService` for granular permission validation
- **Admin impersonation audit**: All impersonation actions are logged for compliance
- **Egress credit zero handling**: Automatic VPS suspension when credits reach zero (handled in egress services)
- **Wallet-based billing**: Prepaid system requires sufficient balance before billing cycle processing
- **Site logo/favicon**: Single source of truth is `public/favicon.svg` — the `Logo` component (`src/components/Logo.tsx`) renders it as an `<img>` tag used by navbar, sidebar, and footer. `index.html` links it as the browser favicon. To update icons, replace `favicon.svg` and regenerate raster variants via [realfavicongenerator.net](https://realfavicongenerator.net/)
- **Error handling**: Use `handleProviderError()` from `api/lib/errorHandling.ts` in VPS routes rather than raw `catch` blocks
- **Activity logging**: Use `logActivity()` from `api/services/activityLogger.ts` for significant user-facing actions
- **Tailwind classes**: Use `cn()` from `@/lib/utils` for conditional/composed class names

## Development Gotchas

- **`predev` / `preclient:dev` hooks** run `docs:api:sync` automatically — this is normal and takes a few seconds before the dev server starts
- **Backend billing scheduler** starts on boot — log output about "0 instances billed" is expected with an empty VPS fleet
- **No `npm test` script** — use `npx vitest run tests/security/` or `npx vitest run` directly
- **Not Prisma**: The app uses raw `pg` queries with SQL migrations despite `@prisma/client` being in dependencies
- **ESM imports**: All local backend imports require `.js` extensions — `import { query } from '../lib/database.js'` (not `../lib/database`)
- **Route-level auth**: Apply `authenticateToken` at the router level, not per-handler: `router.use(authenticateToken, requireOrganization)`
- **CSRF on API routes**: CSRF protection is applied to `/api` routes; include CSRF token from cookies in mutating requests
- **Dark mode anti-flash**: `index.html` contains a script that applies `.dark` class before React loads to prevent flash of wrong theme
