# Backend Architecture

Express.js API technology stack, route inventory, middleware, service layer, and provider architecture.

> **Back to**: [README](../README.md)

---

## Technology Stack

| Technology              | Purpose                                            |
| ----------------------- | -------------------------------------------------- |
| **Express 4**           | HTTP framework with middleware pipeline            |
| **TypeScript (ESM)**    | Type-safe backend with ES module imports           |
| **PostgreSQL**          | Relational database with UUID PKs, JSONB, triggers |
| **JWT (jsonwebtoken)**  | Stateless authentication tokens                    |
| **bcryptjs**            | Password hashing                                   |
| **ssh2**                | SSH protocol client for terminal bridge            |
| **ws**                  | WebSocket server for SSH bridge                    |
| **Helmet**              | Security headers                                   |
| **express-rate-limit**  | Tiered rate limiting                               |
| **Handlebars**          | Email template rendering                           |
| **nodemailer + Resend** | Email delivery with provider fallback              |

---

## API Route Map

```text
API ROUTE MAP (grouped)
-----------------------------------------------------------------------------
Core
  /api/auth, /api/vps, /api/payments, /api/organizations,
  /api/support, /api/ssh-keys, /api/invoices, /api/egress, /api/api-keys

Hosting
  /api/hosting/status (public), /api/hosting/plans, /api/hosting/regions,
  /api/hosting/services, /api/hosting/purchase,
  /api/hosting/web, /api/hosting/node, /api/hosting/email,
  /api/hosting/dns, /api/hosting/wordpress, /api/hosting/mysql,
  /api/hosting/ftp, /api/hosting/ssl

Activity & Notifications
  /api/activity, /api/activities, /api/notifications

Content & Configuration
  /api/faq, /api/contact, /api/theme, /api/pricing, /api/health,
  /api/documentation, /api/announcements, /api/notes

Admin Surface
  /api/admin/theme, /api/admin/rate-limits, /api/admin/tickets,
  /api/admin/plans, /api/admin/providers, /api/admin/networking,
  /api/admin/users, /api/admin/organizations, /api/admin/egress,
  /api/admin/servers, /api/admin/stackscripts, /api/admin/upstream,
  /api/admin/billing, /api/admin/volume-billing, /api/admin/email-templates,
  /api/admin/contact, /api/admin/activity, /api/admin/announcements,
  /api/admin/ssh-keys, /api/admin/category-mappings, /api/admin/platform,
  /api/admin/faq, /api/admin/documentation, /api/admin/github,
  /api/admin/enhance, /api/admin/fraud-checks, /api/admin/refunds
```

**Core Routes:**

- `/api/auth` — login, register, 2FA, password reset
- `/api/vps` — CRUD, actions, providers, plans, images
- `/api/payments` — PayPal orders, wallet, capture
- `/api/organizations` — CRUD, members, invitations, roles
- `/api/support` — tickets, replies
- `/api/ssh-keys` — CRUD, Linode sync
- `/api/invoices` — list, detail, PDF

**Activity & Notifications:**

- `/api/activity` — user activity feed
- `/api/activities` — activity logging
- `/api/notifications` — SSE stream, mark read

**Content & Config:**

- `/api/faq` — public FAQ content
- `/api/contact` — contact form submission
- `/api/theme` — theme presets
- `/api/pricing` — public pricing data
- `/api/health` — health check
- `/api/notes` — personal and organization notes

**Admin Routes (`/api/admin/`*):**

- `/api/admin/theme` — theme presets
- `/api/admin/rate-limits` — rate limit overrides and monitoring
- `/api/admin/tickets` — support ticket operations
- `/api/admin/plans` — VPS plan configuration
- `/api/admin/providers` — provider configuration
- `/api/admin/users` — user admin operations
- `/api/admin/organizations` — organization admin operations
- `/api/admin/egress` — egress pricing and execution
- `/api/admin/servers` — server operations
- `/api/admin/stackscripts` — StackScript configuration
- `/api/admin/upstream` — upstream/provider sync settings
- `/api/admin/platform` — platform settings
- `/api/admin/billing` — billing management
- `/api/admin/volume-billing` — volume type and billing management
- `/api/admin/email-templates` — email template CRUD
- `/api/admin/contact` — contact messages
- `/api/admin/activity` — admin activity log
- `/api/admin/faq` — FAQ management
- `/api/admin/github` — GitHub integration
- `/api/admin/category-mappings` — white-label categories
- `/api/admin/ssh-keys` — admin SSH key management
- `/api/admin/documentation` — documentation article CRUD
- `/api/admin/networking` — rDNS and IPv6 networking config
- `/api/admin/announcements` — platform announcements

---

## Middleware Pipeline

```text
MIDDLEWARE PIPELINE
-----------------------------------------------------------------------------
Incoming Request
  → Helmet
  → CORS
  → Body parsers (JSON + URL-encoded)
  → Smart rate limiter (API routes only)
  → Rate-limit headers
  → Express router
      ↳ Per-route stack: authenticateToken → checkPermission → impersonation → express-validator → handler
```

---

## Service Layer Architecture

```text
SERVICE LAYER ARCHITECTURE
-----------------------------------------------------------------------------
HTTP Route Handlers (auth.ts, payments.ts, organizations.ts, support.ts, route index modules under admin/ and vps/)
   ↓ delegate to
Service Layer (authService, linodeService, billingService, paypalService,
              emailService, activityLogger, notificationService, invoiceService,
              themeService, categoryMappingService, transferBillingService, etc.)

Service Layer depends on:
  • Provider abstraction: ProviderFactory → IProviderService → LinodeProviderService/BaseProviderService
  • Shared libraries: database.ts, crypto.ts, providerTokens.ts, whiteLabel.ts, validation.ts
  • Background workers: hourly VPS billing, hourly egress billing, monthly egress finalization, NotificationService (LISTEN/NOTIFY)
```

---

## Provider Architecture (Linode)

```text
PROVIDER ARCHITECTURE (LINODE)
-----------------------------------------------------------------------------
Database tables
  • service_providers: id, name, type='linode', encrypted API key, allowed regions
  • provider_region_overrides: provider_id + region filters

Factory Flow
  service_providers record → normalizeProviderToken() → ProviderFactory.create(type, token)

Provider Interface (IProviderService)
  createInstance, getInstance, listInstances, performAction,
  getPlans, getImages, getRegions, validateCredentials

Implementation
  ProviderFactory returns LinodeProviderService which wraps linodeService
  • Makes REST calls to api.linode.com/v4
  • Maintains in-memory cache for plans/images/regions
  • Applies provider_region_overrides filtering on regions
```
