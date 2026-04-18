# Production Readiness Plan v2 — SkyPanelV2

Re-scoped 8-phase plan to close all deferred audit items, patch remaining npm CVEs, finish the Linode OpenAPI alignment, and ship a gated volumes-billing roadmap — progress markers reflect state at commit `e009b19` (Phase 0 complete + Phase 1 partial).

**Legend:** ✅ done · ⏳ partial · ⏚ not started

---

## 📦 Handoff Notes (READ FIRST)

**For the next agent picking this up:**

### Hard user constraints

1. **No hosted CI of any kind.** No GitHub Actions, no Dependabot, no Renovate, no Socket.dev, no Snyk. The user is cost-sensitive and has explicitly rejected any paid/hosted automation. **Do not create `.github/workflows/*.yml` files.** Every gate is an operator-run local command (`npm run audit:security`, `npm run verify:prod`, `npm outdated`). A prior attempt added a workflow — it was reverted in commit `396b7c7`.
2. **No email sending during tests.** `api/services/emailService.ts` `sendEmail()` now short-circuits when `config.NODE_ENV === "test"`. Do not remove that guard.
3. **No VPS creation during tests.** Mock `linodeService` with `vi.mock`; stub every destructive provider call.
4. **Never run `db:reset`, `db:reset:confirm`, `db:fresh`.** These wipe the database.
5. **Primary deployment is PM2** (`npm run pm2:start`). Vercel compat remains via a local type shim at `@c:\Users\moran\Documents\skypanelv2\api\types\vercel.d.ts` — do not re-add `@vercel/node` as a dependency.
6. **Backend imports must end in `.js`** (ESM). Frontend imports do not (Vite bundler).
7. **One in-progress todo item at a time.** Commit in logical chunks — never one mega-commit.

### What you inherit (3 commits since plan was drafted)

| Commit | Description |
|---|---|
| `ee9e27e` | Phase 0 CVE emergency — 21 vulns to 1 low |
| `396b7c7` | GitHub Actions workflow removed (operator-run local gates only) |
| `e009b19` | Phase 1 partial — CSP `unsafe-eval` removed, email test sink, admin auth coverage test |

### Verified green at handoff

- `npm run check` — zero TypeScript errors
- `npm run audit:security` — exits 0 (only 1 low-severity `pm2` ReDoS documented in `SECURITY.md`)
- `npm run test:security` — **92 passing, 0 failing** (up from 86/89 at start, including 3 new regression tests)
- `npm run build` — Vite 6.4.2 build succeeds; PWA precache intact

### Exact next step

Phase 1.3 C6/C7 — `@c:\Users\moran\Documents\skypanelv2\api\routes\payments.ts` router-level `requireOrganization`. See "## Phase 1" below for the current state and the precise todo.

### Files the prior agent touched (do not re-touch without cause)

- `@c:\Users\moran\Documents\skypanelv2\package.json` (removed `@vercel/node`; added `serialize-javascript >=7.0.5` override)
- `@c:\Users\moran\Documents\skypanelv2\package-lock.json` (regenerated)
- `@c:\Users\moran\Documents\skypanelv2\SECURITY.md` (new)
- `@c:\Users\moran\Documents\skypanelv2\api\types\vercel.d.ts` (new)
- `@c:\Users\moran\Documents\skypanelv2\api\middleware\security.ts` (removed `unsafe-eval` from dev CSP; migrated to `config.NODE_ENV`)
- `@c:\Users\moran\Documents\skypanelv2\api\services\emailService.ts` (test-mode sink in `sendEmail`)
- `@c:\Users\moran\Documents\skypanelv2\tests\security\admin-auth-coverage.test.ts` (new, 3 tests)
- `@c:\Users\moran\Documents\skypanelv2\.gitignore` (added `audit-baseline.json`)

### Agent protocol

- Plan-then-act for anything non-trivial; keep one item in-progress; update a todo list per phase.
- After each item: run `npm run check` + `npm run test:security` locally.
- After each phase: run `npm run audit:security` + `npm run test:security` locally.
- Before every commit: verify `git status` is clean of unintended changes.
- Use `@absolute/path:line-start-line-end` format for citations.

---

## Progress Snapshot (as of `e009b19`)

| Phase | Status | Notes |
|---|---|---|
| 0 — CVE emergency | ✅ DONE | 21 vulns → 1 low (`pm2` no-fix, documented in `SECURITY.md`); commit `ee9e27e` |
| 1 — Security hardening | ⏳ ~80% | C1 ✅, C5 ✅, C9 ✅, C12 ✅, CSP-hardened ✅, admin auth regression test ✅, email-test-sink ✅; remaining: C6/C7, C8, C10, C13, C11 (trivial — 2 reads); A9 deferred to Phase 4.2 monolith split |
| 2 — VPSDetail ↔ OpenAPI | ⏳ Unchanged | Disks shipped, types generated but not wired; error audit + coverage matrix remain |
| 3 — npm safety | ⏳ 3.2 partial | `@vercel/node` removed; remaining pin/depcheck not started. **3.3 Dependabot → dropped (no CI).** |
| 4 — Architecture cleanups | ⏳ Unchanged | VPSDetail fetch migration done; 165 other fetches + monolith splits + A9 consolidation remain |
| 5 — Test infrastructure | ⏚ Not started | **5.4 CI coverage wiring → dropped (no CI).** Replace with operator-run `npm run test:coverage`. |
| 6 — Volumes roadmap | ⏚ Not started | |
| 7 — Production checklist | ⏳ `verify:prod` shipped | All other checks remain — remove CI-wired checkboxes |

**Rough completion:** ~35%. Remaining estimate: ~3-4 weeks with +1 week buffer.

---

## Guardrails (apply to every phase)

- **No email sending during tests.** `emailService.sendEmail()` already sinks in test mode; do not remove. If adding a sender not routed through `sendEmail`, add the same guardrail.
- **No VPS creation during tests.** Mock `linodeService`; stub destructive calls.
- **Never run `db:reset`, `db:fresh`, destructive migrations.**
- **No GitHub Actions / CI / Dependabot.** All gates are operator-run local commands.
- **One step in progress at a time** (todo list).
- **Minimal upstream fixes** — root-cause over workaround.
- **After every phase:** `npm run check` + `npm run test:security` + `npm run audit:security` pass (operator-run locally).

---

## Phase 0 — CVE Emergency ✅ DONE (commit `ee9e27e`)

**Result:** 21 vulnerabilities → 1 low-severity (`pm2` ReDoS, no upstream fix). All critical + high findings eliminated.

| # | Item | Status |
|---|---|---|
| 0.1 | `npm audit --json > audit-baseline.json` | ✅ (gitignored) |
| 0.2 | `npm audit fix` (non-breaking) | ✅ |
| 0.3 | Removed unused `@vercel/node` devDep (cut 6 highs + smol-toml); added `serialize-javascript >=7.0.5` override (root-cause fix for vite-plugin-pwa chain) | ✅ |
| 0.4 | Vite already on 6.4.2 via `^6.3.5` semver (no advisory on current version); build smoke green | ✅ |
| 0.5 | `SECURITY.md` created — documents audit gate, override rationale, removed deps, accepted risk (`pm2`), supply-chain practices | ✅ |
| 0.6 | ~~Wire `npm run audit:security` into CI~~ — **dropped per user constraint (no CI).** Operator-run `npm run audit:security` before every release. `npm run verify:prod` bundles it with the full gate. | ✅ (docs) |

**Exit criteria achieved:** `npm run audit:security` exits 0. `npm run check` passes. `npm run build` succeeds. `SECURITY.md` committed.

---

## Phase 1 — Security Hardening ⏳ (~80% — commit `e009b19`)

### 1.1 — `admin.ts` router-level auth (A9) ✅ *(regression test shipped; structural consolidation deferred to Phase 4.2)*

Actual state verified: `admin.ts` has 61 handlers, **59** use per-route `authenticateToken, requireAdmin` (my earlier estimate of "1 remaining" was wrong — multi-line signatures were miscounted). **Functional security is intact** — every handler is guarded. Only the consolidation-to-router-level is left, and it logically belongs with the Phase 4.2 monolith split where each sub-router gets `router.use(authenticateToken, requireAdmin)` at top.

Two intentional exceptions (documented in the new regression test):

1. `POST /impersonation/exit` — `authenticateToken` only, no `requireAdmin` (impersonated user isn't admin by design; handler manually verifies JWT claims).
2. `GET /tickets/:id/stream` — SSE, no route-level guards; handler manually verifies JWT from `?token=` query param + role === 'admin' SQL check + blacklist lookup (EventSource can't send `Authorization` headers).

- ✅ Regression test shipped: `@c:\Users\moran\Documents\skypanelv2\tests\security\admin-auth-coverage.test.ts` (3 tests passing). Scans `admin.ts` and asserts every handler has auth OR is a documented exception with equivalent manual checks.
- ⏚ *(Phase 4.2 work)* When `admin.ts` is split into sub-routers, each sub-router file must start with `router.use(authenticateToken, requireAdmin)`, and the 2 exceptions go on a separate sub-router mounted before the main guard. The regression test's `INTENTIONAL_EXCEPTIONS` list will need the new file paths.

### 1.2 — Finish `C1` config migration ✅

All target services already migrated (zero `process.env` in `api/services/`):

- ✅ `linodeService.ts`
- ✅ `tokenBlacklistService.ts`
- ✅ `rateLimitConfigValidator.ts`
- ✅ `emailService.ts`
- Left-as-is: `api/app.ts` bootstrap (justified — runs before config init).

### 1.3 — Security items C5 → C13

| ID | Item | Status | Notes |
|---|---|---|---|
| **C5** | `AUTO_CREATE_ORG` opt-in; default off in prod | ✅ | In `@c:\Users\moran\Documents\skypanelv2\api\config\index.ts` + `auth.ts` |
| **C6/C7** | `payments.ts` router-level `requireOrganization` | ⏚ *(NEXT)* | `router.use(authenticateToken)` already at top of `@c:\Users\moran\Documents\skypanelv2\api\routes\payments.ts`. Add `router.use(requireOrganization)` below it; strip `requireOrganization,` from individual handlers. Verify `/webhooks/paypal` (if present) is declared BEFORE the org guard since PayPal can't provide an org header. Run `npm run test:security` after. |
| **C8** | `notifications.ts` org-scoping query audit | ⏚ | Grep every SELECT in `@c:\Users\moran\Documents\skypanelv2\api\routes\notifications.ts` for `WHERE organization_id = ...`. Document any SELECT without org-scoping and fix. Add a `tests/security/notifications-isolation.test.ts` regression test that seeds two orgs and asserts cross-org access returns 404. |
| **C9** | CSRF shadow-mode prod guard | ✅ | In `@c:\Users\moran\Documents\skypanelv2\api\middleware\csrfProtection.ts` |
| **C10** | Payment isolation security test | ⏚ | New `@c:\Users\moran\Documents\skypanelv2\tests\security\payment-isolation.test.ts` — seed two orgs, assert user-A token cannot capture user-B's PayPal order or view user-B's wallet/invoices. **Must mock PayPal service via `vi.mock`** — never touch real sandbox. |
| **C11** | Frontend `localStorage.auth_token` cleanup | ⏳ | Only **2** reads remain; remove during Phase 4.4 |
| **C12** | Health `error.stack` guard | ✅ | Uses `config.NODE_ENV`; verify `tests/security/*stack*` |
| **C13** | CORS allowlist audit | ⏚ | Read `@c:\Users\moran\Documents\skypanelv2\api\config\index.ts` `buildCorsOrigins` — confirm it never emits `*` and the dev localhost fallback is gated by `NODE_ENV !== 'production'`. Confirm `@c:\Users\moran\Documents\skypanelv2\api\app.ts:257` callback returns `false` (not error) on unknown origins. Document findings; no regression test needed unless a gap surfaces. |

### 1.4 — Items completed this cycle (not in original plan)

| Item | Status | Notes |
|---|---|---|
| **CSP `unsafe-eval` removed from dev** | ✅ | `@c:\Users\moran\Documents\skypanelv2\api\middleware\security.ts` — dev `scriptSrc` no longer includes `'unsafe-eval'`; matches test invariant in `tests/security/xss.test.ts`. Also migrated `isProduction` check to `config.NODE_ENV`. |
| **Email test-mode sink** | ✅ | `@c:\Users\moran\Documents\skypanelv2\api\services\emailService.ts` `sendEmail()` short-circuits when `config.NODE_ENV === "test"`. Fixes password-reset test timeouts. Aligns with guardrail: **do not remove.** |
| **Admin auth coverage regression test** | ✅ | `tests/security/admin-auth-coverage.test.ts` — 3 tests, passing. Becomes the harness for the Phase 4.2 admin monolith split. |

**Exit:** `payments.ts` router-level guards consolidated. C8 notifications isolation audited + test added. C10 payment isolation test added. C13 CORS audit documented. C11 closed during Phase 4.4.

---

## Phase 2 — VPSDetail ↔ Linode OpenAPI Alignment (Week 1-2) ⏳

### 2.1 — Endpoint coverage audit ⏚

Artifact: `docs/linode-coverage-matrix.md` with columns: `VPSDetail action → /api/vps/* route → linodeService method → Linode OpenAPI path → status`.

- ⏚ Frontend inventory (19 apiClient calls in `@c:\Users\moran\Documents\skypanelv2\src\pages\VPSDetail.tsx`).
- ⏚ Backend inventory (31+ handlers in `@c:\Users\moran\Documents\skypanelv2\api\routes\vps.ts` plus new disk routes).
- ⏚ OpenAPI inventory from `@c:\Users\moran\Documents\skypanelv2\repo-docs\linode-openapi.json`.
- ⏚ Flag: dead frontend calls · dead backend routes · OpenAPI drift.

### 2.2 — Generated TypeScript types ⏳

- ✅ `openapi-typescript` installed + `linode:types:sync` script.
- ✅ `@c:\Users\moran\Documents\skypanelv2\api\types\linode-openapi.ts` generated (106K lines).
- ⏚ **Zero imports so far** — wire generated types into `@c:\Users\moran\Documents\skypanelv2\api\services\linodeService.ts`, replacing hand-written interfaces (`LinodeInstance`, `LinodeInstanceBackupsResponse`, `LinodeInstanceStatsResponse`, `LinodeBackupSummary`, `LinodeMetricTuple`, `LinodeIPv6Pool`, `LinodeIPv6Range`, `LinodeVLAN`, `LinodeListIPsResponse`, `LinodeIPAddress`, `LinodeAllocateIPRequest`, `LinodeAssignIPsRequest`, `LinodeShareIPsRequest`, `LinodeCreateIPv6RangeRequest`).
- ⏚ ~~Weekly CI sync job~~ — **dropped (no CI).** Document in `SECURITY.md` or a README: operator re-runs `npm run linode:types:sync` monthly (or after any visible Linode API change) and commits the regenerated `api/types/linode-openapi.ts` with a provenance note.

### 2.3 — Drive (disk) management ✅

- ✅ 8 methods in `linodeService.ts`: `listInstanceDisks`, `getInstanceDisk`, `createInstanceDisk`, `updateInstanceDisk`, `resizeInstanceDisk`, `cloneInstanceDisk`, `resetDiskPassword`, `deleteInstanceDisk`.
- ✅ Provider abstractions in `IProviderService`/`BaseProviderService`/`LinodeProviderService`.
- ✅ Routes at `/api/vps/:id/disks/*` with ownership checks, validation, activity logging.
- ✅ `@c:\Users\moran\Documents\skypanelv2\src\pages\vps-detail\VPSDisksTab.tsx` (259 lines).
- ✅ Disks tab wired into `VPSDetail.tsx`.
- ⏚ Tests still pending: `tests/security/disks-isolation.test.ts`, `api/routes/__tests__/vps-disks.test.ts`, RTL test for disk tab.

### 2.4 — Error & edge-case handling across all VPS routes ⏳

- ⏳ Fully hardened in the new disk routes.
- ⏚ Audit remaining ~31 `/api/vps/*` routes for: all documented Linode error codes via `handleProviderError()`, pagination pass-through, rate-limit surfacing, field-limit pre-validation.

### 2.5 — Feature-parity review ⏚

Output: `docs/linode-feature-roadmap.md`.
- This release: disks only (done).
- Backlog: Placement Groups, VPC interfaces, Metadata Service, dedicated/GPU plan badges.
- Out of scope: LKE, NodeBalancers, Object Storage, Databases.

**Exit:** Coverage matrix published. Generated types in use. Disk tests added. Error audit complete.

---

## Phase 3 — npm Safety Strategy (Week 2) ⏚

**Recommended path (unchanged):** pin + audit + remove unused + automated updates. Do not fork crypto libs.

### 3.1 — Pin versions & lock integrity ⏚

- ⏚ Remove all `^` from `@c:\Users\moran\Documents\skypanelv2\package.json`.
- ⏚ Rebuild `package-lock.json`.
- ⏚ Local/deploy: use `npm ci --ignore-scripts` (blocks post-install supply-chain vector). No CI — document in `README.md` / `SECURITY.md` that operators must run `npm ci --ignore-scripts` on deploy hosts.

### 3.2 — Unused-dependency audit ⏳ *(partial)*

Run `npx depcheck`, verify each flagged package. Specific candidates:

| Package | Decision |
|---|---|
| `crypto-js` | Remove if `@c:\Users\moran\Documents\skypanelv2\api\lib\crypto.ts` supersedes all uses |
| `@vercel/node` | ✅ **REMOVED** (Phase 0). Do not re-add. |
| `react-simple-maps`, `react-leaflet`, `leaflet`, `react-leaflet-cluster` | Consolidate to one map library |
| `three`, `@types/three` | Keep if `ParticleGlobe` in use on landing |
| `xterm` 5.x | Document migration to `@xterm/xterm` 6.x (backlog) |
| `vite-plugin-trae-solo-badge` | Remove if unused |
| `shadcn` (devDep) | Move to global install or keep |
| `babel-plugin-react-dev-locator` | Verify dev usage |

### 3.3 — ~~Automated updates~~ → Manual cadence

**Original Dependabot plan dropped (no CI per user constraint).** Replace with:

- ⏚ Add an ops runbook section to `SECURITY.md`: weekly operator task to run `npm outdated`, `npm audit`, then produce a manual PR for any new high-severity advisories against the override list.
- ⏚ Document the review checklist in a short `docs/dependency-review.md` so the cadence isn't dependent on one operator's memory.

### 3.4 — Supply-chain monitoring ⏚ *(local-only)*

- ⏚ ~~`--provenance` for CI deploy artifacts~~ — N/A, no CI.
- ⏚ ~~Socket.dev / Snyk GitHub App~~ — dropped (cost/hosted).
- ⏚ SBOM: operator runs `npx @cyclonedx/cyclonedx-npm --output-file sbom.json` at release time and attaches to the release notes. Document in `SECURITY.md`.

### 3.5 — Self-maintenance candidates (documented only, NOT this release)

Safe replacement list documented in `SECURITY.md`:
- `qrcode` → in-house (1 day, low risk) — optional, later.
- `ms` (transitive) → native duration parsing.

**Do NOT fork:** `jsonwebtoken`, `bcryptjs`, `dompurify`, `express`, `react`, Radix, Tiptap, `pg`, `ioredis`.

**Exit:** Zero `^` ranges. Unused deps removed. Manual dependency review cadence documented. `npm audit --audit-level=high` clean. SBOM attached to latest release.

---

## Phase 4 — Architecture Cleanups (Week 3) ⏳

### 4.1 — Duplicate notification systems (A1) ⏚

Map consumers of `/api/activity`, `/api/notifications`, `/api/activities`. Deprecate the redundant one (investigate `@c:\Users\moran\Documents\skypanelv2\api\routes\activity.ts` vs `notifications.ts`). Migrate consumers; delete.

### 4.2 — Monolith splits (A8) ⏚

Each split: **logic-preserving extraction**, no behavior changes, tests prove equivalence.

- ⏚ `api/routes/vps.ts` (5035+ lines) → `api/routes/vps/{index,providers,plans,instances,backups,disks,networking,firewalls,stats,stackscripts}.ts`
- ⏚ `api/routes/admin.ts` (~5800 lines) → `api/routes/admin/{users,settings,billing,email-templates,contact,faq,github,ssh-keys,activity,documentation,networking,announcements,category-mappings}.ts`
- ⏚ `src/pages/VPSDetail.tsx` → `src/pages/vps-detail/tabs/{Overview,Networking,Backups,Disks,Firewall,Activity,Settings}Tab.tsx` + `hooks/useVPSDetail.ts` + `types.ts` (`VPSDisksTab.tsx` is already extracted — use as template)
- ⏚ `src/pages/Admin.tsx` → mirror admin.ts split

### 4.3 — raw-fetch → apiClient migration (B1/B3/C11) ⏳

- ✅ `VPSDetail.tsx` (0 raw fetches, 19 apiClient)
- ⏚ **165 raw `fetch` calls** still in `src/` across ~60 files. Priority order:
  1. ⏚ Payment pages (Billing, Wallet, Checkout) — CSRF-sensitive
  2. ⏚ Admin pages (Admin.tsx tabs) — large but uniform
  3. ⏚ Everything else — batched by page

Consider a codemod (jscodeshift) to accelerate; manual review per file.

### 4.4 — localStorage auth cleanup (B2/C11) ⏳

- ⏳ Only **2** `localStorage.auth_token` reads remaining in `src/`; trace and remove.
- Source of truth remains: `AuthContext` + HttpOnly cookie + `apiClient`.

### 4.5 — Home/legacy page cleanup (B5) ⏚

Decide `Home.tsx` vs `HomeRedesign.tsx`; delete loser; update `@c:\Users\moran\Documents\skypanelv2\src\App.tsx` route.

### 4.6 — Type drift (B7) ⏚

Consolidate request/response DTOs: frontend `types/*.ts` ↔ backend ↔ OpenAPI (now that generated types exist in Phase 2.2) → `src/types/api.ts` imported by both sides.

### 4.7 — Docs consolidation (D8) ⏚

Make `AGENTS.md` canonical; reduce `CLAUDE.md`, `GEMINI.md`, `README.md` to pointers.

### 4.8 — Remaining small items (A5/A7/B4/B6) ⏚

- A5 — confirm only one `paymentService.ts` remains.
- A7 — SSH key handling provider-pattern audit.
- B4 — confirm `/api/auth/debug/user` dev-only (already guarded via `config.NODE_ENV`).
- B6 — notes route verification (personal vs org scopes).

**Exit:** Monoliths split. Zero raw fetches. Zero `localStorage.auth_*`. One home page. Docs consolidated.

---

## Phase 5 — Test Infrastructure (Week 4) ⏚

### 5.1 — Route-level coverage (D3)

Helpers (`api/tests/helpers/`): `buildAuthedRequest`, `mockLinode`, `mockEmail`, `mockPayPal`, `seedDatabase`.

Target: every route has happy-path + authz + validation-failure tests (all mocked).

Priorities: payments (expand C10), VPS lifecycle, disks, admin user CRUD, billing/egress.

Coverage target: **70% lines / 80% branches** on `api/routes/` + `api/services/`.

### 5.2 — Playwright E2E (D6)

Smoke flows: unauthenticated home→login→dashboard · register+verify (mocked) · VPS list→detail→boot/shutdown (mocked) · billing top-up (sandbox). `MOCK_PROVIDERS=true` in `playwright.config.ts`.

### 5.3 — Test organization (D5)

- Unit/integration: colocated `*.test.ts`
- Security: `tests/security/`
- E2E: `tests/e2e/`
- Fixtures: `tests/fixtures/`

### 5.4 — Coverage tracking (D7) *(local-only; CI dropped)*

- Operator runs `npm run test:coverage` locally before release; verifies `>= 70%` lines in `api/routes/` + `api/services/`.
- Commit the latest coverage summary (text, not HTML) into `docs/coverage-baseline.md` so regressions are visible in PR diffs.
- Add a pre-commit git hook (Husky, local-only) that optionally runs `npm run check` + `npm run test:security` — **optional, not required**.

**Exit:** 70% coverage enforced. Playwright smoke green. No emails / no real VPSs.

---

## Phase 6 — Volumes Billing Roadmap (Week 4-5, NEW) ⏚

User scope: admin pricing ships; user purchase flow **designed and gated OFF** until explicit enable.

### 6.1 — Schema (day 1)

Migration `NNN_volume_pricing.sql`:
```sql
CREATE TABLE volume_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
  region_id TEXT NOT NULL,
  price_per_gb_monthly DECIMAL(10, 4) NOT NULL,
  markup_per_gb_monthly DECIMAL(10, 4) NOT NULL DEFAULT 0,
  min_size_gb INT NOT NULL DEFAULT 10,
  max_size_gb INT NOT NULL DEFAULT 10240,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(provider_id, region_id)
);
CREATE TABLE organization_volumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vps_instance_id UUID REFERENCES vps_instances(id) ON DELETE SET NULL,
  provider_volume_id BIGINT NOT NULL,
  label TEXT NOT NULL,
  size_gb INT NOT NULL,
  region_id TEXT NOT NULL,
  monthly_cost DECIMAL(10, 4) NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP
);
```

### 6.2 — Admin UI (day 2-3)

- `src/pages/admin/VolumePricing.tsx` — (provider × region) CRUD table.
- `api/routes/admin/volumePricing.ts` guarded by `requireAdmin`.

### 6.3 — Backend service (day 3-4)

Linode Volumes API: list/create/detail/update/delete/attach/detach/clone/resize. Add to `linodeService.ts` + `api/routes/volumes.ts` (admin-only during roadmap phase).

### 6.4 — User purchase flow (design only, DEFERRED post-launch)

`docs/volumes-user-flow.md`:
1. Disks tab → "Attach additional storage" CTA (disabled w/ "Coming soon" tooltip, feature-flag gated).
2. Size picker (1GB increments, respects min/max).
3. Monthly cost preview.
4. Wallet top-up flow → create volume → attach.
5. Hourly billing cron extension (egress-style pro-rating).
6. Detach/delete + refund policy.

### 6.5 — Tests (day 5)

- `tests/security/volume-isolation.test.ts`
- `api/routes/__tests__/admin-volume-pricing.test.ts`
- All Linode volumes API calls mocked.

**Exit:** Admin can set per-GB pricing per (provider, region). Admin-only volume CRUD wired. User purchase flow designed, feature-flag off. No accidental volume costs.

---

## Phase 7 — Production Readiness Checklist (Week 5) ⏳

### 7.1 — Environment review ⏚

- [ ] All required env vars set in prod
- [ ] `JWT_SECRET` ≥ 64 chars (rotate on leak)
- [ ] `SSH_CRED_SECRET` ≥ 32 chars (from `scripts/generate-ssh-secret.js`)
- [ ] `ENCRYPTION_KEY` ≥ 32 chars (from `scripts/generate-encryption-key.js`)
- [ ] `NODE_ENV=production`
- [ ] `TRUST_PROXY=true` if behind LB
- [ ] `RATE_LIMIT_*` tuned for prod
- [ ] `CLIENT_URL` exact production domain

### 7.2 — Infrastructure ⏚

- [ ] PostgreSQL daily backups + WAL archive
- [ ] Redis persistence (rate limits + token blacklist)
- [ ] PM2 `ecosystem.config.cjs` reviewed
- [ ] NGINX/Cloudflare: CSP, HSTS, X-Frame-Options
- [ ] TLS auto-renewal
- [ ] Monitoring alerts: 5xx, slow queries, error rate (Sentry / Better Stack / OTel)

### 7.3 — Data ⏚

- [ ] Egress migrations 025-033 applied
- [ ] New migrations (volume pricing, Phase 1 tables if any) applied in order
- [ ] `npm run seed:admin` with strong password (then rotated)
- [ ] `npm run docs:api:audit` clean

### 7.4 — Tests & scans (all operator-run, no CI) ⏚

- [ ] `npm run check` passes
- [ ] `npm run lint` zero errors
- [ ] `npm run test` full suite green
- [ ] `npm run test:coverage` ≥ 70%
- [ ] `npm run audit:security` zero high+
- [ ] `npm run scan:code` (semgrep) zero errors
- [ ] `npm run test:security` green
- [ ] Playwright smoke green
- [ ] Manual staging smoke: signup → VPS list → VPS detail (all tabs incl. Disks) → billing → logout
- [x] ✅ `npm run verify:prod` script shipped (bundles check + lint + test + test:security + test:coverage + scan:code + docs:api:audit + audit:security)

### 7.5 — Rollout ⏚

- [ ] Blue-green or rolling deploy capability
- [ ] Migration rollback plan documented
- [ ] Feature flags: volumes user purchase (off), A1 notification changes
- [ ] Status-page entry for deploy window
- [ ] Rollback tested on staging

**Exit:** Every checkbox ticked. Staging mirrors prod. Runbook current.

---

## Revised Timeline Summary (at handoff)

| Week | Phases | Key outcomes |
|---|---|---|
| 0 (done) | Phase 0 + Phase 1 partial | ✅ Zero high+ CVEs; CSP hardened; email test sink; admin auth regression test; `SECURITY.md` published |
| 1 | finish 1 | C6/C7 payments router guard · C8 notifications audit + test · C10 payment isolation test · C13 CORS audit |
| 2 | finish 2 + 3 | Coverage matrix · types wired into `linodeService.ts` · error audit for /api/vps/* · npm versions pinned · `depcheck` cleanup · manual dependency review runbook · SBOM |
| 3 | 4 | Notifications deduped · `admin.ts` + `vps.ts` + `VPSDetail.tsx` + `Admin.tsx` split · 165 fetches migrated · localStorage auth purged |
| 4 | 5 + 6.1-6.3 | 70% coverage (operator-verified) · Playwright smoke · admin volume pricing shipped (feature-flag OFF for user purchase) |
| 5 | 6.4-6.5 + 7 | Volume user flow designed · full prod checklist ticked · staging smoke green · ship |

**Buffer:** +1 week for Linode API edge cases, CVE upgrade fallout, or fetch-migration regressions.

---

## Risk Register

| Risk | Mitigation |
|---|---|
| Vite upgrade breaks build | ✅ Handled in Phase 0 — Vite 6.4.2 stable; no future bump planned until a new CVE |
| Generated OpenAPI types flag `any` usage as errors | Wire incrementally per interface; coexist with hand-written types during migration |
| Disk resize hits Linode rate limits in testing | All tests mocked; staging throttled |
| `apiClient` migration breaks CSRF edge case | Per-page smoke test post-migration; keep raw fetch on branch for rollback |
| Missed CVE while no CI | Operator-run `npm run audit:security` before every release; weekly `npm outdated` cadence documented in `SECURITY.md` |
| Monolith splits introduce subtle regressions | Tests-before extraction; preserve imports/exports identical; `admin-auth-coverage.test.ts` as regression harness |
| Volumes accidental creation costs | User purchase gated behind feature flag OFF until explicit enable |
| Test DB state bleed | `beforeEach` truncates; separate `skypanelv2_test` DB on dev workstation |
| Email provider blocks tests | ✅ Handled — `sendEmail()` sinks in `NODE_ENV === 'test'`; do not remove that guard |
| Breaking changes to admin auth during Phase 4.2 split | ✅ Mitigated — `admin-auth-coverage.test.ts` will fail if any sub-router forgets the `authenticateToken, requireAdmin` guard |

---

## Tracking

Maintain one todo list with a single in-progress item. Update after each phase closes. Commit in logical chunks (not one mega-commit).

---

## Change Log

| Date | Commit | Summary |
|---|---|---|
| 2026-04-16 | `ee9e27e` | Phase 0: CVE emergency — 21→1 vulns, `@vercel/node` removed, `SECURITY.md` published, `api/types/vercel.d.ts` type shim added |
| 2026-04-16 | `396b7c7` | Removed GitHub Actions workflow (no CI per user constraint); updated `SECURITY.md` to operator-run model |
| 2026-04-16 | `e009b19` | Phase 1 partial: CSP `unsafe-eval` removed from dev, email test-mode sink, `tests/security/admin-auth-coverage.test.ts` regression test (3 tests) |
