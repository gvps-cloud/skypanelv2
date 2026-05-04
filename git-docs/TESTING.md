# Testing

Test stack, test locations, running tests, and manual testing checklist.

> **Back to**: [README](../README.md)

---

## Test Stack

| Tool                      | Purpose                              | Version |
| ------------------------- | ------------------------------------ | ------- |
| **Vitest**                | Unit and integration test runner     | v3.2.4  |
| **React Testing Library** | Component testing with jsdom         | —       |
| **Supertest**             | HTTP API endpoint testing            | —       |
| **Playwright**            | End-to-end browser testing           | v1.59.1 |
| **fast-check**            | Property-based testing               | v4.6.0  |

---

## Vitest Configuration

Configuration lives in `vitest.config.ts`.

| Setting           | Value                                                                  | Reason                                        |
| ----------------- | ---------------------------------------------------------------------- | --------------------------------------------- |
| `globals`         | `true`                                                                 | No need to import `describe`/`it`/`expect`    |
| `environment`     | `jsdom`                                                                | DOM simulation for React component tests      |
| `alias`           | `@` → `src`                                                            | Matches Vite path alias                       |
| `testTimeout`     | `15000`                                                                | Generous timeout for DB-backed tests          |
| `fileParallelism` | `false`                                                                | Avoids DB and rate-limiter state interference |

**Test include globs:**

- `src/**/*.{test,spec}.*`
- `tests/security/**/*`
- `tests/integration/**/*`
- `api/**/*.test.ts`

**Test exclude:** `tests/e2e/**` — handled by Playwright separately.

---

## Test Locations

| Location                                | Type                         | Example Files                                                                                                                                                                       |
| --------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/**/*.test.{ts,tsx}`                | Frontend unit/hook tests     | `hooks/use-mobile.test.tsx`, `lib/vpsStepConfiguration.test.ts`                                                                                                                     |
| `src/contexts/*.test.tsx`               | Context provider tests       | `AuthContext.impersonation.test.tsx`, `AuthContext.logout.test.tsx`                                                                                                                 |
| `src/components/**/*.test.{ts,tsx}`     | Component-level tests        | `notes/NotesBoard.test.tsx`, `ImpersonationSidebarPanel.test.tsx`                                                                                                                   |
| `src/pages/**/*.test.{ts,tsx}`          | Page-level tests             | `SSHKeys.test.tsx`, `hosting-detail/*.test.tsx`                                                                                                                                     |
| `api/services/*.test.ts`                | Backend service tests        | `authService.impersonation.test.ts`, `egressBillingService.test.ts`, `enhanceService.test.ts`, `hostingBillingService.test.ts`, `invoiceService.test.ts`, `fraudLabsProService.test.ts`, `roles.test.ts` |
| `api/lib/*.test.ts`                     | Backend utility tests        | `crypto.test.ts`, `validation.test.ts`, `errorHandling.test.ts`, `providerRegions.test.ts`                                                                                         |
| `api/routes/__tests__/*.test.ts`        | Backend route tests          | `hosting-store.test.ts`, `hosting-detail-fixes.test.ts`, `hosting-backups.test.ts`, `vps-instances.test.ts`, `vps-disks.test.ts`, `billing-egress.test.ts`, `notifications.test.ts`, `organizations-resources.test.ts`, `admin-enhance-status.test.ts`, `admin-volume-pricing.test.ts` |
| `api/tests/*.test.ts`                   | Backend integration tests    | `hosting-purchase-saga.test.ts`, `egress-wallet-purchase.test.ts`                                                                                                                   |
| `tests/security/*.test.ts`              | Security test suite (19 files) | `auth.test.ts`, `xss.test.ts`, `payment-isolation.test.ts`, `apiKeys.test.ts`, `hosting-org-isolation.test.ts`, `notes.test.ts`, `ssh-keys-isolation.test.ts`, …                   |
| `tests/e2e/*.spec.ts`                   | Playwright E2E tests         | `smoke.spec.ts`                                                                                                                                                                     |

---

## Running Tests

```bash
# --- Unit & Integration Tests -----------------------------------
npm test                      # Run all Vitest tests
npx vitest run                # Same as above
npx vitest run path/to/file   # Run specific test file
npx vitest                    # Watch mode
npm run test:unit             # Run only api/ and src/ tests
npm run test:coverage         # Generate coverage report

# --- Security Tests ---------------------------------------------
npm run test:security         # Run security test suite
npm run verify:security       # Full security verification (audit + scan + tests)

# --- End-to-End Tests -------------------------------------------
npx playwright test           # Run Playwright E2E tests
# Note: Playwright config auto-starts dev server outside CI

# --- Full Pre-Production Verification ---------------------------
npm run verify:prod           # Runs: check, lint, test, test:security, coverage, scan, docs:audit, audit, verify:env

# --- Type Checking & Linting ------------------------------------
npm run check                 # TypeScript type checking (tsc --noEmit)
npm run lint                  # ESLint validation
npm run build                 # TypeScript check + Vite production build
```

### Targeted Commands

```bash
# Hosting API work
npx vitest run api/routes/__tests__/hosting-store.test.ts api/tests/hosting-purchase-saga.test.ts

# Backend route tests
npx vitest run api/routes/__tests__/

# Security tests
npx vitest run tests/security/

# Specific service
npx vitest run api/services/enhanceService.test.ts
```

---

## Testing Notes

- Some backend route tests use the real `DATABASE_URL` and insert/delete rows directly — inspect setup/cleanup before adding cases.
- Avoid destructive DB scripts (`db:reset`, `db:fresh`) unless explicitly requested.
- Backend tests that need the real DB should use transactions with rollback or cleanup in `afterEach`/`afterAll`.
- Security tests verify org-scoped isolation, XSS prevention, auth enforcement, and API key permissions.
- Backend is ESM — all local imports in test files need `.js` extensions when importing `.ts` sources.

---

## Manual Testing Checklist

1. **Database Setup**: `npm run db:fresh && npm run seed:admin`
2. **Auth Flow**: Login → register → 2FA setup → password reset
3. **VPS Lifecycle**: Create → monitor → SSH → reboot → delete
4. **Billing**: Add funds via PayPal → verify wallet → check hourly deductions
5. **Organizations**: Create org → invite member → accept invitation → switch org
6. **Support**: Create ticket → staff reply → close ticket
7. **Admin**: User management → impersonation → platform settings → plan configuration
8. **Hosting**: Browse plans → purchase subscription → manage website → view DNS/SSL → cancel
9. **Notes**: Create personal note → create org note → manage board
10. **Fraud**: (Admin) Review flagged transactions → allow/block
11. **Refunds**: (Admin) Create refund → verify wallet credit
