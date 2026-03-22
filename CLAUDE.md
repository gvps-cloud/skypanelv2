# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Important**: Always read [`AGENTS.md`](./AGENTS.md) alongside this file. AGENTS.md documents the current state of the repository and provides practical guidance for coding agents. This file (CLAUDE.md) provides Claude Code-specific development instructions and deeper architectural context.

## Development Commands

### Core Development

- `npm run dev` - Start concurrent frontend (Vite) and backend (nodemon) development servers
- `npm run dev-up` - Kill ports 3001/5173/8000 and start development servers
- `npm run client:dev` - Frontend only (Vite dev server on port 5173)
- `npm run server:dev` - Backend only (Express API on port 3001)
- `npm run build` - TypeScript check + Vite build for production
- `npm run lint` - ESLint validation
- `npm run check` - TypeScript type checking without emitting files
- `npm run preview` - Preview production build locally

### API Documentation

- `npm run docs:api:sync` - Sync API documentation (auto-runs via pre* hooks on `dev`, `client:dev`, and `build`)
- `npm run docs:api:audit` - Audit and validate API documentation coverage

### Testing

> **Note**: Check `package.json` before assuming test scripts exist. As noted in [`AGENTS.md`](./AGENTS.md), test scripts may not be present. The repo includes Vitest, React Testing Library, Supertest, and Playwright configurations but script availability should be verified.

### Database Management

- `npm run db:fresh` - Reset database and run all 27 migrations
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
- **Network transfer billing** with pool quota tracking and overage projection
- **Email service** with provider priority/fallback (Resend, generic SMTP)
- **Activity logging and feed** system for audit trails with real-time notifications
- **2FA (Two-Factor Authentication)** support via TOTP
- **Admin impersonation** for customer support
- **Command palette** navigation
- **API documentation auto-sync** on build

## Environment Configuration

Copy `.env.example` to `.env` and configure.

For complete environment variable reference, see [repo-docs/ENVIRONMENT_VARIABLES.md](repo-docs/ENVIRONMENT_VARIABLES.md).

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

### Rate Limiting Configuration (Current Defaults)

- Anonymous users: **1,000** requests per 15 minutes
- Authenticated users: **5,000** requests per 15 minutes
- Admin users: **10,000** requests per 15 minutes

These are configurable via `RATE_LIMIT_ANONYMOUS_MAX`, `RATE_LIMIT_AUTHENTICATED_MAX`, `RATE_LIMIT_ADMIN_MAX` and their corresponding `_WINDOW_MS` variables. Per-user overrides are stored in the `user_rate_limit_overrides` table.

## Database Schema

### Core User & Organization Tables

- `users` - User accounts with authentication, 2FA, preferences, active_organization_id
- `organizations` - Multi-tenant organization management
- `organization_members` - Organization membership with role_id FK
- `organization_roles` - Custom roles with granular JSONB permissions
- `organization_invitations` - Email-based organization invitations with token

### VPS & Hosting Tables

- `vps_instances` - VPS hosting instances (org-scoped, with provider_id, backup_frequency, created_by)
- `vps_plans` - VPS plans with base_price, markup_price, backup pricing fields
- `vps_billing_cycles` - Hourly billing tracking with metadata
- `vps_category_mappings` - White-label category mappings
- `vps_stackscript_configs` - Curated StackScript deployment configurations
- `service_providers` - Cloud provider configuration (type constrained to 'linode')
- `provider_metadata` - Provider-specific metadata key-value store
- `provider_region_overrides` - Admin-defined region allowlists per provider

### Financial Tables

- `payment_transactions` - PayPal billing integration (wallet debits and credits)
- `wallets` - Organization wallet balances (one per org)
- `invoices` - Billing invoices

### Support Tables

- `support_tickets` - Customer support tickets with has_staff_reply flag
- `support_ticket_replies` - Support ticket conversation threads with PG notify triggers

### Security & Access Tables

- `user_api_keys` - API key management with row-level security (RLS enabled)
- `user_ssh_keys` - SSH keys (organization-scoped, with linode_key_id and created_by)
- `user_rate_limit_overrides` - Per-user rate limit overrides set by admins

### Activity & Notification Tables

- `activity_logs` - Detailed system activity logging with is_read/read_at, PG notify trigger
- `activity_feed` - User notification feed

### Configuration Tables

- `platform_settings` - Global platform configuration (key-value JSONB)
- `networking_config` - Network configuration (rDNS base domain)
- `email_templates` - Email template management
- `faq_categories` / `faq_items` / `faq_updates` - FAQ content management
- `contact_categories` / `contact_methods` / `platform_availability` - Contact page configuration

## API Routes

### Core Routes (registered in `api/app.ts`)

- `/api/auth` - Authentication (login, register, 2FA, password reset)
- `/api/vps` - VPS instance management, providers, plans, images, actions
- `/api/organizations` - Organization CRUD, members, invitations, roles
- `/api/payments` - PayPal order creation, capture, wallet operations
- `/api/support` - Support ticket management and replies
- `/api/ssh-keys` - SSH key CRUD with Linode sync
- `/api/invoices` - Invoice listing and detail

### Admin Routes (`/api/admin/*`)

- `/api/admin` - User management, stats, impersonation
- `/api/admin/platform` - Platform settings CRUD
- `/api/admin/billing` - Billing management and oversight
- `/api/admin/email-templates` - Email template CRUD
- `/api/admin/contact` - Contact form message management
- `/api/admin/faq` - FAQ category/item/update management
- `/api/admin/github` - GitHub integration and update checking
- `/api/admin` (categoryMappings) - VPS category white-labeling

### Content & Feed Routes

- `/api/activity` - User activity feed (SSE endpoint for real-time)
- `/api/activities` - Activity logging
- `/api/notifications` - Notification management (SSE stream, mark read)
- `/api/faq` - Public FAQ content
- `/api/contact` - Contact form submission
- `/api/theme` - Theme preset management
- `/api/pricing` - Public pricing data
- `/api/health` - Health check endpoint
- `/api/egress` - Egress credit management, purchase flow, usage readings

### Agent Routes (`api/routes/agent/`)

- Reserved directory for automation/agent functionality (currently empty)

## Services

### Core Services (`api/services/`)

- `authService` - JWT token management and authentication logic
- `linodeService` - Linode/Akamai REST API wrapper with caching
- `billingService` - Hourly billing engine (runHourlyBilling, billVPSCreation, getBillingSummary)
- `egressBillingService` - Network transfer pool quota tracking and overage projection
- `egressCreditService` - Egress credit balance, purchase, deduction, manual add
- `egressHourlyBillingService` - Hourly billing orchestrator (polls Linode transfer API, deducts credits, auto-shutoff)
- `paypalService` - PayPal order creation, capture, wallet deduction
- `emailService` - Email sending with provider fallback (Resend → SMTP)
- `emailTemplateService` - Handlebars-based email template rendering
- `invoiceService` - Invoice generation and management

### Provider Services (`api/services/providers/`)

- `IProviderService` - Interface contract for all provider implementations
- `BaseProviderService` - Shared provider logic and caching
- `LinodeProviderService` - Linode-specific implementation
- `ProviderFactory` - Provider instantiation from type + token
- `errorNormalizer` - Standardized provider error handling

### Egress Services (`api/services/egress/`)

- `egressUtils` - Linode transfer API helpers and quota calculations

### Activity & Notification Services

- `activityLogger` - Activity log recording to database
- `activityFeed` - Activity feed query service
- `activityEmailService` - Activity-triggered email notifications
- `notificationService` - PG LISTEN/NOTIFY → EventEmitter singleton for real-time push
- `userNotificationPreferences` - User notification settings

### Configuration Services

- `providerService` - Provider CRUD and configuration management
- `providerResourceCache` - Cached provider data (plans, images, regions)
- `categoryMappingService` - White-label category mapping logic
- `themeService` - Theme preset configuration
- `platformStatsService` - Admin dashboard statistics
- `roles` - Role and permission management
- `invitations` - Organization invitation logic

### Background Services

- `billingCronService` - 24-hour billing reminder cron (low balance alerts)
- Hourly billing scheduler - Runs every 60 minutes from `server.ts` (calls `BillingService.runHourlyBilling()`)

### Infrastructure Services

- `sshBridge` - WebSocket SSH terminal bridge (ws + ssh2)
- `rateLimitMetrics` - Rate limit metrics collection and persistence
- `rateLimitConfigValidator` - Rate limit configuration validation
- `rateLimitOverrideService` - Per-user rate limit override management
- `githubService` - GitHub API integration for update checking

## Middleware (`api/middleware/`)

- `auth.ts` - JWT authentication (sets `req.user` with userId, role, email)
- `permissions.ts` - Organization-based permission checking
- `rateLimiting.ts` - Smart rate limiting with tiered access + response headers
- `security.ts` - Helmet security headers and CORS configuration

> **Note**: Impersonation is handled within the auth middleware and route handlers, not as a separate middleware file.

## Key Service Patterns

### Database Operations

Use `api/lib/database.ts` helpers:

```typescript
import { query, transaction } from '../lib/database.js';

// Simple query
const result = await query('SELECT * FROM users WHERE id = $1', [userId]);

// Transaction
const result = await transaction(async (client) => {
  await client.query('UPDATE wallets SET balance = balance - $1 WHERE organization_id = $2', [amount, orgId]);
  await client.query('INSERT INTO payment_transactions (...) VALUES (...)', [...]);
  return { success: true };
});
```

### Authentication Middleware

Protected routes use JWT authentication:

```typescript
import { authenticateToken } from '../../middleware/auth.js';
router.use(authenticateToken); // Sets req.user with { userId, role, email }
```

### Provider Token Resolution

```typescript
import { normalizeProviderToken } from '../lib/providerTokens.js';
const token = await normalizeProviderToken(providerId);
const provider = ProviderFactory.create('linode', token);
```

### Error Handling

Structured error responses:

```typescript
// Error
res.status(500).json({ success: false, error: error.message });

// Success
res.json({ success: true, data: result });
```

## Frontend Structure

### Pages (`src/pages/`)

**Public Pages:**
- `HomeRedesign` - Landing page (route: `/`)
- `Pricing`, `FAQ`, `AboutUs`, `Contact`, `Status`, `TermsOfService`, `PrivacyPolicy`
- `Login`, `Register`, `ForgotPassword`, `ResetPassword`

**Authenticated Pages:**
- `Dashboard` - User dashboard with stats and activity
- `VPS` - VPS instance list
- `VPSDetail` - VPS detail view with actions
- `VpsSshConsole` - Full-screen SSH terminal (standalone layout)
- `SSHKeys` - SSH key management
- `Billing` - Billing overview, wallet, payment history
- `InvoiceDetail`, `TransactionDetail` - Financial detail views
- `BillingPaymentSuccess`, `BillingPaymentCancel` - PayPal return pages
- `Organizations` - Organization management and detail
- `Support` - Support ticket management
- `Settings` - User profile, 2FA, preferences
- `Activity` - Activity history
- `ApiDocs` - API documentation viewer
- `AcceptInvitation` - Organization invitation acceptance
- `EgressCredits` - Egress credit balance, purchase, and usage history

**Admin Pages:**
- `Admin` - Admin dashboard with tabbed management panels
- `admin/AdminUserDetail` - Detailed user view with billing, VPS, and profile info

### Components (`src/components/`)

**Feature Directories:**
- `ui/` - Base shadcn/ui components (Button, Dialog, Input, Table, etc.)
- `admin/` - Admin-specific components (see [repo-docs/ADMIN_COMPONENTS.md](repo-docs/ADMIN_COMPONENTS.md))
  - `UserManagement`, `VPSPlanWizard`, `CategoryMappingManager`, `RateLimitMonitoring`
  - `ContactCategoryManager`, `ContactMethodManager`, `PlatformAvailabilityManager`
  - `FAQItemManager`, `UpdatesManager`, `RegionAccessManager`
  - `ImpersonationBanner`, `ImpersonationLoadingOverlay`
  - `AdminSupportView`, `OrganizationManagement`
  - `EgressCreditManager` - Admin egress credit management UI
  - `EgressPackSettings` - Admin credit pack pricing configuration
  - `email/` - Email template management components
  - `billing/` - Admin billing components
- `VPS/` - VPS creation wizard steps, SSH terminal, provider/region selectors
- `billing/` - Payment forms, transaction history, invoice views
- `support/` - Ticket creation, conversation threads
- `organizations/` - Org management, member lists, invitation flows
- `settings/` - User profile, 2FA setup, API key management
- `Dashboard/` - Dashboard widgets and stats cards
- `SSHKeys/` - SSH key management components
- `layouts/` - Layout wrappers
- `data-table/` - Reusable data table component
- `hooks/` - Component-level hooks

**Standalone Components:**
- `AppLayout.tsx` - Main app shell with sidebar navigation
- `AppSidebar.tsx` - Navigation sidebar
- `PublicLayout.tsx` - Public page layout wrapper
- `MarketingNavbar.tsx` / `MarketingFooter.tsx` - Public page navigation
- `NotificationDropdown.tsx` - Notification bell with real-time updates
- `ActivityFeed.tsx` - Activity feed component
- `ErrorBoundary.tsx` - Error boundary wrapper

### Contexts (`src/contexts/`)

- `AuthContext` - Authentication state, JWT token, user object, logout
- `ThemeContext` - Theme preset management, dark/light mode
- `ImpersonationContext` - Admin impersonation state, start/exit flows
- `BreadcrumbContext` - Navigation breadcrumb state

### Hooks (`src/hooks/`)

- `use-mobile.tsx` - Mobile device detection
- `use-orientation.tsx` - Screen orientation detection
- `use-virtual-keyboard.tsx` - Virtual keyboard handling
- `use-mobile-animations.tsx` - Mobile-optimized animations
- `use-mobile-navigation.tsx` - Mobile navigation patterns
- `use-mobile-performance.tsx` - Mobile performance optimizations
- `use-form-persistence.tsx` - Form state persistence
- `use-lazy-loading.tsx` - Lazy loading utilities
- `useCategoryMappings.ts` - Category mapping data hook
- `useTheme.ts` - Theme hook

### Frontend Services (`src/services/`)

- `paymentService.ts` - Payment API client
- `adminEmailTemplateService.ts` - Admin email template API client
- `categoryMappingService.ts` - Category mapping API client
- `egressService.ts` - Egress credit and usage API client

### Frontend Libraries (`src/lib/`)

- `api.ts` - Axios API client with auto-logout on 401
- `apiRouteManifest.ts` - API route manifest for docs
- `utils.ts` - General utilities (cn, etc.)
- `billingUtils.ts` - Billing calculation helpers
- `brand.ts` - Branding utilities
- `formatters.ts` - Data formatting helpers
- `validation.ts` - Client-side validation
- `errorHandling.ts` - Error handling utilities
- `vpsLabelGenerator.ts` - VPS label generation
- `vpsStepConfiguration.ts` - VPS creation wizard step config
- `activeHoursUtils.ts` - Active hours calculation
- `breadcrumbs.ts` - Breadcrumb configuration
- `color.ts` - Color utilities
- `providerErrors.ts` - Provider error display helpers
- `timezones.ts` - Timezone data

## Project Structure

```
├── api/                        # Express.js backend API
│   ├── app.ts                  # Express app wiring and route registration
│   ├── server.ts               # HTTP server, SSH bridge init, billing scheduler
│   ├── index.ts                # Entry point
│   ├── config/                 # Environment and runtime config
│   ├── lib/                    # Shared backend helpers (database, crypto, validation)
│   ├── middleware/             # Auth, permissions, rate limiting, security
│   ├── routes/                 # API route definitions
│   │   ├── admin/             # Admin-specific routes
│   │   └── agent/             # Agent/automation routes (reserved)
│   └── services/              # Business logic and service layer
│       └── providers/         # Cloud provider abstraction (Linode)
├── src/                        # React frontend SPA
│   ├── App.tsx                 # Root component, route definitions, context providers
│   ├── main.tsx                # React DOM entry point
│   ├── components/            # Reusable UI and feature components
│   │   ├── ui/                # shadcn/ui base components
│   │   ├── admin/             # Admin dashboard components
│   │   ├── VPS/               # VPS management components
│   │   ├── billing/           # Billing components
│   │   ├── support/           # Support components
│   │   ├── organizations/     # Organization components
│   │   ├── settings/          # Settings components
│   │   ├── Dashboard/         # Dashboard widgets
│   │   ├── SSHKeys/           # SSH key components
│   │   ├── data-table/        # Reusable data table
│   │   ├── layouts/           # Layout wrappers
│   │   └── hooks/             # Component-level hooks
│   ├── pages/                 # Page components with routing
│   │   ├── admin/             # Admin pages
│   │   └── user/              # User-specific pages
│   ├── contexts/              # React contexts (Auth, Theme, Impersonation, Breadcrumb)
│   ├── hooks/                 # Reusable React hooks
│   ├── services/              # Frontend API client services
│   ├── lib/                   # Utility libraries (API client, formatters, validation)
│   ├── theme/                 # Theme preset definitions
│   ├── types/                 # TypeScript type definitions
│   ├── styles/                # Page-specific CSS
│   └── assets/                # Static assets
├── migrations/                 # 33 sequential SQL migrations (001–033)
├── scripts/                    # Node.js utility scripts
├── deploy/                     # Deployment configurations
│   └── caddy/                 # Caddy web server configuration
├── public/                     # Static assets (icons, logos)
├── data/                       # Static data files
├── repo-docs/                  # Internal documentation
├── ecosystem.config.cjs        # PM2 configuration (2 processes: api + ui)
├── vite.config.ts              # Vite configuration
├── vitest.config.ts            # Vitest configuration
├── playwright.config.ts        # Playwright E2E configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── tsconfig.json               # TypeScript configuration
├── AGENTS.md                   # AI agent coding guidelines
└── README.md                   # Project documentation with Mermaid diagrams
```

## Testing

### Test Architecture

- **Frontend**: Vitest + React Testing Library with jsdom environment
- **Backend**: Supertest for API endpoint testing
- **E2E**: Playwright for end-to-end testing
- **Property-based**: fast-check for property-based testing
- **Test Setup**: Configuration in `src/test-setup.ts` with common mocks
- **Mock Strategy**: Comprehensive browser API mocking for component tests

### Test Locations

- Frontend tests: Co-located with components (`.test.tsx`)
- Backend tests: `api/services/*.test.ts` and `api/tests/`
- E2E tests: `tests/e2e/`

### Running Tests

> **Important**: Always check `package.json` for current test script availability before running test commands. See [`AGENTS.md`](./AGENTS.md) testing notes.

- Test files use `.test.ts` or `.test.tsx` extensions

## Production Deployment

### PM2 Process Management

Configuration in [ecosystem.config.cjs](ecosystem.config.cjs). Runs two processes:
- `skypanelv2-api` - Express server with SSH bridge (port 3001)
- `skypanelv2-ui` - Vite preview server (port 5173)

- `npm run pm2:start` - Build and start with PM2
- `npm run pm2:reload` - Reload PM2 processes gracefully
- `npm run pm2:stop` - Stop PM2 processes
- `npm run pm2:list` - List PM2 processes

### SSL Setup with Caddy

For HTTPS setup with Caddy and Let's Encrypt, see [repo-docs/SSL_SETUP.md](repo-docs/SSL_SETUP.md).

- `npm run ssl:caddy:help` - Display Caddy SSL setup instructions
- Configuration template in `deploy/caddy/Caddyfile.template`

### Vercel Deployment

Configuration in [vercel.json](vercel.json).

## Security Architecture

### Data Protection

- **Passwords**: bcrypt hashing
- **SSH credentials**: AES-256 encryption via `SSH_CRED_SECRET`
- **Provider API tokens**: AES-256 encryption via `ENCRYPTION_KEY`
- **JWT tokens**: HMAC-SHA256 signed with configurable expiration (default: 7 days)
- **Rate limiting**: Tiered access controls with per-user overrides
- **Row-level security**: PostgreSQL RLS on `user_api_keys` table

### Access Control

- Role-based access control (RBAC) — admin and user roles
- Organization-based data isolation — all resource queries scoped to org
- Custom organization roles with granular JSONB permissions
- Admin impersonation for customer support (with visual banner)

### Real-Time Security

- WebSocket SSH connections authenticated via JWT token in query string
- VPS instance access verified against organization membership
- SSH credentials decrypted only at connection time, never exposed to client

## Database Migrations

### Migration System

- 33 sequential SQL migrations (001–033, with 006 skipped)
- Naming convention: `NNN_description.sql`
- Located in `migrations/` directory
- Initial migration (001) is a consolidated schema containing multiple historical migrations

### Applying Migrations

```bash
# Apply all pending migrations
node scripts/run-migration.js

# Reset database and run all migrations
npm run db:fresh

# Apply a single migration
node scripts/apply-single-migration.js <filename>

# Apply StackScript migrations
node scripts/apply-stackscript-migration.js
```

## Utility Scripts

### Database & Migration Scripts

- `reset-database.js` - Interactive database reset with confirmation
- `run-migration.js` - Apply pending database migrations
- `apply-single-migration.js` - Apply a specific migration
- `apply-stackscript-migration.js` - Apply StackScript migrations
- `check-migration.js` - Check if column exists
- `verify-active-org-column.js` - Verify active organization column
- `clean-migration.js` - Clean migration artifacts
- `check-users-schema.js` - Check users schema
- `check-vps-plans.js` - Check VPS plans

### Admin & User Management Scripts

- `seed-admin.js` - Create default admin user
- `create-test-admin.js` - Create admin user with custom credentials
- `promote-to-admin.js` - Elevate existing user to admin role
- `update-admin-password.js` - Rotate admin passwords
- `debug-admin-login.js` - Debug admin login issues
- `ensure-admin-user.js` - Ensure admin user exists
- `verify-admin-status.js` - Verify admin status via API
- `check-admin-users.js` - Check admin users in database

### Platform Management Scripts

- `check-contact-methods-status.js` - Check contact methods status
- `check-platform-settings.js` - Check platform settings
- `update-theme-to-mono.js` - Update theme to monochrome
- `migrate-backup-pricing-data.js` - Migrate backup pricing data
- `migrate-vps-plan-type-class.js` - Migrate VPS plan type/class
- `migrate-vps-provider-data.js` - Migrate VPS provider data

### Security & Configuration Scripts

- `generate-ssh-secret.js` - Generate SSH_CRED_SECRET for .env file
- `fix-provider-encryption.js` - Fix provider API token encryption

### Documentation Scripts

- `audit-api-docs.mjs` - Audit and sync API documentation

### Deployment Scripts

- `setup-caddy-ssl.sh` - Setup HTTPS using Caddy + Let's Encrypt

## Manual Testing Checklist

1. **Database Setup**: `npm run db:fresh && npm run seed:admin`
2. **Auth Flow**: Login, register, 2FA setup, password reset
3. **Admin Interface**: Admin dashboard, user management, platform settings
4. **VPS Management**: VPS provisioning, actions, SSH console, deletion
5. **Billing**: Add funds via PayPal, verify wallet, check hourly deductions
6. **Multi-tenant**: Organization creation, member invitation, role assignment
7. **Permissions**: Custom roles and granular permissions
8. **Support**: Ticket creation, staff reply, ticket closure
9. **Activity Feed**: Activity logging and real-time notification system

## Default Credentials

- **Email**: `admin@skypanelv2.com`
- **Password**: `admin123`

## Key Architectural Patterns

- **Service Layer**: Business logic separated from route definitions in `api/services/`
- **Database Helper**: Consistent query execution via `api/lib/database.ts` (`query()` and `transaction()`)
- **Provider Abstraction**: `IProviderService` interface → `ProviderFactory` → `LinodeProviderService`
- **React Context**: Global state management (Auth, Theme, Impersonation, Breadcrumb)
- **TanStack Query**: Server state management with caching and optimistic updates
- **Protected Routes**: Frontend route guards backed by JWT middleware on the backend
- **Multi-tenant Design**: Organization-based data isolation with custom roles
- **Real-Time Events**: PG triggers → `LISTEN/NOTIFY` → `NotificationService` EventEmitter → SSE
- **Hourly Billing**: Server-side scheduler in `server.ts` calling `BillingService.runHourlyBilling()` every 60 minutes

## Important Notes for Agents

> These notes supplement the guidance in [`AGENTS.md`](./AGENTS.md).

- **Always check `package.json`** before referencing npm scripts — some documented scripts may not exist
- **Always check `src/App.tsx`** before documenting or changing frontend routes
- **Always check `api/app.ts`** before documenting or changing API surface area
- **Email providers** are Resend and generic SMTP (not SMTP2GO) — see `api/config/index.ts`
- **The `agent/` routes directory** is currently empty/reserved
- **Billing runs hourly** from `server.ts`, not from `billingCronService` (which handles 24h reminder checks)
- **Organization isolation** is critical — be careful with queries that could leak data across orgs
- **Impersonation** affects access-sensitive work — admin can act as any user
- **Theme behavior** spans frontend context/state and backend APIs — review both before changes
