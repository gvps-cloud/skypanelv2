# SkyPanelV2 Code Wiki

Comprehensive developer reference for the SkyPanelV2 codebase — architecture, modules, key classes/functions, dependencies, and operational guide.

For product-level context and prose documentation, see [README.md](README.md) and the `git-docs/` index.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Repository Layout](#repository-layout)
- [Architecture](#architecture)
  - [Frontend (React 18 + Vite)](#frontend-react-18--vite)
  - [Backend (Express 4 + TypeScript)](#backend-express-4--typescript)
  - [Shared Workspace Packages (lib/)](#shared-workspace-packages-lib)
  - [Database & Migrations](#database--migrations)
- [Major Modules](#major-modules)
  - [Frontend Modules](#frontend-modules-src)
  - [Backend Modules](#backend-modules-api)
- [Key Classes & Functions](#key-classes--functions)
- [Dependency Relationships](#dependency-relationships)
- [Configuration & Environment](#configuration--environment)
- [Key Application Flows](#key-application-flows)
  - [Authentication & Organization Context](#authentication--organization-context)
  - [API Key Authentication](#api-key-authentication)
  - [VPS Provisioning (Provider Abstraction)](#vps-provisioning-provider-abstraction)
  - [Billing (Wallet + Hourly VPS + Egress + Hosting)](#billing-wallet--hourly-vps--egress--hosting)
  - [Notifications (SSE + Postgres LISTEN/NOTIFY)](#notifications-sse--postgres-listennotify)
  - [SSH Console (WebSocket ↔ SSH2 Bridge)](#ssh-console-websocket--ssh2-bridge)
  - [Enhance Hosting Purchase](#enhance-hosting-purchase)
  - [Theme System (Remote Presets + Local Apply)](#theme-system-remote-presets--local-apply)
- [Running the Project](#running-the-project)
  - [Prerequisites](#prerequisites)
  - [Environment Setup](#environment-setup)
  - [Database Setup](#database-setup)
  - [Development](#development)
  - [Production Build/Run](#production-buildrun)
  - [Testing](#testing)
  - [API Docs & Codegen](#api-docs--codegen)
- [Testing Strategy](#testing-strategy)

---

## Project Overview

SkyPanelV2 is a full-stack cloud reseller operations platform for managing Linode VPS reselling and optional Enhance web hosting. The application serves three distinct product surfaces:

| Surface | Description | Users |
|---|---|---|
| **Public Marketing** | Home, pricing, FAQ, about, contact, status, legal pages | Anonymous visitors |
| **Customer Portal** | Dashboard, VPS management, billing, support, SSH console, organizations | Authenticated users |
| **Admin Dashboard** | User management, billing ops, provider config, impersonation, platform settings | Admin users |

**Revenue Model:** Linode base cost + admin markup = customer hourly rate. Billing is **hourly** — charges are deducted from the organization's prepaid wallet every hour via an automated scheduler. Wallets are funded through PayPal.

**Runtime Architecture:**
- Vite dev server at `:5173` (SPA).
- Express API server at `:3001` (REST + SSE + WebSocket SSH bridge).
- PostgreSQL as the primary datastore.

---

## Repository Layout

Top-level directories:

| Directory | Purpose |
|---|---|
| `src/` | React SPA — pages, components, contexts, hooks |
| `api/` | Express API server — routes, middleware, services |
| `lib/` | pnpm workspace packages — spec/codegen/typed clients/schemas |
| `migrations/` | Numbered SQL migrations (do not edit existing migrations) |
| `scripts/` | Operational utilities — migrations, verification, seeding |
| `git-docs/` | Curated documentation |
| `repo-docs/` | Internal reference documentation |
| `tests/` | E2E (Playwright) and security tests |

**Package Manager Split:** Root app scripts and `package-lock.json` use npm. pnpm workspace (`pnpm-workspace.yaml`/`pnpm-lock.yaml`) manages `lib/*` packages. Do not infer root React/Vite/Zod versions from the pnpm catalog.

---

## Architecture

### Frontend (React 18 + Vite)

**Entry Points:**
- [src/main.tsx](file:///c:/Users/moran/emdash/repositories/skypanelv2/src/main.tsx) — mounts the React app
- [src/App.tsx](file:///c:/Users/moran/emdash/repositories/skypanelv2/src/App.tsx) — providers and route tree

**Technology Stack:**

| Technology | Purpose |
|---|---|
| React 18 | Component-based UI framework |
| TypeScript | Type-safe development |
| Vite | Build tool and HMR dev server |
| React Router v7 | Client-side routing with route guards |
| TanStack Query | Server state management with caching & optimistic updates |
| shadcn/ui + Tailwind | Accessible component library |
| React Hook Form + Zod | Form validation |
| Framer Motion | Animations |
| xterm.js | Browser-based SSH terminal |
| Three.js | 3D globe rendering |
| @tiptap | Rich text editor |
| Recharts | Data visualization |

**Routing Guards:**
- `ProtectedRoute` wraps logged-in pages with `AppLayout`
- `AdminRoute` blocks access unless `user.role === "admin"` and user is not impersonating
- `HostingEnabledRoute` gates hosting pages based on `/api/hosting/status`

**State/IO:**
- TanStack Query is the default data-fetching mechanism
- Auth and impersonation are stored in React Context + mix of cookies/sessionStorage

**API Client:**
- [src/lib/api.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/src/lib/api.ts) provides `ApiClient` which automatically includes:
  - `credentials: "include"` (HttpOnly cookie auth)
  - `X-CSRF-Token` from the `csrf_token` cookie
  - `X-Organization-ID` from `sessionStorage`
- `setupAutoLogout()` registers a callback so the client triggers logout + redirect on most 401s

### Backend (Express 4 + TypeScript)

**Entry Points:**
- [api/app.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/app.ts) — Express app configuration (middleware + routes + static serving)
- [api/server.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/server.ts) — starts HTTP server, initializes WebSocket SSH bridge, starts schedulers/listeners

The backend is ESM; internal imports use `.js` extensions even when importing `.ts` sources.

**Technology Stack:**

| Technology | Purpose |
|---|---|
| Express 4 | HTTP framework |
| TypeScript (ESM) | Type-safe backend |
| PostgreSQL | Relational database with UUID PKs, JSONB, triggers |
| JWT (jsonwebtoken) | Stateless authentication |
| bcryptjs | Password hashing |
| ssh2 | SSH protocol client for terminal bridge |
| ws | WebSocket server for SSH bridge |
| express-rate-limit | Tiered rate limiting |
| ioredis + rate-limit-redis | Redis-backed rate limiting |
| Handlebars | Email template rendering |
| nodemailer + Resend | Email delivery with provider fallback |
| multer | File upload handling |
| dompurify | HTML sanitization |

**Request Pipeline:**
```
Incoming Request
  → requireHttps (enforce HTTPS in production)
  → Helmet
  → CORS
  → Body parsers (JSON + URL-encoded)
  → /api hardening: csrfProtection, rate limit headers, smartRateLimit, authenticateApiKey
  → Routes: /api/auth, /api/vps, /api/admin, /api/hosting/*, etc.
  → Static frontend serving (when dist/ exists)
```

When `dist/` exists, Express serves static assets and falls back to `index.html` for non-API requests. Index HTML is rendered with runtime-config script injection (`buildRuntimeHeadMarkup()` and `renderClientIndexHtml()` in [api/app.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/app.ts)).

### Shared Workspace Packages (lib/)

These are pnpm-managed packages for spec/codegen and shared types:

| Package | Contents |
|---|---|
| [lib/api-spec/openapi.yaml](file:///c:/Users/moran/emdash/repositories/skypanelv2/lib/api-spec/openapi.yaml) | OpenAPI source |
| [lib/api-client-react](file:///c:/Users/moran/emdash/repositories/skypanelv2/lib/api-client-react/src/index.ts) | Generated React Query clients (under `src/generated/`, do not edit) |
| [lib/api-zod](file:///c:/Users/moran/emdash/repositories/skypanelv2/lib/api-zod/src/index.ts) | Generated Zod schemas (under `src/generated/`, do not edit) |
| [lib/db](file:///c:/Users/moran/emdash/repositories/skypanelv2/lib/db/src/index.ts) | Drizzle ORM schema package |

Run `pnpm -C lib/api-spec codegen` to regenerate clients from the OpenAPI spec.

### Database & Migrations

**Primary DB access path:** raw `pg` via [api/lib/database.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/lib/database.ts):
- `query(text, params)` — pooled query helper
- `transaction(callback)` — wraps `BEGIN`/`COMMIT`/`ROLLBACK`

**Secondary path:** Drizzle ORM via `@workspace/db` (used for schema definitions).

**Migrations:** [migrations/](file:///c:/Users/moran/emdash/repositories/skypanelv2/migrations) — numbered, immutable SQL files. Apply using `node scripts/run-migration.js`. Migration runner validates SHA256 checksums.

**Schema conventions:**
- UUID PKs (`gen_random_uuid()`)
- `TIMESTAMPTZ` timestamps
- `deleted_at` for soft deletes
- `JSONB DEFAULT '{}'` for config/metadata
- Explicit `ON DELETE CASCADE` or `ON DELETE SET NULL` on all foreign keys

---

## Major Modules

### Frontend Modules (src/)

**Routing + Layout:**
| File | Purpose |
|---|---|
| [src/App.tsx](file:///c:/Users/moran/emdash/repositories/skypanelv2/src/App.tsx) | All routes, auth guards, hosting gates |
| [src/components/AppLayout.tsx](file:///c:/Users/moran/emdash/repositories/skypanelv2/src/components/AppLayout.tsx) | Authenticated shell |
| [src/components/PublicLayout.tsx](file:///c:/Users/moran/emdash/repositories/skypanelv2/src/components/PublicLayout.tsx) | Marketing/docs shell |

**Auth + Impersonation:**
| File | Purpose |
|---|---|
| [src/contexts/AuthContext.tsx](file:///c:/Users/moran/emdash/repositories/skypanelv2/src/contexts/AuthContext.tsx) | Login/register/logout/refresh/profile/2FA/API keys/org switching |
| [src/contexts/ImpersonationContext.tsx](file:///c:/Users/moran/emdash/repositories/skypanelv2/src/contexts/ImpersonationContext.tsx) | Impersonation UX state and session persistence |
| [src/lib/api.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/src/lib/api.ts) | Cookie + CSRF + org header handling |

**Theme:**
| File | Purpose |
|---|---|
| [src/contexts/ThemeContext.tsx](file:///c:/Users/moran/emdash/repositories/skypanelv2/src/contexts/ThemeContext.tsx) | Theme preset application + remote config fetch |
| [src/theme/presets.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/src/theme/presets.ts) | Preset definitions and typing |

**Hosting:**
| File | Purpose |
|---|---|
| [src/hooks/useHosting.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/src/hooks/useHosting.ts) | Query keys and data fetchers for hosting |

**Real-Time:**
| File | Purpose |
|---|---|
| [src/components/NotificationDropdown.tsx](file:///c:/Users/moran/emdash/repositories/skypanelv2/src/components/NotificationDropdown.tsx) | Subscribes to SSE and renders notification UI |

**Frontend Hooks:**
| Hook | Purpose |
|---|---|
| `useHosting.ts` | Hosting subscription data hooks |
| `useNotes.ts` | Personal/org notes CRUD hooks |
| `useEnhanceAdmin.ts` | Enhance admin status hooks |
| `useTheme.ts` | Theme preference hooks |
| `useCategoryMappings.ts` | White-label category mapping hooks |
| `use-mobile.tsx` | Mobile device detection |
| `use-form-persistence.tsx` | Form state persistence across navigation |

### Backend Modules (api/)

**Config:**
| File | Purpose |
|---|---|
| [api/config/index.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/config/index.ts) | Environment parsing, validation, feature toggles. Config is exported as a Proxy — values read dynamically from env. |

**Middleware:**
| File | Purpose |
|---|---|
| [api/middleware/auth.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/middleware/auth.ts) | JWT verification, token blacklist, org resolution, impersonation flags |
| [api/middleware/csrfProtection.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/middleware/csrfProtection.ts) | CSRF token validation |
| [api/middleware/rateLimiting.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/middleware/rateLimiting.ts) | Tiered rate limiting + headers |
| [api/middleware/hosting.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/middleware/hosting.ts) | Hosting feature gating |
| [api/middleware/permissions.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/middleware/permissions.ts) | Organization-based RBAC |

**Routes (api/routes/):**
| Route | File |
|---|---|
| Auth | [routes/auth.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/routes/auth.ts) |
| VPS | [routes/vps/index.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/routes/vps/index.ts) (+ subroutes: backups, disks, firewalls, instances, networking, plans, providers, stackscripts, stats) |
| Hosting | [routes/hosting/store.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/routes/hosting/store.ts) (+ subroutes: apps, backups, cron, dns, email, ftp, joomla, mysql, node, public, ssh, ssl, web, wordpress) |
| Admin | [routes/admin/index.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/routes/admin/index.ts) (+ 20+ subroute handlers) |
| Payments | [routes/payments.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/routes/payments.ts) |
| Organizations | [routes/organizations.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/routes/organizations.ts) |
| Support | [routes/support.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/routes/support.ts) |
| Notifications (SSE) | [routes/notifications.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/routes/notifications.ts) |
| SSH Keys | [routes/sshKeys.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/routes/sshKeys.ts) |
| Notes | [routes/notes.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/routes/notes.ts) |
| API Keys | [routes/apiKeys/](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/routes/apiKeys/index.ts) |

**Services (api/services/):**

| Service | Purpose |
|---|---|
| [authService.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/authService.ts) | JWT token management |
| [billingService.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/billingService.ts) | Hourly billing engine |
| [egressBillingService.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/egressBillingService.ts) | Transfer pool tracking (monthly) |
| [egressCreditService.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/egressCreditService.ts) | Prepaid egress credit management |
| [egressHourlyBillingService.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/egressHourlyBillingService.ts) | Hourly egress billing |
| [hostingBillingService.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/hostingBillingService.ts) | Monthly hosting subscription billing |
| [invoiceService.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/invoiceService.ts) | Invoice generation |
| [paypalService.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/paypalService.ts) | PayPal order/capture/wallet operations |
| [emailService.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/emailService.ts) | Email with provider fallback |
| [notificationService.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/notificationService.ts) | PG LISTEN/NOTIFY → EventEmitter → SSE |
| [activityLogger.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/activityLogger.ts) | Activity log recording |
| [sshBridge.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/sshBridge.ts) | WebSocket SSH terminal bridge |
| [enhanceService.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/enhanceService.ts) | Enhance control panel API wrapper |
| [enhanceOnboardingService.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/enhanceOnboardingService.ts) | Customer org/website provisioning via Enhance |
| [enhanceToggle.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/enhanceToggle.ts) | Feature flag checks for hosting |
| [refundService.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/refundService.ts) | PayPal refund processing |
| [fraudLabsProService.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/fraudLabsProService.ts) | FraudLabsPro transaction screening |
| [roles.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/roles.ts) | Role/permission management |
| [notes.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/notes.ts) | Personal and org notes service |
| [invitations.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/invitations.ts) | Organization invitation logic |
| [themeService.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/themeService.ts) | Theme configuration |
| [tokenBlacklistService.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/tokenBlacklistService.ts) | JWT token blacklist |
| [bunnyCdnService.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/bunnyCdnService.ts) | Bunny CDN edge server IP detection |
| [ticketNotificationService.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/ticketNotificationService.ts) | Support ticket email/real-time notifications |
| [bruteForceProtectionService.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/bruteForceProtectionService.ts) | Brute force lockout |

**Provider Layer (api/services/providers/):**

| File | Purpose |
|---|---|
| [IProviderService.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/providers/IProviderService.ts) | Provider interface contract |
| [BaseProviderService.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/providers/BaseProviderService.ts) | Shared provider logic |
| [LinodeProviderService.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/providers/LinodeProviderService.ts) | Linode-specific implementation |
| [ProviderFactory.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/providers/ProviderFactory.ts) | Provider instantiation (currently only `linode`) |
| [errorNormalizer.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/providers/errorNormalizer.ts) | Provider error normalization |

**Hosting Utility Helpers (api/lib/):**

| File | Purpose |
|---|---|
| [hostingBackups.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/lib/hostingBackups.ts) | Backup management helpers |
| [hostingEnhanceOrg.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/lib/hostingEnhanceOrg.ts) | Enhance org resolution |
| [hostingRouteHelpers.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/lib/hostingRouteHelpers.ts) | Shared route handler utilities |

**Shared Utilities (api/lib/):**

| File | Purpose |
|---|---|
| [database.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/lib/database.ts) | PostgreSQL query/transaction helpers |
| [crypto.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/lib/crypto.ts) | AES-256 encrypt/decrypt |
| [providerTokens.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/lib/providerTokens.ts) | Provider API token resolution and normalization |
| [errorHandling.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/lib/errorHandling.ts) | Error formatting (`handleProviderError`) |
| [validation.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/lib/validation.ts) | Input validation helpers |
| [security.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/lib/security.ts) | Security utilities |
| [ipDetection.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/lib/ipDetection.ts) | Client IP resolution |
| [whiteLabel.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/lib/whiteLabel.ts) | White-label category mapping |
| [activityFilters.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/lib/activityFilters.ts) | Activity log filtering |
| [diagnostics.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/lib/diagnostics.ts) | System diagnostics |
| [fsUtils.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/lib/fsUtils.ts) | File system helpers |

---

## Key Classes & Functions

### Backend

**`authenticateToken`** ([api/middleware/auth.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/middleware/auth.ts)):
Performs token extraction from `Authorization: Bearer …` or `auth_token` cookie, revocation check via `tokenBlacklistService`, JWT verification with `config.JWT_SECRET`. Loads user record and resolves `organizationId` via `resolveOrganizationIdForUser`. Sets `req.user`, `req.auth`, and convenience fields `req.userId`/`req.organizationId`.

**`resolveOrganizationIdForUser`** ([api/middleware/auth.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/middleware/auth.ts)):
Enforces stable org context: prefers `X-Organization-ID` header if membership exists, falls back to `active_organization_id` if valid, otherwise picks first membership or owned org. Optionally auto-creates org for non-admin users when `AUTO_CREATE_ORG` is enabled.

**`BillingService.runHourlyBilling`** ([api/services/billingService.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/billingService.ts#L125-L215)):
Selects VPS instances not billed within the last hour, processes in batches, and bills each with a transaction. Computes elapsed full hours and total hourly charge (base + backup), checks wallet balance, records billing cycles, and deducts via `PayPalService.deductFundsFromWallet`.

**`InvoiceService.generateInvoiceFromBillingCycles`** ([api/services/invoiceService.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/invoiceService.ts#L822-L902)):
Creates itemized invoice line-items (base VPS vs backups). `generateInvoiceFromHostingCycles` generates hosting invoices.

**`HostingBillingService.createInitialPurchaseCharge`** ([api/services/hostingBillingService.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/hostingBillingService.ts)):
Charges local hosting wallet, creates pending subscription + billing cycle for initial hosting purchase.

**`EnhanceOnboardingService.ensureEnhanceCustomerForPurchase`** ([api/services/enhanceOnboardingService.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/enhanceOnboardingService.ts)):
Creates/ensures customer exists in Enhance, creates Enhance subscription and website with plan-specific server group handling.

**`notificationService`** ([api/services/notificationService.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/notificationService.ts)):
Singleton `EventEmitter` that connects a dedicated `pg.Client`, runs `LISTEN new_activity`, parses payload JSON on each notification, emits a local `notification` event, and reconnects with exponential backoff.

**`initSSHBridge`** ([api/services/sshBridge.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/sshBridge.ts)):
Attaches a `ws` WebSocketServer to the existing HTTP server. Authenticates via `auth_token` HttpOnly cookie (with optional `?token=` fallback), verifies JWT, authorizes by `organization_id`. Opens SSH2 shell and forwards `input`/`resize` messages bidirectionally.

**`ProviderFactory.createProvider`** ([api/services/providers/ProviderFactory.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/providers/ProviderFactory.ts)):
Creates provider clients based on `service_providers` record. Currently returns `LinodeProviderService` only. Uses `normalizeProviderToken()` for token normalization.

### Frontend

**`ApiClient`** ([src/lib/api.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/src/lib/api.ts)):
Axios-based client that automatically includes cookies, CSRF token, and org header. Handles 401 logout via `setupAutoLogout()`.

**`AuthProvider`** ([src/contexts/AuthContext.tsx](file:///c:/Users/moran/emdash/repositories/skypanelv2/src/contexts/AuthContext.tsx)):
Manages login/register/logout, hydrates state on mount via `/api/auth/me`, stores `organizationId` in `sessionStorage` as `skypanel_org_id`.

**`ThemeProvider`** ([src/contexts/ThemeContext.tsx](file:///c:/Users/moran/emdash/repositories/skypanelv2/src/contexts/ThemeContext.tsx)):
Manages theme preset selection (stored in localStorage), custom preset support, applies CSS variables by injecting a style tag, and syncs remote theme config from `/api/theme`.

---

## Dependency Relationships

### Runtime Dependencies (root app)

The root app is a single deployable unit (Express server + optional static `dist/`):
- **Frontend core:** React 18, React Router, TanStack Query
- **Backend core:** Express 4, pg, jsonwebtoken, helmet, cors, cookie-parser
- **Realtime:** `ws` for WebSocket, `ssh2` for SSH bridge

### Tooling + Generated Code Dependencies (pnpm workspace)

- `lib/api-spec` holds OpenAPI and Orval config; codegen writes to:
  - `lib/api-client-react/src/generated`
  - `lib/api-zod/src/generated`

### Cross-Module Coupling (Practical Graph)

- **Frontend → Backend:** `src/lib/api.ts` depends on backend's cookie + CSRF model and org header conventions. Route guards in `src/App.tsx` depend on `/api/auth/me` and `/api/hosting/status`.
- **Backend → DB:** Most routes/services call `query()` / `transaction()` from [api/lib/database.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/lib/database.ts). Notifications and tickets rely on Postgres NOTIFY channels.
- **Backend → Providers:** Provider services abstract external APIs (Linode, Enhance) and feed normalized data back into routes.

---

## Configuration & Environment

**Environment file:** Copy `.env.example` to `.env`. Backend loads `.env` in `api/app.ts` unless `IN_DOCKER` is set.

**Required core variables:**
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — JWT signing secret
- `SSH_CRED_SECRET` — SSH credential encryption key
- `ENCRYPTION_KEY` — AES-256 encryption key

Generate secrets:
```bash
node scripts/generate-ssh-secret.js
node scripts/generate-encryption-key.js
```

**Optional variables:**
- `LINODE_API_TOKEN` — Linode/VPS management
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE` — PayPal payments
- `EMAIL_PROVIDER_PRIORITY` — email provider fallback order (`resend,smtp`)
- `ENHANCE_API_URL`, `ENHANCE_API_KEY`, `ENHANCE_MASTER_ORG_ID`, `ENHANCE_DEFAULT_SERVER_GROUP_ID` — Enhance hosting
- `CLIENT_URL` — PayPal return/cancel URLs (must match frontend origin)
- `CORS_ORIGINS` — Comma-separated extra allowed origins for browser API access (see `api/config/index.ts` `parseCorsOrigins`)
- `MAINTENANCE_CODE` — Optional bypass code required for admin login when `maintenance_mode` is enabled (see `api/routes/auth.ts`)

**Config validation:** `api/app.ts` validates config on import and starts metrics/billing cron unless `STARTUP_SIDE_EFFECTS_ENABLED=false` is set.

---

## Key Application Flows

### Authentication & Organization Context

**Backend:**
1. `authenticateToken` in [api/middleware/auth.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/middleware/auth.ts) extracts token from `Authorization: Bearer …` or `auth_token` cookie
2. Checks revocation via `tokenBlacklistService`
3. Verifies JWT with `config.JWT_SECRET`
4. Loads user record and resolves `organizationId` via `resolveOrganizationIdForUser`
5. Sets `req.user`, `req.auth`, `req.userId`, `req.organizationId`

**Frontend:**
1. `AuthProvider` hydrates state on mount via `/api/auth/me`
2. Stores `organizationId` in `sessionStorage` as `skypanel_org_id`
3. `ApiClient` forwards this as `X-Organization-ID` header

### API Key Authentication

- Middleware: [authenticateApiKey](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/routes/apiKeys/middleware.ts) mounted in `app.ts` as `app.use("/api", authenticateApiKey)`
- When valid API key present, middleware sets `req.user` so downstream handlers treat it as authenticated
- `authenticateToken` skips JWT validation when `(req as any).user?.isApiKey` is present

### VPS Provisioning (Provider Abstraction)

Provider interface and implementations live in [api/services/providers](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/providers):
- `IProviderService` — contract for provider implementations
- `ProviderFactory.createProvider` — creates provider clients (currently only `linode`)
- `LinodeProviderService` — Linode-specific implementation
- `normalizeProviderToken()` in [api/lib/providerTokens.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/lib/providerTokens.ts) ensures provider tokens are stored/encrypted consistently

### Billing (Wallet + Hourly VPS + Egress + Hosting)

**Schedulers (server startup in [api/server.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/server.ts)):**
- Initial startup billing (after short delay)
- Every hour via `setInterval` — hourly VPS and egress billing
- Monthly egress finalization runs only on UTC day 1

**Hourly VPS billing** — `BillingService.runHourlyBilling`:
1. Selects instances not billed within last hour
2. Computes elapsed hours and total charge
3. Checks wallet balance
4. Deducts via `PayPalService.deductFundsFromWallet`
5. Records billing cycles and updates `last_billed_at`

**Egress billing:**
- `egressHourlyBillingService.ts` — hourly transfer polling + credit deduction
- `egressBillingService.ts` — monthly finalization

**Hosting subscription billing** — `hostingBillingService.ts`:
- Initial purchase charge via `createInitialPurchaseCharge`
- Monthly renewal billing with invoice creation
- Insufficient balance → suspend via Enhance API

### Notifications (SSE + Postgres LISTEN/NOTIFY)

**Backend:**
1. `notificationService` connects dedicated `pg.Client`
2. Runs `LISTEN new_activity`
3. On each notification, parses JSON and emits local `notification` event
4. SSE endpoint in [routes/notifications.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/routes/notifications.ts) subscribes clients

**Frontend:**
- `NotificationDropdown` subscribes to SSE stream and renders notifications

### SSH Console (WebSocket ↔ SSH2 Bridge)

1. Browser (xterm.js) connects via WebSocket with JWT
2. WS server verifies JWT and membership
3. Fetches VPS instance (IP + encrypted password) scoped to user org
4. Decrypts stored credentials via `decryptSecret`
5. Opens SSH2 shell and forwards `input`/`resize` messages bidirectionally

### Enhance Hosting Purchase

**Route:** `POST /api/hosting/purchase` ([routes/hosting/store.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/routes/hosting/store.ts#L452-L802))

**Flow:**
1. Guardrails: `authenticateToken`, `requireOrganization`, `requireHostingEnabledForUsers`, `requireOrgPermission("hosting_manage")`
2. Charges local hosting wallet, creates pending subscription + billing cycle
3. Creates/ensures customer in Enhance via `enhanceOnboardingService`
4. Creates Enhance subscription and website
5. Persists Enhance ids and primary IP into `hosting_subscriptions`
6. Emails Enhance credentials, creates invoice, logs activity event

**Error handling:** Compensating cleanup (delete Enhance website/subscription), marks local subscription as `error`, credits back hosting wallet where appropriate.

### Theme System (Remote Presets + Local Apply)

**Frontend:**
- `ThemeProvider` manages theme preset selection (localStorage), custom preset support, applies CSS variables via injected style tag, syncs remote config from `/api/theme`

**Backend:**
- Theme routes in [api/routes/theme.ts](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/routes/theme.ts) coordinate preset configuration and admin management

---

## Running the Project

### Prerequisites

- Node `22.22.0` (see `.nvmrc` and `package.json#engines`)
- PostgreSQL database and a `DATABASE_URL`
- npm for root (frontend + backend). pnpm is used for workspace packages under `lib/` (only required when running codegen).

### Environment Setup

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Generate required secrets:
   ```bash
   node scripts/generate-ssh-secret.js
   node scripts/generate-encryption-key.js
   ```

3. Fill out remaining required variables (`DATABASE_URL`, `JWT_SECRET`, `SSH_CRED_SECRET`, `ENCRYPTION_KEY`, `CLIENT_URL`)

### Database Setup

Apply a clean schema (development only; destroys data):
```bash
npm run db:fresh
```

Seed an admin user:
```bash
npm run seed:admin
```

Optional: seed branding content:
```bash
node scripts/seed-branding.js
```

### Development

Run frontend + backend concurrently:
```bash
npm run dev
```

Clean dev start (kills ports first):
```bash
npm run dev-up
```

Run individually:
```bash
npm run client:dev   # Vite dev server at :5173
npm run server:dev   # Express API at :3001 (nodemon → tsx)
```

### Production Build/Run

Build:
```bash
npm run build
```

Run the production server:
```bash
npm run start
```

Express serves `dist/` if it exists. To validate production boot behavior without schedulers/side-effects, set `STARTUP_SIDE_EFFECTS_ENABLED=false`.

### Testing

```bash
npm test              # All tests
npx vitest run        # All tests
npx vitest run path/to/file.test.ts  # Focus one file
npm run test:security  # Security test suite
npm run verify:security  # Full verification: audit + scan + tests
```

### API Docs & Codegen

Sync API docs manifest (runs automatically before dev/build):
```bash
npm run docs:api:sync
```

Audit API docs coverage:
```bash
npm run docs:api:audit
```

Generate clients from OpenAPI spec (pnpm workspace):
```bash
pnpm -C lib/api-spec codegen
```

---

## Testing Strategy

**Test Framework:** Vitest with `globals: true`, `jsdom`, `@` → `src`

**Test Include Globs:**
- `src/**/*.{test,spec}.*` — Frontend component/unit tests
- `tests/security/**/*` — Security isolation tests
- `tests/integration/**/*` — Integration tests
- `api/**/*.test.ts` — Backend route tests

**Excluded from Vitest:** `tests/e2e/**` (Playwright E2E tests)

**Configuration:**
- `testTimeout: 15000`
- `fileParallelism: false` — avoids DB/rate-limiter state interference

**Common targeted command after hosting/API work:**
```bash
npx vitest run api/routes/__tests__/hosting-store.test.ts api/tests/hosting-purchase-saga.test.ts
```

**Backend route tests** use the real `DATABASE_URL` and insert/delete rows directly. Inspect setup/cleanup before adding cases and avoid destructive DB scripts.

---

*Document generated from codebase analysis. For operational scripts and additional reference, see [scripts/README.md](file:///c:/Users/moran/emdash/repositories/skypanelv2/scripts/README.md). For provider architecture details, see [api/services/providers/ARCHITECTURE.md](file:///c:/Users/moran/emdash/repositories/skypanelv2/api/services/providers/ARCHITECTURE.md).*