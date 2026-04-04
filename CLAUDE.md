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

> **Note**: Check `package.json` before assuming test scripts exist. The repo includes Vitest, React Testing Library, Supertest, and Playwright but test scripts may not always be present.

### Database Management

- `npm run db:fresh` - Reset database and run all migrations (WARNING: destroys all data - use only in development)
- `npm run db:reset` - Interactive database reset with confirmation
- `npm run db:reset:confirm` - Reset database without prompt
- `npm run seed:admin` - Create default admin user ([admin@skypanelv2.com](mailto:admin@skypanelv2.com) / admin123)

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

1. **Public marketing pages** — Home, pricing, FAQ, about, contact, status, legal
2. **Authenticated customer portal** — Dashboard, VPS management, billing, support, SSH console, organizations
3. **Admin dashboard** — User management, billing ops, platform settings, provider config, impersonation

### Frontend (`src/`)

- **React 18** SPA with TypeScript and Vite
- **shadcn/ui** component library with Tailwind CSS (Radix UI primitives)
- **TanStack Query** for server state management with optimistic updates (30s staleTime, 1 retry, refetchOnWindowFocus)
- **Zustand** for client state management (selected stores for UI state)
- **React Router v7** for routing with protected route guards:
  - `ProtectedRoute`: Auth required → AppLayout with sidebar
  - `StandaloneProtectedRoute`: Auth required → AppLayout without sidebar (SSH console)
  - `AdminRoute`: Auth + `user.role === 'admin'` → AppLayout (admin dashboard)
  - `PublicRoute`: Redirects to `/dashboard` if already logged in
- **React Hook Form + Zod** for form validation with schema-based validation
- **Framer Motion** for animations with accessibility considerations
- **Recharts** for data visualization with responsive containers
- **xterm.js** for browser-based SSH terminal emulation with fit/addon packages
- **cmdk** for command palette (Ctrl/Cmd + K) with persistent state
- **qrcode** for 2FA QR code generation using otplib

### Backend (`api/`)

- **Express 4** REST API with TypeScript ESM modules
- **PostgreSQL** database with UUID primary keys, JSONB columns, triggers, and `LISTEN/NOTIFY`
- **JWT authentication** with role-based access (admin/user) and HttpOnly cookie storage
- **Rate limiting** with tiered configuration (anonymous/authenticated/admin) and per-user overrides stored in database
- **Comprehensive middleware** stack:
  - `security.ts`: Helmet, CORS, referrer policy, XSS protection
  - `auth.ts`: JWT verification, token blacklist, organization validation
  - `permissions.ts`: Role-based and organization membership checking
  - `rateLimiting.ts`: Tiered limits with X-RateLimit headers and metrics
- **WebSocket server** for SSH bridge (ws + ssh2) providing browser-based terminal access
- **Hourly billing scheduler** running on 60-minute intervals from `server.ts`
- **Notification service** using PostgreSQL `LISTEN/NOTIFY` → EventEmitter → SSE for real-time updates
- **Provider abstraction layer** (`IProviderService`) enabling multiple cloud providers
- **Row-level security** on `user_api_keys` table for API key protection

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

## Environment Configuration

Copy `.env.example` to `.env` and configure.

### Required for Development

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/skypanelv2
JWT_SECRET=your-super-secret-jwt-key-here
SSH_CRED_SECRET=your-32-character-encryption-key
ENCRYPTION_KEY=your-32-character-encryption-key
```

### External Services

```bash
# Cloud Provider (Linode/Akamai)
LINODE_API_TOKEN=your-linode-api-token
LINODE_API_URL=https://api.linode.com/v4

# Payment Processing
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_MODE=sandbox

# Email Services (provider priority order)
EMAIL_PROVIDER_PRIORITY=resend,smtp
RESEND_API_KEY=your-resend-api-key
SMTP_HOST=mail.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_USERNAME=smtp-user@example.com
SMTP_PASSWORD=super-secure-password
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=SkyPANELv2
CONTACT_FORM_RECIPIENT=support@yourdomain.com

# Proxy Configuration
TRUST_PROXY=true

# Branding
COMPANY_NAME=SkyPanelV2
VITE_COMPANY_NAME=SkyPanelV2
COMPANY_BRAND_NAME=SkyPanelV2

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Optional Services
REDIS_URL=redis://localhost:6379  # Redis caching (optional)
REDIS_PASSWORD=your-redis-password
GITHUB_TOKEN=your-github-token  # Optional GitHub integration
BACKUP_STORAGE_PROVIDER=local  # Backup storage: local, s3, gcs
BACKUP_RETENTION_DAYS=30
```

### Rate Limiting Configuration

Rate limits are configurable via environment variables. Default values are set in `.env.example` and include tiered limits for anonymous, authenticated, and admin users. Per-user overrides are stored in the `user_rate_limit_overrides` table.

## Database Schema

### Core Tables

- `users` - User accounts with authentication, 2FA, preferences, active_organization_id
- `organizations` - Multi-tenant organization management
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

SQL migrations are in the `migrations/` directory (47 total: 001–047, sequential). Apply pending migrations with `node scripts/run-migration.js`.

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

### Admin Routes (`/api/admin/`)

- `/api/admin` - User management, stats, impersonation
- `/api/admin/platform` - Platform settings CRUD
- `/api/admin/billing` - Billing management and oversight
- `/api/admin/email-templates` - Email template CRUD
- `/api/admin/contact` - Contact form message management
- `/api/admin/faq` - FAQ category/item/update management
- `/api/admin/github` - GitHub integration and update checking
- `/api/admin/category-mappings` - VPS category white-labeling

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

1. **Hourly Billing**: Runs every 60 minutes from `server.ts` (not `billingCronService`)
2. **Billing Reminders**: Runs every 24 hours from `services/billingCronService.ts` for low-balance notifications
3. **Egress Monitoring**: Runs hourly from server scheduler to track transfer usage and deduct credits

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
- **Custom organization roles**: Granular JSONB permissions stored in `organization_roles` table
- **Admin impersonation**: `X-Impersonating` header swaps request context with visual banner and audit logging
- **2FA Support**: TOTP-based two-factor authentication with QR code generation
- **API Keys**: Row-level security on `user_api_keys` table with encryption and usage tracking

### Rate Limiting

- **Tiered limits by user type**:
  - Anonymous: 1000 requests/15min
  - Authenticated: 5000 requests/15min
  - Admin: 10000 requests/15min
- **Development multipliers**: 100x higher limits in development mode
- **Per-user override system**: Stored in `user_rate_limit_overrides` table with database persistence
- **Specialized limiters**: Authentication endpoints (login: 5 attempts/15min, password reset: 3 attempts/hour)
- **Logging and metrics**: Comprehensive tracking for debugging and observability

## Important Notes for Agents

- **Always check `package.json`** before referencing npm scripts
- **Always check `src/App.tsx`** before documenting or changing frontend routes
- **Always check `api/app.ts`** before documenting or changing API surface area
- **Always check `api/lib/database.ts`** before writing database queries (use helpers)
- **Email providers** are Resend and generic SMTP — see `api/config/index.ts`
- **Billing runs hourly** from `server.ts`, not from `billingCronService` (which handles 24h reminder checks)
- **Organization isolation** is critical — be careful with queries that could leak data across orgs (always verify `organization_id` scoping)
- **Theme behavior** spans frontend context/state and backend APIs — review both before changes
- **Default admin credentials**: Generated via `scripts/seed-admin.js` (not hardcoded)
- **Pre-commit hooks**: NEVER skip or disable — they protect against bad commits
- **Database reset commands**: NEVER run — they destroy production data (`db:fresh`, `db:reset`, `db:reset:confirm`)
- **Migration scripts**: Apply with `node scripts/run-migration.js` — never run destructive migrations manually
- **TypeScript pathing**: Uses `vite-tsconfig-paths` plugin — check `tsconfig.json` for path mappings
- **Environment validation**: Critical secrets validated at startup in `config/index.ts`
- **Provider token normalization**: Always use `normalizeProviderToken()` before creating providers
- **Organization role checking**: Use `RoleService` for granular permission validation
- **Admin impersonation audit**: All impersonation actions are logged for compliance
- **Egress credit zero handling**: Automatic VPS suspension when credits reach zero (handled in egress services)
- **Wallet-based billing**: Prepaid system requires sufficient balance before billing cycle processing
- **Site logo/favicon**: Single source of truth is `public/favicon.svg` — the `Logo` component (`src/components/Logo.tsx`) renders it as an `<img>` tag used by navbar, sidebar, and footer. `index.html` links it as the browser favicon. To update icons, replace `favicon.svg` and regenerate raster variants via [realfavicongenerator.net](https://realfavicongenerator.net/)

