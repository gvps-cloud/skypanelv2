# Implementation Plan: Production Readiness Plan v2

## Overview

This implementation plan breaks down the Production Readiness Plan v2 into actionable coding tasks. The plan follows the priority order: Security → npm Safety → OpenAPI → Architecture → Tests → Volumes → Production Checklist.

**Current State (as of commit e009b19):**
- Phase 0 (CVE Emergency): ✅ DONE
- Phase 1 (Security Hardening): ⏳ ~80% complete
- Phases 2-7: Not started or partial

**Hard User Constraints:**
1. No hosted CI of any kind
2. No email sending during tests
3. No VPS creation during tests
4. Never run destructive database commands
5. Primary deployment is PM2
6. Backend imports must end in `.js` (ESM)
7. One in-progress todo item at a time

---

## Phase 1: Security Hardening

- [x] 1. Add `requireOrganization` middleware at router level in payments router
  - [-] 1.1 Move `requireOrganization` to router level in `api/routes/payments.ts`
    - Apply `router.use(requireOrganization)` after `authenticateToken`
    - Remove redundant per-handler `requireOrganization` calls
    - Ensure PayPal webhook route (if added) is declared BEFORE the org guard
    - _Requirements: 1.1_
  
  - [x] 1.2 Write security test for payments router organization guard
    - Test that all payment routes require organization membership
    - Test that unauthenticated routes (webhooks) are excluded
    - _Requirements: 1.1_

- [x] 2. Add organization scoping to notifications routes
  - [x] 2.1 Add `organization_id` to all SELECT queries in `api/routes/notifications.ts`
    - Update `GET /unread-count` to include `WHERE organization_id = $2`
    - Update `GET /unread` to include organization scoping
    - Update `GET /` to include organization scoping
    - Update `PATCH /:id/read` to verify org ownership before marking read
    - _Requirements: 1.2_
  
  - [x] 2.2 Write regression test for cross-org notification access
    - Seed two organizations with separate users
    - Assert cross-org notification access returns 404
    - _Requirements: 1.2_

- [~] 3. Create payment isolation security test
  - [x] 3.1 Create `tests/security/payment-isolation.test.ts`
    - Seed two organizations with separate users and payment data
    - Assert User A's token cannot capture User B's PayPal order
    - Assert User A's token cannot view User B's wallet balance
    - Assert User A's token cannot view User B's invoices
    - Mock PayPal service via `vi.mock` — no real sandbox calls
    - _Requirements: 1.3_

- [~] 4. Audit and document CORS configuration
  - [x] 4.1 Review `buildCorsOrigins` in `api/config/index.ts`
    - Verify production never emits `*` as allowed origin
    - Verify unknown origins return `false` (not throw)
    - _Requirements: 1.4_
  
  - [x] 4.2 Document CORS audit findings in `SECURITY.md`
    - Document that `CLIENT_URL` must be set to exact production domain
    - Document localhost origins allowed in development only
    - _Requirements: 1.4_

- [~] 5. Remove localStorage auth token reads from frontend
  - [x] 5.1 Search for and remove `localStorage.auth_token` reads in `src/`
    - Search codebase for `localStorage.auth_token` or `localStorage.getItem('auth_token')`
    - Remove any found instances
    - Verify `AuthContext` uses HttpOnly cookie only
    - Verify `apiClient` uses `credentials: "include"` for all requests
    - _Requirements: 1.5_

- [x] 6. Checkpoint - Verify Phase 1 security hardening
  - Run `npm run test:security` — all security tests pass
  - Run `npm run check` — zero TypeScript errors
  - Ask the user if questions arise.

---

## Phase 3: npm Safety Strategy

- [~] 7. Pin all dependency versions in `package.json`
  - [x] 7.1 Remove all `^` version prefixes from `package.json`
    - Update all dependencies to exact versions (e.g., `"express": "4.21.2"`)
    - Update all devDependencies to exact versions
    - _Requirements: 3.1_
  
  - [x] 7.2 Rebuild `package-lock.json` with exact versions
    - Delete existing `package-lock.json`
    - Run `npm install` to regenerate with exact versions
    - _Requirements: 3.1_
  
  - [x] 7.3 Verify `npm run audit:security` exits 0
    - Run `npm run audit:security`
    - Fix any high+ severity vulnerabilities
    - _Requirements: 3.1_
  
  - [x] 7.4 Document deployment procedure in `SECURITY.md`
    - Document that operators must use `npm ci --ignore-scripts` on deploy hosts
    - _Requirements: 3.1_

- [~] 8. Remove unused dependencies
  - [x] 8.1 Run `npx depcheck` and evaluate each flagged package
    - Document decision for each evaluated package
    - _Requirements: 3.2_
  
  - [x] 8.2 Remove `crypto-js` if unused (superseded by `api/lib/crypto.ts`)
    - Verify no imports of `crypto-js` in codebase
    - Remove from `package.json` if unused
    - _Requirements: 3.2_
  
  - [x] 8.3 Consolidate map libraries to one
    - Evaluate `react-simple-maps`, `react-leaflet`, `leaflet`, `react-leaflet-cluster`
    - Choose one library and remove others
    - Update any affected components
    - _Requirements: 3.2_
  
  - [x] 8.4 Remove `vite-plugin-trae-solo-badge` if unused
    - Verify no usage in `vite.config.ts` or elsewhere
    - Remove from `package.json` if unused
    - _Requirements: 3.2_

- [~] 9. Create manual dependency review documentation
  - [x] 9.1 Create `docs/dependency-review.md` with review checklist
    - Weekly operator task: run `npm outdated`, `npm audit`
    - Manual PR process for high-severity advisories
    - Prohibited automation: No Dependabot, Renovate, or hosted services
    - _Requirements: 3.3_
  
  - [x] 9.2 Add weekly dependency review task to `SECURITY.md`
    - Document the weekly operator task
    - _Requirements: 3.3_

- [~] 10. Document SBOM generation procedure
  - [x] 10.1 Add SBOM procedure to `SECURITY.md`
    - Document: run `npx @cyclonedx/cyclonedx-npm --output-file sbom.json` at release time
    - Document: attach SBOM to release notes
    - _Requirements: 3.4_

- [x] 11. Checkpoint - Verify Phase 3 npm safety
  - Run `npm run audit:security` — exits 0
  - Run `npm run build` — succeeds with pinned versions
  - Ask the user if questions arise.

---

## Phase 2: Linode OpenAPI Alignment

- [~] 12. Create Linode API endpoint coverage matrix
  - [~] 12.1 Create `docs/linode-coverage-matrix.md`
    - Map VPSDetail actions → `/api/vps/*` routes → linodeService methods → Linode OpenAPI paths
    - Inventory all frontend `apiClient` calls in `VPSDetail.tsx`
    - Inventory all backend handlers in `api/routes/vps.ts`
    - Flag dead frontend calls, dead backend routes, and OpenAPI drift
    - _Requirements: 2.1_

- [~] 13. Integrate generated TypeScript types from Linode OpenAPI
  - [~] 13.1 Import generated types in `api/services/linodeService.ts`
    - Import `components['schemas']` from `api/types/linode-openapi.ts`
    - Replace hand-written interfaces: `LinodeInstance`, `LinodeType`, `LinodeRegion`, `LinodeImage`, `LinodeBackup`, `LinodeDisk`, `LinodeIP`, `LinodeVolume`
    - _Requirements: 2.2_
  
  - [~] 13.2 Document operator procedure for re-running type generation
    - Add to `SECURITY.md`: run `npm run linode:types:sync` monthly or after Linode API changes
    - _Requirements: 2.2_

- [~] 14. Create disk management tests
  - [~] 14.1 Create `tests/security/disks-isolation.test.ts`
    - Test organization isolation for disk operations
    - Mock all Linode API calls
    - _Requirements: 2.3_
  
  - [~] 14.2 Create `api/routes/__tests__/vps-disks.test.ts`
    - Test route handlers for disk CRUD operations
    - Mock Linode API calls
    - _Requirements: 2.3_
  
  - [~] 14.3 Create React Testing Library test for `VPSDisksTab` component
    - Test component rendering and interactions
    - _Requirements: 2.3_

- [~] 15. Audit VPS route error handling
  - [~] 15.1 Verify all `/api/vps/*` routes use `handleProviderError()`
    - Audit each route handler for consistent error handling
    - Update any routes not using `handleProviderError()`
    - _Requirements: 2.4_
  
  - [~] 15.2 Verify pagination parameters passed through to Linode API
    - Check that pagination params are forwarded where applicable
    - _Requirements: 2.4_
  
  - [~] 15.3 Verify rate-limit headers surfaced from Linode responses
    - Check that rate-limit info is logged or surfaced
    - _Requirements: 2.4_
  
  - [~] 15.4 Verify field limits pre-validated before Linode API calls
    - Check that field lengths are validated before sending to Linode
    - _Requirements: 2.4_

- [~] 16. Create feature parity documentation
  - [~] 16.1 Create `docs/linode-feature-roadmap.md`
    - List this release features (disks)
    - List backlog features (Placement Groups, VPC interfaces, Metadata Service, dedicated/GPU plan badges)
    - List out-of-scope features (LKE, NodeBalancers, Object Storage, Databases)
    - _Requirements: 2.5_

- [~] 17. Checkpoint - Verify Phase 2 OpenAPI alignment
  - Run `npm run check` — zero TypeScript errors with generated types
  - Run `npm run test` — all disk tests pass
  - Ask the user if questions arise.

---

## Phase 4: Architecture Cleanups

- [~] 18. Consolidate duplicate notification systems
  - [~] 18.1 Map consumers of `/api/activity`, `/api/notifications`, and `/api/activities`
    - Search frontend for API calls to each endpoint
    - Document which components consume which endpoints
    - _Requirements: 4.1_
  
  - [~] 18.2 Document deprecation plan for redundant endpoints
    - Identify canonical endpoint (recommend: `/api/notifications`)
    - Document migration plan for consumers
    - _Requirements: 4.1_
  
  - [~] 18.3 Migrate consumers to canonical notification endpoint
    - Update frontend components to use canonical endpoint
    - _Requirements: 4.1_
  
  - [~] 18.4 Remove deprecated notification routes
    - Remove deprecated routes after migration complete
    - _Requirements: 4.1_

- [~] 19. Split VPS route monolith into focused modules
  - [~] 19.1 Create `api/routes/vps/` directory structure
    - Create directory for VPS sub-modules
    - _Requirements: 4.2_
  
  - [~] 19.2 Create `api/routes/vps/providers.ts`
    - Move provider-related routes: GET /providers, /providers/:id, /regions, /types
    - Apply `router.use(authenticateToken, requireOrganization)` at top
    - _Requirements: 4.2_
  
  - [~] 19.3 Create `api/routes/vps/plans.ts`
    - Move plan-related routes: GET /plans
    - Apply router-level guards
    - _Requirements: 4.2_
  
  - [~] 19.4 Create `api/routes/vps/instances.ts`
    - Move instance CRUD and lifecycle routes: boot, shutdown, reboot, rebuild
    - Apply router-level guards
    - _Requirements: 4.2_
  
  - [~] 19.5 Create `api/routes/vps/backups.ts`
    - Move backup-related routes
    - Apply router-level guards
    - _Requirements: 4.2_
  
  - [~] 19.6 Create `api/routes/vps/disks.ts`
    - Move disk CRUD routes
    - Apply router-level guards
    - _Requirements: 4.2_
  
  - [~] 19.7 Create `api/routes/vps/networking.ts`
    - Move IP and VLAN routes
    - Apply router-level guards
    - _Requirements: 4.2_
  
  - [~] 19.8 Create `api/routes/vps/firewalls.ts`
    - Move firewall routes
    - Apply router-level guards
    - _Requirements: 4.2_
  
  - [~] 19.9 Create `api/routes/vps/stats.ts`
    - Move stats and metrics routes
    - Apply router-level guards
    - _Requirements: 4.2_
  
  - [~] 19.10 Create `api/routes/vps/stackscripts.ts`
    - Move StackScript routes
    - Apply router-level guards
    - _Requirements: 4.2_
  
  - [~] 19.11 Create `api/routes/vps/index.ts` aggregator
    - Import and mount all sub-routers
    - Export combined router
    - _Requirements: 4.2_
  
  - [~] 19.12 Update `api/app.ts` to import from new VPS router location
    - Update import path to `api/routes/vps/index.js`
    - _Requirements: 4.2_
  
  - [~] 19.13 Adapt `admin-auth-coverage.test.ts` pattern for VPS sub-routers
    - Verify all VPS sub-routers have proper guards
    - _Requirements: 4.2_

- [~] 20. Split admin route monolith into focused modules
  - [~] 20.1 Create `api/routes/admin/` directory structure (if not exists)
    - _Requirements: 4.3_
  
  - [~] 20.2 Create `api/routes/admin/users.ts`
    - Move user CRUD and impersonation routes
    - Apply `router.use(authenticateToken, requireAdmin)` at top
    - Exception: impersonation exit route mounted before guard
    - _Requirements: 4.3_
  
  - [~] 20.3 Create `api/routes/admin/settings.ts`
    - Move platform settings routes
    - Apply router-level admin guard
    - _Requirements: 4.3_
  
  - [~] 20.4 Create `api/routes/admin/index.ts` aggregator
    - Mount exception routes BEFORE admin guard
    - Mount all sub-routers after guard
    - _Requirements: 4.3_
  
  - [~] 20.5 Update `api/app.ts` to import from new admin router location
    - Update import path
    - _Requirements: 4.3_

- [~] 21. Split VPSDetail component into focused tab components
  - [~] 21.1 Create `src/pages/VPSDetail/` directory structure
    - _Requirements: 4.4_
  
  - [~] 21.2 Create `src/pages/VPSDetail/OverviewTab.tsx`
    - Extract overview tab component
    - _Requirements: 4.4_
  
  - [~] 21.3 Create `src/pages/VPSDetail/NetworkingTab.tsx`
    - Extract networking tab component
    - _Requirements: 4.4_
  
  - [~] 21.4 Create `src/pages/VPSDetail/BackupsTab.tsx`
    - Extract backups tab component
    - _Requirements: 4.4_
  
  - [~] 21.5 Create `src/pages/VPSDetail/FirewallTab.tsx`
    - Extract firewall tab component
    - _Requirements: 4.4_
  
  - [~] 21.6 Create `src/pages/VPSDetail/ActivityTab.tsx`
    - Extract activity tab component
    - _Requirements: 4.4_
  
  - [~] 21.7 Create `src/pages/VPSDetail/SettingsTab.tsx`
    - Extract settings tab component
    - _Requirements: 4.4_
  
  - [~] 21.8 Create `src/pages/VPSDetail/hooks/useVPSDetail.ts`
    - Extract shared data fetching logic
    - _Requirements: 4.4_
  
  - [~] 21.9 Create `src/pages/VPSDetail/types.ts`
    - Extract shared types
    - _Requirements: 4.4_
  
  - [~] 21.10 Create `src/pages/VPSDetail/index.tsx` main component
    - Import tab components
    - Set up tab routing
    - _Requirements: 4.4_

- [~] 22. Split Admin component into focused tab components
  - [ ] 22.1 Create `src/pages/Admin/` directory structure
    - _Requirements: 4.5_
  
  - [~] 22.2 Create tab components mirroring admin route split
    - UsersTab, SettingsTab, BillingTab, EmailTemplatesTab, etc.
    - _Requirements: 4.5_
  
  - [~] 22.3 Create `src/pages/Admin/index.tsx` main component
    - Import tab components
    - Set up tab routing
    - _Requirements: 4.5_

- [~] 23. Migrate raw `fetch` calls to `apiClient`
  - [~] 23.1 Migrate payment pages (Billing, Wallet, Checkout)
    - Replace raw `fetch` with `apiClient.get/post` calls
    - Verify CSRF handling works correctly
    - _Requirements: 4.6_
  
  - [~] 23.2 Migrate admin pages
    - Replace raw `fetch` with `apiClient` calls
    - _Requirements: 4.6_
  
  - [~] 23.3 Migrate all other pages
    - Replace remaining raw `fetch` calls
    - Verify zero raw `fetch` calls remaining in `src/`
    - _Requirements: 4.6_

- [~] 24. Consolidate home pages
  - [~] 24.1 Evaluate `Home.tsx` vs `HomeRedesign.tsx`
    - Determine which is currently active in `App.tsx`
    - Decide which to keep as canonical
    - _Requirements: 4.7_
  
  - [~] 24.2 Delete non-canonical home page and update route
    - Remove the non-canonical file
    - Update `src/App.tsx` route if needed
    - _Requirements: 4.7_

- [~] 25. Consolidate type drift
  - [~] 25.1 Create `src/types/api.ts` for shared DTOs
    - Import from generated OpenAPI types where applicable
    - Define shared request/response types
    - _Requirements: 4.8_
  
  - [~] 25.2 Consolidate frontend and backend types
    - Move shared types to `src/types/api.ts`
    - Update imports in frontend and backend
    - _Requirements: 4.8_

- [~] 26. Consolidate documentation
  - [~] 26.1 Make `AGENTS.md` the canonical instruction file
    - Ensure `AGENTS.md` has complete AI assistant instructions
    - _Requirements: 4.9_
  
  - [~] 26.2 Reduce `CLAUDE.md`, `GEMINI.md`, `README.md` to pointers
    - Update each file to point to `AGENTS.md`
    - _Requirements: 4.9_

- [~] 27. Checkpoint - Verify Phase 4 architecture cleanups
  - Run `npm run check` — zero TypeScript errors
  - Run `npm run lint` — zero errors
  - Run `npm run test` — all tests pass
  - Ask the user if questions arise.

---

## Phase 5: Test Infrastructure

- [~] 28. Create route-level test helpers
  - [~] 28.1 Create `api/tests/helpers/buildAuthedRequest.ts`
    - Helper to build authenticated request with JWT token
    - Support options for userId, email, role, organizationId
    - _Requirements: 5.1_
  
  - [~] 28.2 Create `api/tests/helpers/mockLinode.ts`
    - Mock all linodeService methods
    - Return appropriate mock responses
    - _Requirements: 5.1_
  
  - [~] 28.3 Create `api/tests/helpers/mockEmail.ts`
    - Mock emailService.sendEmail() — no real emails
    - _Requirements: 5.1_
  
  - [~] 28.4 Create `api/tests/helpers/mockPayPal.ts`
    - Mock PayPal createPayment and capturePayment
    - No real sandbox calls
    - _Requirements: 5.1_
  
  - [~] 28.5 Create `api/tests/helpers/seedDatabase.ts`
    - Helpers to seed organizations, users, payment data
    - _Requirements: 5.1_

- [~] 29. Create route-level tests for priority areas
  - [~] 29.1 Create tests for payments routes
    - Happy-path, authorization, validation-failure tests
    - _Requirements: 5.1_
  
  - [~] 29.2 Create tests for VPS lifecycle routes
    - Test boot, shutdown, reboot, rebuild
    - Mock all Linode API calls
    - _Requirements: 5.1_
  
  - [~] 29.3 Create tests for disk routes
    - Test disk CRUD operations
    - _Requirements: 5.1_
  
  - [~] 29.4 Create tests for admin user CRUD routes
    - Test authorization and data isolation
    - _Requirements: 5.1_
  
  - [~] 29.5 Create tests for billing/egress routes
    - Test billing operations and egress calculations
    - _Requirements: 5.1_

- [~] 30. Create Playwright E2E smoke tests
  - [~] 30.1 Install and configure Playwright
    - Create `playwright.config.ts` with `MOCK_PROVIDERS=true`
    - _Requirements: 5.2_
  
  - [~] 30.2 Create `tests/e2e/smoke.spec.ts`
    - Test: unauthenticated home → login → dashboard
    - Test: register + verify (mocked)
    - Test: VPS list → detail → boot/shutdown (mocked)
    - Test: billing top-up (sandbox)
    - No real emails or VPS creation
    - _Requirements: 5.2_

- [~] 31. Organize tests by type
  - [~] 31.1 Verify test organization structure
    - Unit/integration tests colocated as `*.test.ts`
    - Security tests in `tests/security/`
    - E2E tests in `tests/e2e/`
    - Test fixtures in `tests/fixtures/`
    - _Requirements: 5.3_

- [~] 32. Set up coverage tracking
  - [~] 32.1 Create `npm run test:coverage` script if not exists
    - Configure Vitest coverage reporter
    - _Requirements: 5.4_
  
  - [~] 32.2 Create `docs/coverage-baseline.md`
    - Document coverage target: 70% lines / 80% branches
    - Document operator procedure: run locally before release
    - _Requirements: 5.4_

- [~] 33. Checkpoint - Verify Phase 5 test infrastructure
  - Run `npm run test:coverage` — achieve at least 70% line coverage
  - Run Playwright smoke tests — all pass
  - Ask the user if questions arise.

---

## Phase 6: Volumes Billing Roadmap

- [~] 34. Create volume pricing database schema
  - [~] 34.1 Create migration `migrations/054_volume_pricing.sql`
    - Create `volume_pricing` table with columns: id, provider_id, region_id, price_per_gb_monthly, markup_per_gb_monthly, min_size_gb, max_size_gb, active, created_at, updated_at
    - Create `organization_volumes` table with columns: id, organization_id, vps_instance_id, provider_volume_id, label, size_gb, region_id, monthly_cost, status, created_at, deleted_at
    - Add unique constraint on (provider_id, region_id)
    - Add indexes on organization_id and vps_instance_id
    - _Requirements: 6.1_
  
  - [~] 34.2 Run migration
    - Execute `node scripts/run-migration.js`
    - _Requirements: 6.1_

- [~] 35. Create admin volume pricing UI
  - [~] 35.1 Create `api/routes/admin/volumePricing.ts`
    - GET /api/admin/volume-pricing — list all pricing
    - POST /api/admin/volume-pricing — create pricing entry
    - PUT /api/admin/volume-pricing/:id — update pricing entry
    - DELETE /api/admin/volume-pricing/:id — delete pricing entry
    - Apply `requireAdmin` middleware
    - _Requirements: 6.2_
  
  - [~] 35.2 Create `src/pages/admin/VolumePricingTab.tsx`
    - CRUD table for (provider × region) pricing
    - Inline editing for price/markup
    - Enable/disable pricing per region
    - _Requirements: 6.2_

- [~] 36. Add Linode Volumes API methods to linodeService
  - [~] 36.1 Add volume methods to `api/services/linodeService.ts`
    - listVolumes, createVolume, getVolume, updateVolume, deleteVolume
    - attachVolume, detachVolume, cloneVolume, resizeVolume
    - _Requirements: 6.3_
  
  - [~] 36.2 Create `api/routes/volumes.ts` (admin-only during roadmap)
    - Volume CRUD routes for admin use
    - _Requirements: 6.3_

- [~] 37. Design user volume purchase flow (feature-flagged OFF)
  - [~] 37.1 Create `docs/volumes-user-flow.md`
    - Document: Disks tab "Attach additional storage" CTA (disabled with "Coming soon" tooltip)
    - Document: size picker, monthly cost preview, wallet top-up flow
    - Document: volume creation, hourly billing cron extension
    - Document: detach/delete + refund policy
    - Feature flag: `FEATURE_VOLUMES_USER_PURCHASE=false`
    - _Requirements: 6.4_

- [~] 38. Create volume isolation tests
  - [~] 38.1 Create `tests/security/volume-isolation.test.ts`
    - Test cross-org volume access prevention
    - Mock all Linode Volumes API calls
    - _Requirements: 6.5_
  
  - [~] 38.2 Create `api/routes/__tests__/admin-volume-pricing.test.ts`
    - Test admin volume pricing CRUD routes
    - _Requirements: 6.5_

- [~] 39. Checkpoint - Verify Phase 6 volumes billing
  - Run `npm run test` — all volume tests pass
  - Verify volume pricing tables exist in database
  - Ask the user if questions arise.

---

## Phase 7: Production Readiness Checklist

- [~] 40. Create environment configuration verification documentation
  - [~] 40.1 Create verification script for environment variables
    - Verify all required env vars are set
    - Verify secret lengths (JWT_SECRET 64+, SSH_CRED_SECRET 32+, ENCRYPTION_KEY 32+)
    - Verify NODE_ENV=production
    - Verify TRUST_PROXY=true if behind load balancer
    - Verify CLIENT_URL is production domain
    - _Requirements: 7.1_
  
  - [~] 40.2 Document verification in `docs/production-checklist.md`
    - _Requirements: 7.1_

- [~] 41. Create infrastructure verification documentation
  - [~] 41.1 Create `docs/infrastructure-verification.md`
    - PostgreSQL: daily backups, WAL archiving, connection pooling, SSL
    - Redis: persistence, memory limit, eviction policy
    - PM2: ecosystem.config.cjs review, cluster mode, log rotation
    - NGINX/Cloudflare: CSP, HSTS, X-Frame-Options, TLS 1.3
    - Monitoring: 5xx alerts, slow query alerts, error rate alerts
    - _Requirements: 7.2_

- [~] 42. Create data migration verification documentation
  - [~] 42.1 Create migration verification script
    - Verify egress migrations 025-033 are applied
    - Verify new migrations applied in order
    - _Requirements: 7.3_
  
  - [~] 42.2 Document seed:admin procedure
    - Run with strong password, then rotate
    - _Requirements: 7.3_

- [~] 43. Create pre-release verification commands
  - [~] 43.1 Create `npm run verify:prod` script
    - Bundle: check, lint, test, test:security, test:coverage, scan:code, docs:api:audit, audit:security
    - _Requirements: 7.4_
  
  - [~] 43.2 Create `docs/pre-release-verification.md`
    - Document all verification commands
    - Document manual staging smoke test procedure
    - _Requirements: 7.4_

- [~] 44. Create rollout preparation documentation
  - [~] 44.1 Create `docs/rollout-checklist.md`
    - Blue-green / rolling deploy procedure
    - Migration rollback plan
    - Feature flags: volumes user purchase (off), notification system changes
    - Status page entry for deploy window
    - Rollback tested on staging
    - _Requirements: 7.5_

- [~] 45. Final checkpoint - Production readiness exit
  - Run `npm run verify:prod` — all checks pass
  - Verify staging environment mirrors production configuration
  - Verify runbook is current and accurate
  - System ready for production deployment
  - _Requirements: E.1_

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- All tests mock external services (Linode, PayPal, Email) — no real API calls during tests
- Backend imports must end in `.js` for ESM resolution
- One in-progress todo item at a time — commit in logical chunks
