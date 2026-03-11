# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

- `npm run docs:api:sync` - Sync API documentation (auto-runs via pre* hooks)
- `npm run docs:api:audit` - Audit and validate API documentation

### Testing

- `npm run test` - Run complete test suite with Vitest
- `npm run test:watch` - Run Vitest in watch mode for continuous testing

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

## Architecture Overview

SkyPanelV2 is a full-stack cloud service reseller billing panel with multi-tenant organization support.

### Frontend (`src/`)

- **React 18** SPA with TypeScript and Vite
- **shadcn/ui** component library with Tailwind CSS
- **TanStack Query** for server state management with optimistic updates
- **Zustand** for client state management
- **React Router v7** for routing with protected routes
- **React Hook Form + Zod** for form validation
- **Framer Motion** for animations
- **Recharts** for data visualization
- **xterm.js** for terminal emulation
- **qrcode** for QR code generation

### Backend (`api/`)

- **Express.js** REST API with ES modules
- **PostgreSQL** database with UUID primary keys
- **JWT authentication** with role-based access (admin/user)
- **Rate limiting** with tiered configuration (anonymous/authenticated/admin)
- **Comprehensive middleware** stack (CORS, helmet, validation, permissions, impersonation)

### Key Features

- **Multi-tenant organizations** with role-based access control
- **Custom organization roles** with granular permissions
- **Email service** with provider priority/fallback (SMTP2GO, Resend)
- **Activity logging and feed** system for audit trails
- **2FA (Two-Factor Authentication)** support
- **Admin impersonation** for support
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

# Payment Processing
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_MODE=sandbox

# Email Services
EMAIL_PROVIDER_PRIORITY=resend,smtp2go
RESEND_API_KEY=your-resend-api-key
SMTP2GO_API_KEY=your-smtp2go-api-key
SMTP2GO_USERNAME=your-smtp2go-username
SMTP2GO_PASSWORD=your-smtp2go-password
FROM_EMAIL=noreply@yourdomain.com
CONTACT_FORM_RECIPIENT=support@yourdomain.com
TEST_EMAIL=test@yourdomain.com

# AWS S3 (optional)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name

# Proxy Configuration
TRUST_PROXY=true

# Branding
COMPANY_NAME=SkyPanelV2
VITE_COMPANY_NAME=SkyPanelV2
COMPANY_BRAND_NAME=SkyPanel

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads

# InfluxDB Metrics (optional)
INFLUXDB_URL=your-influxdb-url
INFLUXDB_TOKEN=your-influxdb-token
INFLUXDB_ORG=your-org
INFLUXDB_BUCKET=your-bucket
```

### Rate Limiting Configuration

- Anonymous users: 200 requests per 15 minutes
- Authenticated users: 500 requests per 15 minutes
- Admin users: 1000 requests per 15 minutes

## Database Schema

### Core User & Organization Tables

- `users` - User accounts with authentication, 2FA, and preferences
- `organizations` - Multi-tenant organization management
- `organization_members` - Organization membership and roles
- `organization_roles` - Custom roles with granular permissions
- `organization_invitations` - Email-based organization invitations
- `predefined_permissions` - System permission definitions

### VPS & Hosting Tables

- `vps_instances` - VPS hosting instances
- `vps_plans` - VPS plans and pricing
- `vps_billing_cycles` - Hourly billing tracking
- `vps_category_mappings` - White-label category mappings
- `vps_stackscript_configs` - Deployment configurations
- `service_providers` - Cloud provider configuration (Linode)

### Financial Tables

- `payment_transactions` - PayPal billing integration
- `wallets` - Organization wallet balances
- `invoices` - Billing invoices

### Support Tables

- `support_tickets` - Customer support tickets
- `support_ticket_replies` - Support ticket conversation threads

### Security & Access Tables

- `user_api_keys` - API key management with row-level security
- `user_ssh_keys` - SSH keys (organization-scoped)

### Activity & Notification Tables

- `activity_logs` - Detailed system activity logging
- `activity_feed` - User notification feed

### Configuration Tables

- `platform_settings` - Global platform configuration
- `networking_config` - Network configuration
- `email_templates` - Email template management

## API Routes

### Core Routes

- `auth` - Authentication (login, register, logout, 2FA)
- `vps` - VPS instance management
- `organizations` - Organization CRUD and management
- `payments` - Payment processing with PayPal
- `support` - Support ticket management
- `sshKeys` - SSH key management

### Admin Routes (`api/routes/admin/`)

- `admin/billing` - Billing management
- `admin/platform` - Platform settings
- `admin/contact` - Contact form messages
- `admin/emailTemplates` - Email template management
- `admin/categoryMappings` - VPS category white-labeling
- `admin/users` - User management
- `admin/roles` - Organization role management

### Agent Routes (`api/routes/agent/`)

- Automation and agent functionality

### Additional Routes

- `activity` - User activity feed
- `activities` - Activity logging
- `invoices` - Invoice management
- `notifications` - Notification management
- `faq` - FAQ content
- `adminFaq` - Admin FAQ management
- `theme` - Theme management
- `pricing` - Pricing page content
- `contact` - Contact form submissions
- `health` - Health check endpoint
- `github` - GitHub integration

## Services

### Core Services (`api/services/`)

- `auth` - Authentication and JWT token management
- `linode` - Linode/Akamai API integration
- `billing` - Billing and invoice processing
- `paypal` - PayPal payment processing
- `email` - Email sending with provider fallback

### Provider Services

- `providers/` - Cloud provider abstraction layer
- `providerService` - Provider configuration management

### Utility Services

- `activityLogger` - Activity log recording
- `notificationService` - User notification management
- `roles` - Role and permission management
- `sshBridge` - SSH key synchronization
- `themeService` - Theme configuration
- `rateLimit` - Rate limiting utilities
- `encryptionService` - Data encryption utilities

### Background Services

- `billingCronService` - Hourly billing cron job
- `activityEmailService` - Activity email notifications
- `githubService` - GitHub integration

## Middleware

- `auth` - JWT authentication (sets `req.user`)
- `permissions` - Organization-based permissions
- `security` - Security headers and CORS
- `impersonation` - Admin impersonation support
- `validation` - Request validation
- `rateLimit` - Rate limiting with tiered access

## Key Service Patterns

### Database Operations

Use `api/lib/database.ts` helper:

```typescript
import { query } from '../lib/database.js';
const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
```

### Authentication Middleware

Protected routes use JWT authentication:

```typescript
import { authenticateToken } from '../../middleware/auth.js';
router.use(authenticateToken); // Sets req.user
```

### Error Handling

Structured error responses:

```typescript
res.status(500).json({ error: error.message });
// or
res.json({ success: true, data: result });
```

## Frontend Structure

### Pages (`src/pages/`)

**Main Pages:**
- Admin, Dashboard, Billing, Contact, FAQ, Settings

**Admin Pages:**
- `admin/AdminUserDetail` - Admin user detail page

### Components (`src/components/`)

**Feature Directories:**
- `ui/` - Base shadcn/ui components
- `admin/` - Admin-specific components (see [repo-docs/ADMIN_COMPONENTS.md](repo-docs/ADMIN_COMPONENTS.md))
- `layouts/` - Layout components
- `Dashboard/` - Dashboard components
- `VPS/` - VPS management components
- `SSHKeys/` - SSH key management
- `support/` - Support ticket components
- `billing/` - Billing and payment components
- `settings/` - User settings components

### Contexts (`src/contexts/`)

- AuthContext - Authentication state
- ThemeContext - Theme management
- ImpersonationContext - Admin impersonation
- BreadcrumbContext - Navigation breadcrumbs

### Features

- Command palette (Ctrl/Cmd + K)
- Two-factor authentication
- Admin impersonation
- Activity feed

## Project Structure

```
├── api/                        # Express.js backend API
│   ├── routes/                 # API route definitions
│   │   ├── admin/             # Admin-specific routes
│   │   └── agent/             # Agent/automation routes
│   ├── services/              # Business logic and service layer
│   │   └── providers/         # Cloud provider integrations
│   ├── middleware/            # Express middleware
│   ├── config/               # Configuration management
│   ├── lib/                  # Database helpers and utilities
│   └── tests/                # Backend tests
├── src/                       # React frontend SPA
│   ├── components/           # Reusable UI components
│   ├── pages/                # Page components with routing
│   ├── contexts/             # React contexts
│   ├── services/             # API client services
│   ├── lib/                  # Utility libraries
│   ├── theme/                # Theme configuration
│   ├── types/                # TypeScript type definitions
│   └── test-setup.ts         # Test configuration
├── migrations/                # Sequential SQL migrations
├── scripts/                   # Node utilities
├── deploy/                    # Deployment configurations
│   └── caddy/                # Caddy web server configuration
├── public/                    # Static assets
├── data/                      # Static data files
├── repo-docs/                 # Additional documentation
├── tests/                     # Test files and utilities
├── ecosystem.config.cjs       # PM2 configuration
├── vite.config.ts             # Vite configuration
├── vitest.config.ts           # Vitest configuration
└── playwright.config.ts       # Playwright E2E configuration
```

## Testing

### Test Architecture

- **Frontend**: Vitest + React Testing Library with jsdom environment
- **Backend**: Supertest for API endpoint testing
- **E2E**: Playwright for end-to-end testing
- **Test Setup**: Configuration in `src/test-setup.ts` with common mocks
- **Mock Strategy**: Comprehensive browser API mocking for component tests

### Test Locations

- Frontend tests: Co-located with components (`.test.tsx`)
- Backend tests: `api/tests/`
- E2E tests: `tests/e2e/`

### Running Tests

- `npm run test` - Run complete test suite once
- `npm run test:watch` - Continuous testing during development
- Test files use `.test.ts` or `.test.tsx` extensions

## Production Deployment

### PM2 Process Management

Configuration in [ecosystem.config.cjs](ecosystem.config.cjs).

- `npm run pm2:start` - Build and start with PM2
- `npm run pm2:reload` - Reload PM2 processes gracefully
- `npm run pm2:stop` - Stop PM2 processes
- `npm run pm2:list` - List PM2 processes

### SSL Setup with Caddy

For HTTPS setup with Caddy and Let's Encrypt, see [repo-docs/SSL_SETUP.md](repo-docs/SSL_SETUP.md).

- `npm run ssl:caddy:help` - Display Caddy SSL setup instructions
- Configuration files in `deploy/caddy/`

### Vercel Deployment

Configuration in [vercel.json](vercel.json).

## Security Architecture

### Data Protection

- SSH credentials and API tokens encrypted at rest
- Environment variables stored with AES-256 encryption
- JWT tokens with configurable expiration
- Rate limiting with tiered access controls
- Row-level security on API keys

### Access Control

- Role-based access control (RBAC)
- Organization-based data isolation
- Custom organization roles with granular permissions
- Admin impersonation for support

## Database Migrations

### Migration System

- 24 sequential SQL migrations
- Naming convention: `NNN_description.sql`
- Located in `migrations/` directory

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

### Diagnostics & Testing Scripts

- `test-connection.js` - Verify PostgreSQL connectivity
- `test-smtp.js` - Send test email using application configuration
- `test-hourly-billing.js` - Dry-run hourly billing workflow
- `test-ssh-key-sync.js` - Test SSH key sync functionality

### Security & Configuration Scripts

- `generate-ssh-secret.js` - Generate SSH_CRED_SECRET for .env file
- `fix-provider-encryption.js` - Fix provider API token encryption

### Documentation Scripts

- `audit-api-docs.mjs` - Audit and sync API documentation

### Deployment Scripts

- `setup-caddy-ssl.sh` - Setup HTTPS using Caddy + Let's Encrypt

## Manual Testing Checklist

1. **Database Setup**: `npm run db:fresh && npm run seed:admin`
2. **Admin Interface**: Admin dashboard management
3. **VPS Management**: VPS provisioning and lifecycle management
4. **Multi-tenant**: Organization creation and member management
5. **Permissions**: Custom roles and granular permissions
6. **Activity Feed**: Activity logging and notification system

## Default Credentials

- **Email**: `admin@skypanelv2.com`
- **Password**: `admin123`

## Key Architectural Patterns

- **Service Layer**: Business logic separated from route definitions in `api/services/`
- **Database Helper**: Consistent query execution via `api/lib/database.js`
- **React Context**: Global state management (Auth, Theme, Impersonation, Breadcrumb)
- **TanStack Query**: Server state management with optimistic updates
- **Protected Routes**: Role-based access control throughout the application
- **Provider Abstraction**: Cloud provider integration via `api/services/providers/`
- **Multi-tenant Design**: Organization-based data isolation with custom roles
