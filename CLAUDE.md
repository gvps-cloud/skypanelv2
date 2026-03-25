# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Important**: Always read [`AGENTS.md`](./AGENTS.md) alongside this file. AGENTS.md documents the current state of the repository and provides practical guidance for coding agents. This file (CLAUDE.md) provides Claude Code-specific development instructions and deeper architectural context.

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

- `npm run db:fresh` - Reset database and run all migrations
- `npm run db:reset` - Interactive database reset with confirmation
- `npm run db:reset:confirm` - Reset database without prompt
- `npm run seed:admin` - Create default admin user (admin@skypanelv2.com / admin123)

### Production Deployment

- `npm run start` - Launch production Express server + Vite preview
- `npm run pm2:start` - Build and start with PM2 process manager
- `npm run pm2:reload` - Reload PM2 processes gracefully
- `npm run pm2:stop` - Stop PM2 processes
- `npm run pm2:list` - List PM2 processes

### Utilities

- `npm run kill-ports` - Kill processes on ports 3001, 5173, and 8000
- `npm run ssl:caddy:help` - Display Caddy SSL setup instructions
- `npm run pwa:icons` - Generate PWA icons

## Architecture Overview

SkyPanelV2 is a full-stack cloud service reseller billing panel with multi-tenant organization support. It provides three distinct product surfaces:

1. **Public marketing pages** — Home, pricing, FAQ, about, contact, status, legal
2. **Authenticated customer portal** — Dashboard, VPS management, billing, support, SSH console, organizations
3. **Admin dashboard** — User management, billing ops, platform settings, provider config, impersonation

### Frontend (`src/`)

- **React 18** SPA with TypeScript and Vite
- **shadcn/ui** component library with Tailwind CSS (Radix UI primitives)
- **TanStack Query** for server state management with optimistic updates
- **Zustand** for client state management
- **React Router v7** for routing with protected route guards (`ProtectedRoute`, `AdminRoute`, `PublicRoute`)
- **React Hook Form + Zod** for form validation
- **Framer Motion** for animations
- **Recharts** for data visualization
- **xterm.js** for browser-based SSH terminal emulation
- **cmdk** for command palette (Ctrl/Cmd + K)
- **qrcode** for 2FA QR code generation

### Backend (`api/`)

- **Express 4** REST API with TypeScript ESM modules
- **PostgreSQL** database with UUID primary keys, JSONB columns, triggers, and `LISTEN/NOTIFY`
- **JWT authentication** with role-based access (admin/user)
- **Rate limiting** with tiered configuration (anonymous/authenticated/admin) and per-user overrides
- **Comprehensive middleware** stack (CORS, Helmet, validation, permissions, impersonation)
- **WebSocket server** for SSH bridge (ws + ssh2)
- **Hourly billing scheduler** running on 60-minute intervals
- **Notification service** using PostgreSQL `LISTEN/NOTIFY` → EventEmitter → SSE

### Key Features

- **Multi-tenant organizations** with role-based access control and custom roles
- **Linode VPS provisioning** via `IProviderService` abstraction layer
- **Automated hourly billing** with wallet-based prepaid system
- **Egress (network transfer) billing** with prepaid credit packs and hourly enforcement
- **Email service** with provider priority/fallback (Resend, generic SMTP)
- **Activity logging and feed** system for audit trails with real-time notifications
- **2FA (Two-Factor Authentication)** support via TOTP
- **Admin impersonation** for customer support
- **Command palette** navigation
- **API documentation auto-sync** on build

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
COMPANY_BRAND_NAME=SkyPanel

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
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

SQL migrations are in the `migrations/` directory with naming convention `NNN_description.sql`. Apply pending migrations with `node scripts/run-migration.js`.

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
- `billingService` - Hourly billing engine
- `egressCreditService` - Egress credit balance, purchase, deduction
- `egressHourlyBillingService` - Hourly billing orchestrator
- `egressBillingService` - Transfer pool tracking and overage projection
- `paypalService` - PayPal order creation, capture, wallet deduction
- `emailService` - Email sending with provider fallback (Resend → SMTP)
- `emailTemplateService` - Handlebars-based email template rendering
- `invoiceService` - Invoice generation and management
- `notificationService` - PG LISTEN/NOTIFY → EventEmitter singleton for real-time push

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

## Frontend Structure

### Pages (`src/pages/`)

- `HomeRedesign` - Landing page (route: `/`)
- `Pricing`, `FAQ`, `AboutUs`, `Contact`, `Status`, `TermsOfService`, `PrivacyPolicy`
- `Login`, `Register`, `ForgotPassword`, `ResetPassword`
- `Dashboard`, `VPS`, `VPSDetail`, `VpsSshConsole` - Core authenticated pages
- `Billing`, `InvoiceDetail`, `TransactionDetail` - Financial pages
- `Organizations`, `AcceptInvitation` - Organization management
- `Support`, `Settings`, `ActivityPage`, `ApiDocs`, `EgressCredits`
- `Admin`, `admin/AdminUserDetail` - Admin pages

### Contexts (`src/contexts/`)

- `AuthContext` - Authentication state, JWT token, user object, logout
- `ThemeContext` - Theme preset management, dark/light mode
- `ImpersonationContext` - Admin impersonation state, start/exit flows
- `BreadcrumbContext` - Navigation breadcrumb state

## Security Architecture

### Data Protection

- **Passwords**: bcrypt hashing
- **SSH credentials**: AES-256 encryption via `SSH_CRED_SECRET`
- **Provider API tokens**: AES-256 encryption via `ENCRYPTION_KEY`
- **JWT tokens**: HMAC-SHA256 signed with configurable expiration (default: 7 days)
- **Row-level security**: PostgreSQL RLS on `user_api_keys` table

### Access Control

- Role-based access control — admin and user roles
- Organization-based data isolation — all resource queries scoped to org
- Custom organization roles with granular JSONB permissions
- Admin impersonation for customer support (with visual banner)

## Important Notes for Agents

- **Always check `package.json`** before referencing npm scripts
- **Always check `src/App.tsx`** before documenting or changing frontend routes
- **Always check `api/app.ts`** before documenting or changing API surface area
- **Email providers** are Resend and generic SMTP — see `api/config/index.ts`
- **Billing runs hourly** from `server.ts`, not from `billingCronService` (which handles 24h reminder checks)
- **Organization isolation** is critical — be careful with queries that could leak data across orgs
- **Theme behavior** spans frontend context/state and backend APIs — review both before changes

## Default Credentials

- **Admin**: `admin@skypanelv2.com` / `admin123`
