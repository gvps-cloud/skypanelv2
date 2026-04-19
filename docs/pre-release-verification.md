# Pre-Release Verification

Step-by-step verification procedure to run before every production release.

---

## Quick Gate

Run the automated verification suite. All must pass before proceeding:

```bash
# 1. Type check
npm run check

# 2. Lint
npm run lint

# 3. Security audit
npm run audit:security

# 4. Security tests
npm run test:security

# 5. Coverage baseline
npm run test:coverage

# 6. Static analysis / Semgrep
npm run scan:code

# 7. API docs audit
npm run docs:api:audit

# 8. Full production readiness gate
npm run verify:prod

# 9. Environment validation
npm run verify:env
```

Current local status on 2026-04-19:

- `npm run check` passes
- `npm run lint` passes with warnings only
- `npm run test:security` passes (`143` tests)
- `npm run test:coverage` passes (`50` files, `396` tests, `12.34%` lines)
- `npm run docs:api:audit` passes (`0` missing, `0` stale, `0` auth mismatches)
- `npm run scan:code` passes with `0` findings; the immutable seeded bcrypt hash in `migrations/001_initial_schema.sql` is excluded from the gate scan as a documented false positive
- `npm run audit:security` passes at the current threshold; `1` low PM2 advisory with no current fix remains
- `npm run verify:prod` now completes successfully under the current script thresholds, including the clean Semgrep gate
- `npm run verify:env` passes for the current local `.env`, with the expected warning while `NODE_ENV` remains `development`

---

## Build Verification

```bash
# Clean build
npm run build

# Verify output exists
# Confirm `dist/` contains `index.html` and `assets/`

# Preview production build locally
npm run preview
# Manually verify: login, dashboard loads, no console errors
```

## Safe Startup Validation

Use this only for local validation when you need to confirm production-mode boot behavior without starting schedulers or other startup side effects:

```bash
$env:STARTUP_SIDE_EFFECTS_ENABLED="false"
$env:PORT="3101"
$env:UI_PORT="4173"
npm run build
npx pm2 start ecosystem.config.cjs --env production
```

Then verify:

```bash
npm run pm2:list
curl.exe -I -H "X-Forwarded-Proto: https" http://127.0.0.1:3101/api/health
curl.exe -I http://127.0.0.1:4173
```

Clean up after validation:

```bash
npm run pm2:stop
Remove-Item Env:STARTUP_SIDE_EFFECTS_ENABLED -ErrorAction SilentlyContinue
Remove-Item Env:PORT -ErrorAction SilentlyContinue
Remove-Item Env:UI_PORT -ErrorAction SilentlyContinue
```

---

## Database Migration Check

```bash
# Apply pending migrations
node scripts/run-migration.js

# Verify migration count
# Compare the number of SQL files under `migrations/` with the row count in `schema_migrations`

# Never modify existing migrations — only add new sequential files
```

---

## Functional Smoke Tests

Perform these manually after deployment:

### Authentication

- [ ] Login with valid credentials → dashboard loads
- [ ] Login with invalid credentials → error message shown
- [ ] Password reset email is sent and link works
- [ ] 2FA enrollment and verification (if enabled)

### VPS Management

- [ ] VPS list loads for the organization
- [ ] Create a test VPS (smallest plan) → instance appears
- [ ] Boot / shutdown / reboot actions work
- [ ] VPS details page shows correct information

### Billing

- [ ] Wallet balance displays correctly
- [ ] PayPal top-up flow completes (use sandbox for pre-release)
- [ ] Invoice list shows transactions
- [ ] Egress credits page loads

### Organization Isolation

- [ ] User in Org A cannot see Org B's VPS
- [ ] User in Org A cannot see Org B's billing data
- [ ] Switching organization context updates all data views

### Admin Panel

- [ ] Admin dashboard loads (admin user only)
- [ ] User list displays and search works
- [ ] Platform settings page loads
- [ ] Admin actions are denied during impersonation

### Notifications

- [ ] SSE stream connects (check browser Network tab)
- [ ] VPS action triggers notification
- [ ] Mark-all-read only affects current organization
- [ ] Unread count badge updates in real-time

---

## Performance Check

```bash
# Check bundle size
# Inspect generated JS assets under `dist/assets/`
# Main bundle should be < 500KB gzipped

# Check initial page load (rough estimate)
curl -s -o /dev/null -w "Time: %{time_total}s\n" https://yourdomain.com/
# Should be < 2s with a warm cache
```

---

## Rollback Readiness

Before finalizing the release:

- [ ] Previous build is archived and deployable
- [ ] `npm run pm2:reload` works (zero-downtime restart)
- [ ] Database can be rolled back via new migration (never modify existing)
- [ ] `.env` changes are documented in `.env.example`

---

## Sign-Off

After all checks pass:

1. Tag the release: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
2. Record the deployment timestamp
3. Monitor logs for 15 minutes post-deploy: `npx pm2 logs --lines 0`
4. Verify health endpoint: `curl https://yourdomain.com/api/health`
