# Requirements Document

## Introduction

This document specifies the requirements for Production Readiness Plan v2 for SkyPanelV2, an 8-phase initiative to close all deferred security audit items, patch remaining npm CVEs, finish Linode OpenAPI alignment, and ship a gated volumes-billing roadmap. The plan addresses security hardening, dependency safety, architecture cleanups, test infrastructure, and production deployment readiness.

## Glossary

- **SkyPanelV2**: The VPS hosting/billing panel application (React 18 + Vite frontend, Express 4 + PostgreSQL backend, Linode API integration, PayPal billing)
- **Operator**: A human administrator who executes verification commands locally (no CI/CD automation)
- **PM2**: Process manager for Node.js production deployments
- **Linode OpenAPI**: The OpenAPI specification for Linode's API, used to generate TypeScript types
- **SBOM**: Software Bill of Materials, a manifest of all dependencies and their versions
- **Egress Billing**: Prepaid egress credit model with hourly enforcement for VPS network transfer
- **Volumes Billing**: Roadmap feature for additional block storage billing (admin pricing UI ships, user purchase gated off)
- **apiClient**: The shared API client class at `src/lib/api.ts` that handles CSRF tokens, organization headers, and 401 auto-logout
- **requireOrganization**: Middleware that ensures all requests are scoped to a valid organization
- **requireAdmin**: Middleware that ensures the authenticated user has admin role
- **CSRF**: Cross-Site Request Forgery protection mechanism
- **CSP**: Content Security Policy for mitigating XSS and injection attacks

## Hard User Constraints

The following constraints apply to ALL requirements in this document:

1. **No hosted CI of any kind** — No GitHub Actions, Dependabot, Renovate, Socket.dev, or Snyk
2. **No email sending during tests** — `emailService.sendEmail()` must sink in test mode
3. **No VPS creation during tests** — Mock `linodeService` for all destructive provider calls
4. **Never run destructive database commands** — `db:reset`, `db:reset:confirm`, `db:fresh` are prohibited
5. **Primary deployment is PM2** — `npm run pm2:start` is the deployment method
6. **Backend imports must end in `.js`** — ESM module resolution requirement
7. **One in-progress todo item at a time** — Commit in logical chunks, never mega-commits

---

## Phase 1: Security Hardening Requirements

### Requirement 1.1: Payments Router Organization Guard

**User Story:** As a security-conscious operator, I want payment routes to enforce organization membership at the router level, so that all payment operations are properly scoped to organizations.

#### Acceptance Criteria

1. WHEN the payments router is initialized, THE System SHALL apply `requireOrganization` middleware at the router level
2. WHERE a PayPal webhook route exists, THE System SHALL declare it BEFORE the organization guard to allow unauthenticated PayPal callbacks
3. WHEN `requireOrganization` is applied at router level, THE System SHALL remove redundant per-handler `requireOrganization` calls from individual route handlers
4. AFTER router-level guards are applied, THE Security Test Suite SHALL pass with zero failures

---

### Requirement 1.2: Notifications Organization Isolation

**User Story:** As a security-conscious operator, I want notification queries to be organization-scoped, so that users cannot access notifications from other organizations.

#### Acceptance Criteria

1. WHEN any SELECT query executes in `notifications.ts`, THE System SHALL include a `WHERE organization_id = ?` clause or equivalent join condition
2. IF a SELECT query lacks organization scoping, THE System SHALL be documented and fixed
3. WHEN a user attempts to access notifications from another organization, THE System SHALL return HTTP 404 Not Found
4. THE System SHALL include a regression test that seeds two organizations and asserts cross-org notification access returns 404

---

### Requirement 1.3: Payment Isolation Security Test

**User Story:** As a security-conscious operator, I want payment isolation verified by automated tests, so that cross-organization payment access is prevented.

#### Acceptance Criteria

1. THE System SHALL include a test file `tests/security/payment-isolation.test.ts`
2. WHEN the test seeds two organizations with separate users and payment data, THE System SHALL assert that User A's token cannot capture User B's PayPal order
3. WHEN the test seeds two organizations, THE System SHALL assert that User A's token cannot view User B's wallet balance
4. WHEN the test seeds two organizations, THE System SHALL assert that User A's token cannot view User B's invoices
5. THE System SHALL mock the PayPal service via `vi.mock` — no real sandbox calls during tests

---

### Requirement 1.4: CORS Allowlist Audit

**User Story:** As a security-conscious operator, I want CORS configuration audited, so that only authorized origins can make cross-origin requests.

#### Acceptance Criteria

1. WHEN `buildCorsOrigins` executes in production, THE System SHALL never emit `*` as an allowed origin
2. WHEN `NODE_ENV` is not `production`, THE System MAY allow localhost origins for development
3. WHEN an unknown origin makes a request, THE CORS callback SHALL return `false` (not throw an error)
4. THE System SHALL document the CORS audit findings in a security review note

---

### Requirement 1.5: Frontend LocalStorage Auth Token Cleanup

**User Story:** As a security-conscious operator, I want the frontend to stop reading auth tokens from localStorage, so that authentication relies solely on HttpOnly cookies.

#### Acceptance Criteria

1. THE System SHALL remove all `localStorage.auth_token` read operations from frontend code
2. THE System SHALL use `AuthContext` and HttpOnly cookies as the sole source of authentication truth
3. THE System SHALL use `apiClient` for all authenticated API calls (which uses `credentials: "include"`)

---

## Phase 2: Linode OpenAPI Alignment Requirements

### Requirement 2.1: Endpoint Coverage Matrix

**User Story:** As a developer, I want a documented mapping between frontend actions and Linode API endpoints, so that I can identify coverage gaps and dead code.

#### Acceptance Criteria

1. THE System SHALL produce a coverage matrix document at `docs/linode-coverage-matrix.md`
2. THE coverage matrix SHALL map: VPSDetail action → `/api/vps/*` route → linodeService method → Linode OpenAPI path → status
3. THE System SHALL inventory all frontend `apiClient` calls in `VPSDetail.tsx`
4. THE System SHALL inventory all backend handlers in `api/routes/vps.ts`
5. THE System SHALL flag dead frontend calls, dead backend routes, and OpenAPI drift

---

### Requirement 2.2: Generated TypeScript Types Integration

**User Story:** As a developer, I want the generated Linode OpenAPI types to replace hand-written interfaces, so that type definitions stay synchronized with the Linode API.

#### Acceptance Criteria

1. THE System SHALL import generated types from `api/types/linode-openapi.ts` into `linodeService.ts`
2. THE System SHALL replace hand-written interfaces with generated types: `LinodeInstance`, `LinodeInstanceBackupsResponse`, `LinodeInstanceStatsResponse`, `LinodeBackupSummary`, `LinodeMetricTuple`, `LinodeIPv6Pool`, `LinodeIPv6Range`, `LinodeVLAN`, `LinodeListIPsResponse`, `LinodeIPAddress`, `LinodeAllocateIPRequest`, `LinodeAssignIPsRequest`, `LinodeShareIPsRequest`, `LinodeCreateIPv6RangeRequest`
3. THE System SHALL document the operator procedure for re-running `npm run linode:types:sync` monthly or after visible Linode API changes

---

### Requirement 2.3: Disk Management Tests

**User Story:** As a developer, I want disk management routes to have comprehensive tests, so that disk operations are verified to work correctly.

#### Acceptance Criteria

1. THE System SHALL include `tests/security/disks-isolation.test.ts` for organization isolation tests
2. THE System SHALL include `api/routes/__tests__/vps-disks.test.ts` for route handler tests
3. THE System SHALL include a React Testing Library test for the `VPSDisksTab` component
4. ALL disk-related tests SHALL mock Linode API calls — no real VPS operations during tests

---

### Requirement 2.4: VPS Route Error Handling Audit

**User Story:** As a developer, I want all VPS routes to handle Linode API errors consistently, so that users receive meaningful error messages.

#### Acceptance Criteria

1. WHEN any `/api/vps/*` route receives a Linode error, THE System SHALL use `handleProviderError()` to normalize the error response
2. THE System SHALL pass pagination parameters through to Linode API calls where applicable
3. THE System SHALL surface rate-limit information from Linode API responses
4. THE System SHALL pre-validate field limits before sending requests to Linode API

---

### Requirement 2.5: Feature Parity Documentation

**User Story:** As a product owner, I want documented feature parity status, so that I can plan future development.

#### Acceptance Criteria

1. THE System SHALL produce `docs/linode-feature-roadmap.md`
2. THE document SHALL list: this release features (disks), backlog features (Placement Groups, VPC interfaces, Metadata Service, dedicated/GPU plan badges), and out-of-scope features (LKE, NodeBalancers, Object Storage, Databases)

---

## Phase 3: npm Safety Strategy Requirements

### Requirement 3.1: Dependency Version Pinning

**User Story:** As a security-conscious operator, I want all dependency versions pinned, so that builds are reproducible and supply chain attacks are mitigated.

#### Acceptance Criteria

1. THE System SHALL remove all `^` version prefixes from `package.json`
2. THE System SHALL rebuild `package-lock.json` with exact versions
3. THE System SHALL document that operators must use `npm ci --ignore-scripts` on deploy hosts
4. THE `npm run audit:security` command SHALL exit 0 (zero high+ severity vulnerabilities)

---

### Requirement 3.2: Unused Dependency Removal

**User Story:** As a developer, I want unused dependencies removed, so that the attack surface and bundle size are reduced.

#### Acceptance Criteria

1. THE System SHALL run `npx depcheck` and evaluate each flagged package
2. IF `crypto-js` is unused (superseded by `api/lib/crypto.ts`), THE System SHALL remove it
3. THE System SHALL consolidate map libraries (`react-simple-maps`, `react-leaflet`, `leaflet`, `react-leaflet-cluster`) to one library
4. IF `vite-plugin-trae-solo-badge` is unused, THE System SHALL remove it
5. THE System SHALL document the decision for each evaluated package

---

### Requirement 3.3: Manual Dependency Review Cadence

**User Story:** As a security-conscious operator, I want a documented manual dependency review process, so that vulnerabilities are caught without CI automation.

#### Acceptance Criteria

1. THE System SHALL document a weekly operator task in `SECURITY.md`: run `npm outdated`, `npm audit`, produce manual PR for high-severity advisories
2. THE System SHALL create `docs/dependency-review.md` with a review checklist
3. THE System SHALL NOT use Dependabot, Renovate, or any hosted dependency automation service

---

### Requirement 3.4: Software Bill of Materials

**User Story:** As a security-conscious operator, I want an SBOM generated at release time, so that I have a complete inventory of dependencies.

#### Acceptance Criteria

1. THE System SHALL document the operator procedure: run `npx @cyclonedx/cyclonedx-npm --output-file sbom.json` at release time
2. THE System SHALL attach the SBOM to release notes
3. THE SBOM procedure SHALL be documented in `SECURITY.md`

---

## Phase 4: Architecture Cleanups Requirements

### Requirement 4.1: Duplicate Notification System Consolidation

**User Story:** As a developer, I want a single notification system, so that code is maintainable and behavior is consistent.

#### Acceptance Criteria

1. THE System SHALL map consumers of `/api/activity`, `/api/notifications`, and `/api/activities`
2. THE System SHALL identify the redundant endpoint(s) and document the deprecation plan
3. THE System SHALL migrate consumers to the canonical notification endpoint
4. THE System SHALL remove deprecated notification routes after migration

---

### Requirement 4.2: VPS Route Monolith Split

**User Story:** As a developer, I want the VPS route file split into focused modules, so that the codebase is maintainable.

#### Acceptance Criteria

1. THE System SHALL split `api/routes/vps.ts` (5035+ lines) into sub-modules: `index.ts`, `providers.ts`, `plans.ts`, `instances.ts`, `backups.ts`, `disks.ts`, `networking.ts`, `firewalls.ts`, `stats.ts`, `stackscripts.ts`
2. THE System SHALL preserve all existing behavior during the split
3. THE System SHALL apply `router.use(authenticateToken, requireOrganization)` at the top of each sub-router
4. THE `admin-auth-coverage.test.ts` pattern SHALL be adapted to verify all VPS sub-routers have proper guards

---

### Requirement 4.3: Admin Route Monolith Split

**User Story:** As a developer, I want the admin route file split into focused modules, so that the codebase is maintainable.

#### Acceptance Criteria

1. THE System SHALL split `api/routes/admin.ts` (~5800 lines) into sub-modules: `users.ts`, `settings.ts`, `billing.ts`, `email-templates.ts`, `contact.ts`, `faq.ts`, `github.ts`, `ssh-keys.ts`, `activity.ts`, `documentation.ts`, `networking.ts`, `announcements.ts`, `category-mappings.ts`
2. THE System SHALL preserve all existing behavior during the split
3. THE System SHALL apply `router.use(authenticateToken, requireAdmin)` at the top of each sub-router
4. THE two intentional exceptions (impersonation exit, ticket stream) SHALL be on a separate sub-router mounted before the main guard

---

### Requirement 4.4: VPSDetail Component Split

**User Story:** As a developer, I want the VPSDetail page split into focused components, so that the codebase is maintainable.

#### Acceptance Criteria

1. THE System SHALL split `src/pages/VPSDetail.tsx` into tab components: `OverviewTab.tsx`, `NetworkingTab.tsx`, `BackupsTab.tsx`, `DisksTab.tsx` (already done), `FirewallTab.tsx`, `ActivityTab.tsx`, `SettingsTab.tsx`
2. THE System SHALL extract shared logic into `hooks/useVPSDetail.ts`
3. THE System SHALL extract shared types into `types.ts`
4. THE System SHALL preserve all existing behavior during the split

---

### Requirement 4.5: Admin Component Split

**User Story:** As a developer, I want the Admin page split into focused components, so that the codebase is maintainable.

#### Acceptance Criteria

1. THE System SHALL split `src/pages/Admin.tsx` to mirror the `admin.ts` route split
2. THE System SHALL preserve all existing behavior during the split

---

### Requirement 4.6: Raw Fetch to ApiClient Migration

**User Story:** As a developer, I want all frontend API calls to use `apiClient`, so that CSRF protection and auth handling are consistent.

#### Acceptance Criteria

1. THE System SHALL migrate all raw `fetch` calls in `src/` to use `apiClient`
2. THE migration priority order SHALL be: Payment pages (Billing, Wallet, Checkout) first, Admin pages second, all other pages third
3. THE System SHALL verify CSRF handling works correctly after migration
4. THE System SHALL have zero raw `fetch` calls remaining in `src/` after migration

---

### Requirement 4.7: Home Page Consolidation

**User Story:** As a developer, I want a single home page, so that there is no confusion about which version is active.

#### Acceptance Criteria

1. THE System SHALL evaluate `Home.tsx` vs `HomeRedesign.tsx` and select one as canonical
2. THE System SHALL delete the non-canonical version
3. THE System SHALL update `src/App.tsx` route to use the canonical version

---

### Requirement 4.8: Type Drift Consolidation

**User Story:** As a developer, I want shared request/response types, so that frontend and backend stay in sync.

#### Acceptance Criteria

1. THE System SHALL consolidate request/response DTOs from frontend `types/*.ts` and backend
2. THE System SHALL use generated OpenAPI types from Phase 2.2 where applicable
3. THE System SHALL create `src/types/api.ts` for types shared by frontend and backend

---

### Requirement 4.9: Documentation Consolidation

**User Story:** As a developer, I want `AGENTS.md` as the canonical agent instruction file, so that AI assistants have a single source of truth.

#### Acceptance Criteria

1. THE System SHALL make `AGENTS.md` the canonical instruction file
2. THE System SHALL reduce `CLAUDE.md`, `GEMINI.md`, and `README.md` to pointers to `AGENTS.md`

---

## Phase 5: Test Infrastructure Requirements

### Requirement 5.1: Route-Level Test Coverage

**User Story:** As a developer, I want comprehensive route-level tests, so that API behavior is verified.

#### Acceptance Criteria

1. THE System SHALL create test helpers in `api/tests/helpers/`: `buildAuthedRequest`, `mockLinode`, `mockEmail`, `mockPayPal`, `seedDatabase`
2. THE System SHALL have happy-path, authorization, and validation-failure tests for every route
3. THE test priorities SHALL be: payments, VPS lifecycle, disks, admin user CRUD, billing/egress
4. THE coverage target SHALL be 70% lines / 80% branches on `api/routes/` + `api/services/`

---

### Requirement 5.2: Playwright E2E Smoke Tests

**User Story:** As a developer, I want E2E smoke tests, so that critical user flows work correctly.

#### Acceptance Criteria

1. THE System SHALL create Playwright E2E tests in `tests/e2e/`
2. THE smoke flows SHALL include: unauthenticated home→login→dashboard, register+verify (mocked), VPS list→detail→boot/shutdown (mocked), billing top-up (sandbox)
3. THE `playwright.config.ts` SHALL set `MOCK_PROVIDERS=true`
4. THE System SHALL NOT send real emails or create real VPS instances during E2E tests

---

### Requirement 5.3: Test Organization

**User Story:** As a developer, I want tests organized by type, so that they are easy to find and run.

#### Acceptance Criteria

1. THE System SHALL colocate unit/integration tests as `*.test.ts` files
2. THE System SHALL place security tests in `tests/security/`
3. THE System SHALL place E2E tests in `tests/e2e/`
4. THE System SHALL place test fixtures in `tests/fixtures/`

---

### Requirement 5.4: Coverage Tracking

**User Story:** As a developer, I want coverage tracked locally, so that test quality is verified before release.

#### Acceptance Criteria

1. THE operator SHALL run `npm run test:coverage` locally before release
2. THE coverage summary SHALL be committed to `docs/coverage-baseline.md` for PR diff visibility
3. THE System SHALL NOT use CI for coverage enforcement (operator-run only)

---

## Phase 6: Volumes Billing Roadmap Requirements

### Requirement 6.1: Volume Pricing Schema

**User Story:** As a product owner, I want volume pricing stored in the database, so that admins can configure per-GB pricing per region.

#### Acceptance Criteria

1. THE System SHALL create migration `NNN_volume_pricing.sql` with `volume_pricing` table
2. THE `volume_pricing` table SHALL have columns: `id`, `provider_id`, `region_id`, `price_per_gb_monthly`, `markup_per_gb_monthly`, `min_size_gb`, `max_size_gb`, `active`, `created_at`, `updated_at`
3. THE System SHALL create `organization_volumes` table with columns: `id`, `organization_id`, `vps_instance_id`, `provider_volume_id`, `label`, `size_gb`, `region_id`, `monthly_cost`, `status`, `created_at`, `deleted_at`
4. THE `volume_pricing` table SHALL have a unique constraint on `(provider_id, region_id)`

---

### Requirement 6.2: Admin Volume Pricing UI

**User Story:** As an admin, I want to configure volume pricing per provider and region, so that customers are charged correctly.

#### Acceptance Criteria

1. THE System SHALL create `src/pages/admin/VolumePricing.tsx` with CRUD table for (provider × region) pricing
2. THE System SHALL create `api/routes/admin/volumePricing.ts` with admin-only CRUD endpoints
3. THE admin volume pricing routes SHALL be guarded by `requireAdmin` middleware

---

### Requirement 6.3: Linode Volumes API Service

**User Story:** As a developer, I want Linode Volumes API methods in linodeService, so that volume operations are available.

#### Acceptance Criteria

1. THE System SHALL add Linode Volumes API methods to `linodeService.ts`: list, create, detail, update, delete, attach, detach, clone, resize
2. THE System SHALL create `api/routes/volumes.ts` with admin-only volume CRUD routes during roadmap phase
3. ALL volume API calls in tests SHALL be mocked — no real volume creation during tests

---

### Requirement 6.4: User Volume Purchase Flow Design

**User Story:** As a product owner, I want the user volume purchase flow designed but disabled, so that it is ready for future enablement.

#### Acceptance Criteria

1. THE System SHALL create `docs/volumes-user-flow.md` documenting: Disks tab "Attach additional storage" CTA (disabled with "Coming soon" tooltip), size picker, monthly cost preview, wallet top-up flow, volume creation, hourly billing cron extension, detach/delete + refund policy
2. THE user purchase flow SHALL be gated by a feature flag set to OFF
3. THE System SHALL NOT enable user volume purchases in this release

---

### Requirement 6.5: Volume Isolation Tests

**User Story:** As a developer, I want volume isolation verified by tests, so that cross-organization volume access is prevented.

#### Acceptance Criteria

1. THE System SHALL create `tests/security/volume-isolation.test.ts`
2. THE System SHALL create `api/routes/__tests__/admin-volume-pricing.test.ts`
3. ALL Linode Volumes API calls in tests SHALL be mocked

---

## Phase 7: Production Readiness Checklist Requirements

### Requirement 7.1: Environment Configuration Verification

**User Story:** As an operator, I want environment configuration verified, so that production is properly configured.

#### Acceptance Criteria

1. THE System SHALL document verification that all required environment variables are set in production
2. THE `JWT_SECRET` SHALL be at least 64 characters
3. THE `SSH_CRED_SECRET` SHALL be at least 32 characters (generated via `scripts/generate-ssh-secret.js`)
4. THE `ENCRYPTION_KEY` SHALL be at least 32 characters (generated via `scripts/generate-encryption-key.js`)
5. THE `NODE_ENV` SHALL be set to `production`
6. THE `TRUST_PROXY` SHALL be set to `true` if behind a load balancer
7. THE `CLIENT_URL` SHALL be set to the exact production domain

---

### Requirement 7.2: Infrastructure Verification

**User Story:** As an operator, I want infrastructure verified, so that production is reliable.

#### Acceptance Criteria

1. THE System SHALL document PostgreSQL daily backups + WAL archive configuration
2. THE System SHALL document Redis persistence configuration for rate limits and token blacklist
3. THE System SHALL document PM2 `ecosystem.config.cjs` review
4. THE System SHALL document NGINX/Cloudflare CSP, HSTS, X-Frame-Options configuration
5. THE System SHALL document TLS auto-renewal configuration
6. THE System SHALL document monitoring alerts for 5xx errors, slow queries, and error rate

---

### Requirement 7.3: Data Migration Verification

**User Story:** As an operator, I want data migrations verified, so that the database schema is current.

#### Acceptance Criteria

1. THE System SHALL verify egress migrations 025-033 are applied
2. THE System SHALL verify new migrations (volume pricing, Phase 1 tables) are applied in order
3. THE System SHALL document `npm run seed:admin` execution with strong password (then rotated)
4. THE System SHALL verify `npm run docs:api:audit` is clean

---

### Requirement 7.4: Pre-Release Verification Commands

**User Story:** As an operator, I want pre-release verification commands, so that I can verify production readiness.

#### Acceptance Criteria

1. THE `npm run check` command SHALL pass with zero TypeScript errors
2. THE `npm run lint` command SHALL pass with zero errors
3. THE `npm run test` full suite SHALL pass
4. THE `npm run test:coverage` SHALL achieve at least 70% line coverage
5. THE `npm run audit:security` SHALL exit 0 (zero high+ vulnerabilities)
6. THE `npm run scan:code` (semgrep) SHALL pass with zero errors
7. THE `npm run test:security` SHALL pass
8. THE Playwright smoke tests SHALL pass
9. THE operator SHALL perform manual staging smoke: signup → VPS list → VPS detail (all tabs including Disks) → billing → logout
10. THE `npm run verify:prod` script SHALL bundle all verification commands

---

### Requirement 7.5: Rollout Preparation

**User Story:** As an operator, I want rollout preparation documented, so that deployment is safe and reversible.

#### Acceptance Criteria

1. THE System SHALL document blue-green or rolling deploy capability
2. THE System SHALL document migration rollback plan
3. THE System SHALL document feature flags: volumes user purchase (off), notification system changes
4. THE System SHALL document status-page entry for deploy window
5. THE System SHALL verify rollback tested on staging

---

## Exit Criteria

### Requirement E.1: Production Readiness Exit

**User Story:** As an operator, I want clear exit criteria, so that I know when production deployment is ready.

#### Acceptance Criteria

1. ALL phases 1-7 requirements SHALL be complete
2. THE `npm run verify:prod` command SHALL pass
3. THE staging environment SHALL mirror production configuration
4. THE runbook SHALL be current and accurate
5. THE System SHALL be ready for production deployment
