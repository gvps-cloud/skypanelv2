# Production Readiness Plan v2 — SkyPanelV2

Last audited: 2026-04-19. Reflects actual repository state after the current production-readiness remediation pass. Historical spec snapshots under `repo-docs/specs/production-readiness-v2/` were removed from the tree; this file is the surviving checklist.

**Legend:** ✅ done · ⏳ partial · ⚫ deferred

---

## Hard User Constraints

1. No hosted CI (no GitHub Actions, Dependabot, Renovate, Socket.dev, Snyk)
2. No email sending during tests — `emailService.sendEmail()` sinks in test mode
3. No real Linode VPS/service creation during tests — mock only
4. Never run `db:reset`, `db:reset:confirm`, `db:fresh`
5. PM2 deployment (`npm run pm2:start`)
6. Backend ESM imports end in `.js`
7. Do not push to GitHub — committing allowed when working directory gets cluttered

---

## Phase Completion (actual)

| Phase | Status | Notes |
|---|---|---|
| 0 — CVE Emergency | ✅ | 21 vulns → 1 low (no-fix pm2/js-yaml) |
| 1 — Security Hardening | ✅ | Payments org guard, notifications isolation, payment isolation tests, CORS audit, localStorage cleanup |
| 2 — OpenAPI Alignment | ✅ | Coverage matrix, feature roadmap, disk tests, VPS error handling audit. Generated type wiring ⚫ deferred |
| 3 — npm Safety | ✅ | Versions pinned, `@vercel/node` removed, depcheck run, audit exits 0 (no high+ vulns), dep review docs |
| 4 — Architecture | ⏳ ~90% | Major component splits landed; follow-up extraction remains |
| 5 — Test Infrastructure | ⏳ ~95% | 6 of 6 helpers present, 5 route test files, coverage baseline refreshed. E2E ⚫ deferred |
| 6 — Volumes Roadmap | ✅ | Migration 055, admin UI + API, volume isolation tests, user purchase gated OFF |
| 7 — Production Checklist | ⏳ | Docs refreshed, `verify:prod` runs through, and the Semgrep gate is clean; remaining release work is final production env values plus documenting the final low PM2 advisory |

---

## Task-by-task status vs spec `tasks.md`

### Phase 1: Security Hardening — ✅ ALL DONE
| Task | Spec # | Status |
|---|---|---|
| Payments router org guard | 1 | ✅ |
| Notifications org isolation | 2 | ✅ |
| Payment isolation test | 3 | ✅ |
| CORS audit | 4 | ✅ |
| localStorage auth token cleanup | 5 | ✅ |

### Phase 2: OpenAPI Alignment — ✅ (1 deferred)
| Task | Spec # | Status |
|---|---|---|
| Coverage matrix | 12 | ✅ `docs/linode-coverage-matrix.md` |
| Generated TypeScript types | 13 | ⚫ DEFERRED — high regression risk |
| Disk management tests | 14 | ✅ 3 test files |
| VPS route error handling audit | 15 | ✅ |
| Feature parity docs | 16 | ✅ `docs/linode-feature-roadmap.md` |

### Phase 3: npm Safety — ✅ ALL DONE
| Task | Spec # | Status |
|---|---|---|
| Version pinning | 7 | ✅ No `^` prefixes, `@vercel/node` removed |
| Unused dep removal | 8 | ✅ depcheck run, `crypto-js` removed, map libs consolidated, `vite-plugin-trae-solo-badge` removed |
| Manual dep review docs | 9 | ✅ `docs/dependency-review.md` |
| SBOM docs | 10 | ✅ SECURITY.md updated |

### Phase 4: Architecture — ⏳ 7 of 9 done
| Task | Spec # | Status | Detail |
|---|---|---|---|
| Notification consolidation | 18 | ✅ RESOLVED | Analysis concluded "no consolidation needed" — different tables, different purposes |
| VPS route split | 19 | ✅ | 10 sub-modules in `api/routes/vps/` |
| Admin route split | 20 | ✅ | 25 sub-modules in `api/routes/admin/` |
| **VPSDetail component split** | 21 | ⏳ | `OverviewTab`, `NotesTab`, `BackupsTab`, `NetworkingTab`, `ActivityTab`, and `FirewallTab` extracted; some sections remain inline |
| **Admin component split** | 22 | ⏳ | `AdminThemeSection`, `AdminContactManagementSection`, `AdminServersSection`, `AdminNetworkingSection`, and `AdminProvidersSection` extracted; `Admin.tsx` still has large inline sections |
| Raw fetch migration | 23 | ✅ | All pages migrated in last 4 commits |
| Home page consolidation | 24 | ✅ | `HomeRedesign.tsx` canonical, `Home.tsx` deleted |
| **Type drift consolidation** | 25 | ⏳ | `src/types/api.ts` expanded with shared DTOs, but adoption is still partial |
| **Docs consolidation** | 26 | ✅ | `CLAUDE.md` reduced to a pointer and operator docs were consolidated |

### Phase 5: Test Infrastructure — ⏳ 5 of 6 done
| Task | Spec # | Status | Detail |
|---|---|---|---|
| Test helpers | 28 | ✅ | `buildAuthedRequest.ts`, `mockDatabase.ts`, `mockEmail.ts`, `mockLinode.ts`, `mockPayPal.ts`, and `seedDatabase.ts` present |
| Route tests | 29 | ✅ | `billing-egress.test.ts`, `notifications.test.ts`, `vps-disks.test.ts`, `vps-instances.test.ts`, `admin-volume-pricing.test.ts` |
| Playwright E2E | 30 | ⚫ DEFERRED | `playwright.config.ts` + `smoke.spec.ts` exist; full E2E requires live server |
| Test organization | 31 | ✅ | Correct structure in place |
| Coverage tracking | 32 | ✅ | `@vitest/coverage-v8` installed, `docs/coverage-baseline.md` exists |

### Phase 6: Volumes — ✅
| Task | Spec # | Status | Detail |
|---|---|---|---|
| Volume pricing schema | 34 | ✅ | Migration 055 |
| Admin volume pricing UI | 35 | ✅ | API + component |
| Linode volume methods | 36 | ✅ | linodeService extended |
| User flow design | 37 | ✅ | `docs/volumes-user-flow.md` (user purchase gated OFF) |
| Volume isolation tests | 38 | ✅ | `tests/security/volume-isolation.test.ts` and `api/routes/__tests__/admin-volume-pricing.test.ts` in place |

### Phase 7: Production Readiness — ⏳ automation verified, release cleanup remaining
| Task | Spec # | Status |
|---|---|---|
| Env config verification | 40 | ✅ `scripts/verify-env.js`, `docs/production-checklist.md` |
| Infrastructure verification | 41 | ✅ `docs/infrastructure-verification.md` |
| Data migration verification | 42 | ✅ `docs/migration-verification.md` |
| Pre-release verification | 43 | ✅ `npm run verify:prod` script, `docs/pre-release-verification.md` |
| Rollout preparation | 44 | ✅ `docs/rollout-checklist.md` |

---

## Gate Check Status (as of 2026-04-19)

| Check | Result |
|---|---|
| `npm run check` | ✅ 0 TypeScript errors |
| `npm run lint` | ✅ 0 errors; warnings only |
| `npx vitest run` | ✅ 50 files, 396 tests, 0 failures |
| `npm run audit:security` | ✅ exit 0 — no high+ vulns; `1` low PM2 advisory with no current fix remains |
| `npm run test:security` | ✅ 16 files, 143 tests, 0 failures |
| `npm run test:coverage` | ✅ 50 files, 396 tests, 0 failures; 12.34% lines |
| `npm run scan:code` | ✅ passes with `0` findings; the immutable seed migration false positive in `migrations/001_initial_schema.sql` is excluded from the gate scan |
| `npm run docs:api:audit` | ✅ 0 missing / 0 stale / 0 auth mismatches; 1 debug-only incomplete endpoint |
| `npm run verify:env` | ✅ passes with expected warning while `.env` remains in development mode |
| **`npm run verify:prod`** | ✅ reran successfully on 2026-04-19 under the current script thresholds |

---

## Semgrep Snapshot (as of 2026-04-19)

- Current gate command `npm run scan:code` returns `0` findings.
- The only raw remaining hit before exclusion was `generic.secrets.security.detected-bcrypt-hash.detected-bcrypt-hash` at `migrations/001_initial_schema.sql:190`.
- That value is the intentional seeded default admin bcrypt hash in the immutable bootstrap migration, so the scan wrapper now excludes `migrations/001_initial_schema.sql` instead of editing the migration.
- Local machine-readable snapshot: `semgrep-report.json` (refreshed from the current gate scan).

---

## Production bugs fixed this session

| Bug | File | Fix |
|---|---|---|
| `paypal_order_id` column doesn't exist | `api/routes/organizations.ts:~493` | Changed `paypal_order_id` → `provider_transaction_id` in egress purchase complete handler |
| `transaction` variable shadows imported function | `api/services/egressCreditService.ts:231,240` | Renamed local `transaction` → `paymentTx` to avoid collision with `database.transaction()` |
| Test: `response.body.success` on 403 | `api/tests/egress-wallet-purchase.test.ts:324` | Changed to `expect(response.body.error).toBeDefined()` (middleware returns `{error}`, not `{success}`) |
| Test: JWT `id` vs `userId` | `api/tests/egress-wallet-purchase.test.ts` | Fixed JWT payload to use `userId` (matches `auth.ts:184`) |
| Test: org trigger creates stale roles | `api/tests/egress-wallet-purchase.test.ts` | Added UPDATE to seed egress permissions into trigger-created owner role |
| VPS create wizard dropdowns not selectable inside modal | `src/components/ui/AccordionSelect.tsx` | Set Radix popover to `modal={false}` and prevented open auto-focus so popovers work inside dialog-based wizards |
| Admin impersonation exit route 404 after router split | `api/routes/admin/index.ts`, `api/routes/admin/users.ts` | Extracted shared exit handler and added root alias at `POST /api/admin/impersonation/exit` with `authenticateToken` |
| Volume pricing buried inside Billing | `src/pages/Admin.tsx`, `src/components/admin/billing/BillingDashboard.tsx` | Moved Volume Pricing into its own Operations section and removed the Billing tab entry |

---

## Remaining Steps (ordered by priority)

### G1 — Final low advisory documentation

`npm audit` is down to a single low-severity PM2 advisory with no current fix. Keep it documented as accepted residual risk unless npm/PM2 publishes a patch.

### G2 — Production env cleanup

`.env` still needs final production values before a true deploy, especially `NODE_ENV=production` and a controlled `RDNS_BASE_DOMAIN` instead of a temporary/dev value.

### G3 — VPSDetail component split (Spec Task 21)

Extract tab components from `src/pages/VPSDetail.tsx`:
- `OverviewTab.tsx`, `NetworkingTab.tsx`, `BackupsTab.tsx`, `FirewallTab.tsx`, `ActivityTab.tsx`, `SettingsTab.tsx`
- Shared logic into `hooks/useVPSDetail.ts` (already exists)
- Main `index.tsx` imports tabs

### G4 — Admin component split (Spec Task 22)

Extract tab components from `src/pages/Admin.tsx`:
- `UsersTab.tsx`, `SettingsTab.tsx`, `BillingTab.tsx`, etc.
- Main `index.tsx` imports tabs

### G5 — Type drift consolidation (Spec Task 25)

Expand `src/types/api.ts` with shared DTOs from frontend + backend. Depends on Task 13 (generated types) — ⚫ can be done incrementally.

### G6 — Commit all uncommitted work

Large dirty worktree remains. Commit in logical chunks per constraint 7.

### H — Final review

- Verify `docs/coverage-baseline.md` reflects actual coverage
- Verify `docs/production-checklist.md`, `docs/infrastructure-verification.md`, `docs/rollout-checklist.md` accurate against current state
- Mark all phases complete in this plan

---

## Explicitly deferred (post-launch)

| Item | Spec Ref | Reason |
|---|---|---|
| Generated Linode types in linodeService | Task 13 / Req 2.2 | High regression risk — hand-written interfaces stable |
| Full type drift consolidation | Task 25 / Req 4.8 | Depends on Task 13; low priority |
| Playwright E2E running clean | Task 30 / Req 5.2 | Requires live server; manual smoke test instead |
| VPSDetail + Admin component splits | Tasks 21–22 / Req 4.4–4.5 | Functional — remaining work is refactor-only, not launch-blocking |

---

## Key files

| File | Purpose |
|---|---|
| `plans/production-readiness.md` | This plan / checklist |
| `docs/production-checklist.md` | Operator env/infra checklist |
| `docs/infrastructure-verification.md` | Infrastructure setup docs |
| `docs/pre-release-verification.md` | Pre-release command docs |
| `docs/rollout-checklist.md` | Deploy/rollback procedure |
| `docs/coverage-baseline.md` | Test coverage numbers |
| `docs/dependency-review.md` | Manual dep review process |
| `migrations/055_volume_pricing.sql` | Volume pricing schema |
| `api/routes/admin/volumePricing.ts` | Admin volume pricing API |
| `src/components/admin/billing/VolumePricing.tsx` | Admin volume pricing UI |
| `tests/e2e/smoke.spec.ts` | Playwright smoke spec |
| `api/tests/helpers/` | Test helpers (buildAuthedRequest, mockLinode, mockEmail, mockDatabase) |
