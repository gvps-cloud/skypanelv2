# Coverage Baseline

Current test coverage baseline for SkyPanelV2, established for tracking improvements over time.

---

## How to Generate Coverage Report

```bash
npm run test:coverage
```

Coverage output is written to `coverage/` directory. View the HTML report at `coverage/index.html`.

---

## Current Baseline (as of 2026-04-19)

### Overall Coverage

Generated from `npm run test:coverage`.

| Metric | Covered | Total | Percent |
|---|---:|---:|---:|
| Statements | 14,957 | 121,274 | 12.34% |
| Branches | 1,460 | 2,654 | 55.02% |
| Functions | 481 | 1,381 | 34.83% |
| Lines | 14,957 | 121,274 | 12.34% |

Vitest currently reports `50` files and `396` tests passing with `0` failures.

### Security Tests

| Suite | File | Tests | Status |
|-------|------|-------|--------|
| Admin Auth Coverage | `tests/security/admin-auth-coverage.test.ts` | 3 | Pass |
| Admin Networking | `tests/security/admin-networking.test.ts` | 10 | Pass |
| Animal Suffix | `tests/security/animalSuffix.test.ts` | 2 | Pass |
| API Hardening | `tests/security/api-hardening.test.ts` | 2 | Pass |
| API Keys Security | `tests/security/apiKeys.test.ts` | 16 | Pass |
| Auth Security | `tests/security/auth.test.ts` | 17 | Pass |
| Disks Isolation | `tests/security/disks-isolation.test.ts` | 3 | Pass |
| Linode Provider Networking | `tests/security/linode-provider-networking.test.ts` | 1 | Pass |
| Notifications Isolation | `tests/security/notifications-isolation.test.ts` | 9 | Pass |
| Notes Security | `tests/security/notes.test.ts` | 7 | Pass |
| Payment Isolation | `tests/security/payment-isolation.test.ts` | 18 | Pass |
| Payments Org Guard | `tests/security/payments-org-guard.test.ts` | 12 | Pass |
| SSH Keys Isolation | `tests/security/ssh-keys-isolation.test.ts` | 7 | Pass |
| Volume Isolation | `tests/security/volume-isolation.test.ts` | 9 | Pass |
| Whitelabel Provider | `tests/security/whitelabel-provider.test.ts` | 12 | Pass |
| XSS Protection | `tests/security/xss.test.ts` | 17 | Pass |

**Total: 143 security tests passing**

### Route-Level Tests (api/routes/__tests__/)

| Suite | File | Tests | Status |
|-------|------|-------|--------|
| VPS Instance Actions | `api/routes/__tests__/vps-instances.test.ts` | 14 | Pass |
| VPS Disks | `api/routes/__tests__/vps-disks.test.ts` | 27 | Pass |
| Billing Egress | `api/routes/__tests__/billing-egress.test.ts` | 6 | Pass |
| Notifications | `api/routes/__tests__/notifications.test.ts` | 10 | Pass |
| Admin Volume Billing | `api/routes/__tests__/admin-volume-pricing.test.ts` | 11 | Pass |

### Frontend Component Tests (src/components/__tests__/)

| Suite | File | Status |
|-------|------|--------|
| VPS Disks Tab | `src/components/__tests__/VPSDisksTab.test.tsx` | Pass |
| Various VPSModalDropdown | `src/components/VPS/VPSModalDropdown.*.test.tsx` | Pass |
| ParticleGlobe | `src/components/home/ParticleGlobe.test.ts` | Pass |
| SSHKeys page | `src/pages/SSHKeys.test.tsx` | Pass |
| ImpersonationSidebarPanel | `src/components/ImpersonationSidebarPanel.test.tsx` | Pass |

### E2E Tests (Playwright)

| Suite | File | Status |
|-------|------|--------|
| Smoke Tests | `tests/e2e/smoke.spec.ts` | Spec present, requires live server to execute |

---

## Coverage Goals

| Category | Current | Target | Timeline |
|----------|---------|--------|----------|
| Overall line coverage | 12.34% | 70% | Post-launch |
| Security tests | 143 passing | 150+ | Post-launch |
| Route-level tests | 5 route suites in place | 50+ | Phase 5+ |
| Frontend component tests | Targeted coverage only | 20+ | Phase 5+ |
| E2E smoke tests | Spec exists, not run in local gate | 10+ | Phase 5+ |

---

## Known Gaps / Follow-Up Areas

1. Overall line coverage remains low at `12.34%` and is not yet threshold-enforced.
2. Playwright smoke coverage still requires a live application environment.
3. Several UI-oriented Vitest files remain narrow or brittle and should be expanded incrementally.
4. `npm run scan:code` now executes cleanly in the current repo state; the only documented exception is the immutable seed bcrypt hash in `migrations/001_initial_schema.sql`, which is excluded from the gate scan as a false positive.

---

## Tracking

Re-run `npm run test:coverage` and `npm run test:security` after each sprint and update this document.
