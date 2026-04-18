# Coverage Baseline

Current test coverage baseline for SkyPanelV2, established for tracking improvements over time.

---

## How to Generate Coverage Report

```bash
npx vitest run --coverage
```

Coverage output is written to `coverage/` directory. View the HTML report at `coverage/index.html`.

---

## Current Baseline (as of 2025-01)

### Security Tests

| Suite | File | Tests | Status |
|-------|------|-------|--------|
| Admin Auth Coverage | `tests/security/admin-auth-coverage.test.ts` | — | Pass |
| Admin Networking | `tests/security/admin-networking.test.ts` | — | Pass |
| CORS Validation | `tests/security/cors-validation.test.ts` | — | Pass |
| CSRF Protection | `tests/security/csrf-protection.test.ts` | — | Pass |
| Egress Isolation | `tests/security/egress-isolation.test.ts` | — | Pass |
| Notification Isolation | `tests/security/notifications-isolation.test.ts` | 9 | Pass |
| Organization Isolation | `tests/security/organization-isolation.test.ts` | — | Pass |
| Payment Isolation | `tests/security/payment-isolation.test.ts` | 18 | Pass |
| Payments Org Guard | `tests/security/payments-org-guard.test.ts` | 12 | Pass |
| Rate Limiting | `tests/security/rate-limiting.test.ts` | — | Pass |
| Route Auth Coverage | `tests/security/route-auth-coverage.test.ts` | — | Pass |
| SQL Injection | `tests/security/sql-injection.test.ts` | — | Pass |
| XSS Protection | `tests/security/xss-protection.test.ts` | — | Pass |
| Auth Context Impersonation | `tests/security/AuthContext.impersonation.test.tsx` | — | Pass |

**Total: 131+ security tests passing**

### Route Coverage Gaps

These API route groups lack dedicated route-level tests:

| Route Group | Path | Has Route Tests | Priority |
|-------------|------|-----------------|----------|
| Auth | `/api/auth` | Partial (security only) | High |
| VPS | `/api/vps` | No | High |
| Payments | `/api/payments` | Security only | Medium |
| Organizations | `/api/organizations` | Security only | Medium |
| Egress | `/api/egress` | Security only | Medium |
| Support | `/api/support` | No | Low |
| SSH Keys | `/api/ssh-keys` | No | Low |
| API Keys | `/api/api-keys` | No | Low |
| Invoices | `/api/invoices` | No | Low |
| Notifications | `/api/notifications` | Security only | Medium |
| Admin | `/api/admin/*` | Security only | Medium |

### Frontend Coverage

No frontend unit tests exist currently. The test infrastructure (`vitest.config.ts`, `src/test-utils.tsx`) is set up but no test files exist under `src/`.

---

## Coverage Goals

| Category | Current | Target | Timeline |
|----------|---------|--------|----------|
| Security tests | 131+ | 150+ | Next sprint |
| Route-level tests | 0 | 20+ | Phase 5 |
| Frontend component tests | 0 | 10+ | Phase 5 |
| E2E smoke tests | 0 | 5+ | Phase 5 |

---

## Tracking

Re-run `npx vitest run --coverage` after each sprint and update this document. Use the coverage HTML report to identify uncovered branches and functions.
