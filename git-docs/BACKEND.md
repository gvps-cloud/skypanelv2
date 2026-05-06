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
| **ioredis + rate-limit-redis** | Redis-backed rate limiting                 |
| **Handlebars**          | Email template rendering                           |
| **nodemailer + Resend** | Email delivery with provider fallback              |
| **multer**              | File upload handling                               |
| **dompurify**           | HTML sanitization                                  |
| **cookie-parser**       | Cookie handling                                    |

---

## API Route Map

```text
API ROUTE MAP (grouped)
-----------------------------------------------------------------------------
Core
  /api/auth, /api/vps, /api/payments, /api/organizations,
  /api/support, /api/ssh-keys, /api/invoices, /api/egress, /api/api-keys,
  /api/notes, /api/blog

Hosting (Enhance Integration)
  /api/hosting/status (public), /api/hosting/plans, /api/hosting/regions,
  /api/hosting/services, /api/hosting/purchase,
  /api/hosting/web, /api/hosting/apps, /api/hosting/backups,
  /api/hosting/cron, /api/hosting/dns, /api/hosting/email,
  /api/hosting/ftp, /api/hosting/joomla, /api/hosting/mysql,
  /api/hosting/node, /api/hosting/ssh, /api/hosting/ssl,
  /api/hosting/wordpress

Activity & Notifications
  /api/activity, /api/activities, /api/notifications

Content & Configuration
  /api/faq, /api/contact, /api/theme, /api/pricing, /api/health,
  /api/documentation, /api/announcements, /api/notes, /api/egress,
  /api/blog, /api/site-status

Admin Surface
  /api/admin/theme, /api/admin/rate-limits, /api/admin/tickets,
  /api/admin/plans, /api/admin/providers, /api/admin/networking,
  /api/admin/users, /api/admin/organizations, /api/admin/egress,
  /api/admin/servers, /api/admin/stackscripts, /api/admin/upstream,
  /api/admin/billing, /api/admin/volume-billing, /api/admin/email-templates,
  /api/admin/contact, /api/admin/activity, /api/admin/announcements,
  /api/admin/ssh-keys, /api/admin/category-mappings, /api/admin/platform,
  /api/admin/faq, /api/admin/documentation, /api/admin/github,
  /api/admin/enhance, /api/admin/fraud-checks, /api/admin/refunds,
  /api/admin/blog
```

**Core Routes:**

- `/api/auth` — login, register, 2FA, password reset
- `/api/vps` — CRUD, actions, providers, plans, images
- `/api/payments` — PayPal orders, wallet, capture
- `/api/organizations` — CRUD, members, invitations, roles
- `/api/support` — tickets, replies
- `/api/ssh-keys` — CRUD, Linode sync
- `/api/invoices` — list, detail, PDF
- `/api/notes` — personal and organization notes
- `/api/egress` — egress credit management
- `/api/api-keys` — User API key CRUD
- `/api/blog` — public blog posts, categories, tags (must be before notesRoutes)
- `/api/site-status` — public site status and maintenance mode

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
- `/api/admin/enhance` — Enhance hosting integration status, plan sync, subscription oversight
- `/api/admin/fraud-checks` — fraud screening review queue with stats, filters, detail view, and manual allow/block override
- `/api/admin/refunds` — refund creation and management
- `/api/admin/blog` — blog post and category management (CRUD, cover images, tags)

---

## Middleware Pipeline

```text
MIDDLEWARE PIPELINE
-----------------------------------------------------------------------------
Incoming Request
  → requireHttps (enforce HTTPS in production)
  → Helmet
  → CORS
  → Body parsers (JSON + URL-encoded)
  → Smart rate limiter (API routes only, Redis-backed)
  → Rate-limit headers
  → Express router
      ↳ Per-route stack: csrfProtection → authenticateToken → checkPermission
                         → hosting feature gate (optional, for hosting routes)
                         → impersonation → express-validator → handler
```

Key middleware files in `api/middleware/`:
- `auth.ts` — JWT verification, role/permission checks, impersonation
- `hosting.ts` — feature gate for hosting routes (checks Enhance integration enabled)
- `csrfProtection.ts` — CSRF token validation for mutating requests
- `permissions.ts` — Organization-based RBAC permission checks
- `rateLimiting.ts` — Smart rate limiting with per-user overrides
- `security.ts` — Helmet-based security headers, CSP, nonce
- `requireHttps.ts` — HTTPS enforcement in production

---

## Service Layer Architecture

```text
SERVICE LAYER ARCHITECTURE
-----------------------------------------------------------------------------
HTTP Route Handlers (auth.ts, payments.ts, organizations.ts, support.ts,
                     route index modules under admin/ and vps/)
   ↓ delegate to
Service Layer (authService, linodeService, billingService, paypalService,
              emailService, activityLogger, notificationService, invoiceService,
              themeService, categoryMappingService, transferBillingService,
              enhanceService, enhanceOnboardingService, enhanceToggle,
              hostingBillingService, refundService, fraudLabsProService,
              bunnyCdnService, ticketNotificationService,
              notes service, tokenBlacklistService, etc.)

Service Layer depends on:
  • Provider abstraction: ProviderFactory → IProviderService → LinodeProviderService/BaseProviderService
  • Shared libraries: database.ts, crypto.ts, providerTokens.ts, whiteLabel.ts, validation.ts, errorNormalizer.ts
  • Background workers: hourly VPS billing, hourly egress billing, monthly egress finalization,
                        monthly hosting billing, NotificationService (LISTEN/NOTIFY)
```

**Key Services:**

| Service | Purpose |
| ------- | ------- |
| `enhanceService.ts` | Enhance control panel API wrapper |
| `enhanceOnboardingService.ts` | Customer org/website provisioning via Enhance |
| `enhanceToggle.ts` | Feature flag checks for hosting |
| `hostingBillingService.ts` | Monthly recurring billing for hosting subscriptions |
| `refundService.ts` | PayPal refund processing |
| `fraudLabsProService.ts` | FraudLabsPro transaction screening |
| `bunnyCdnService.ts` | Bunny CDN edge server IP detection |
| `ticketNotificationService.ts` | Support ticket email/real-time notifications |
| `notes.ts` | Personal and organization notes |
| `tokenBlacklistService.ts` | JWT token blacklist management |
| `bruteForceProtectionService.ts` | Login brute-force protection |
| `emailTemplateService.ts` | Handlebars email template rendering |
| `platformSettingsService.ts` | Platform-wide settings management |
| `platformStatsService.ts` | Platform statistics aggregation |
| `activityFeed.ts` | Activity feed query/aggregation |
| `activityEmailService.ts` | Activity event email notifications |
| `providerResourceCache.ts` | In-memory caching for provider API responses |
| `invitations.ts` | Organization invitation management |
| `ipService.ts` | IP address management |
| `roles.ts` | Organization role and permission management |
| `billingCronService.ts` | Billing cron scheduler orchestration |

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

Error Handling
  errorNormalizer.ts — normalizes provider-specific errors into consistent API responses
```

---

## Hosting Service Architecture (Enhance)

```text
HOSTING SERVICE ARCHITECTURE (ENHANCE)
-----------------------------------------------------------------------------
Database tables
  • platform_integrations: Enhance connection config
  • hosting_plans: synced plan catalog with local pricing overrides
  • hosting_subscriptions: customer subscriptions with org FK, status, dates
  • hosting_wallets: dedicated wallets for hosting billing (separate from VPS wallets)

Onboarding Flow
  Customer → /api/hosting/purchase → enhanceOnboardingService
    1. Create/find Enhance customer org
    2. Create subscription record
    3. Add domain → install SSL → create website
    4. Configure email/MySQL/apps as needed
    5. Rollback + wallet credit on failure

Billing Flow
  hostingBillingService (monthly cron)
    1. Fetch active subscriptions
    2. Deduct monthly fee from hosting_wallets
    3. Suspend on insufficient balance via Enhance API
```

**Hosting utility helpers (`api/lib/`):**

| File | Purpose |
| ---- | ------- |
| `hostingBackups.ts` | Backup management helpers |
| `hostingEnhanceOrg.ts` | Enhance org resolution |
| `hostingRouteHelpers.ts` | Shared route handler utilities |
| `activityFilters.ts` | Activity log filtering logic |
| `diagnostics.ts` | System diagnostics utilities |

> **Back to**: [README](../README.md)
