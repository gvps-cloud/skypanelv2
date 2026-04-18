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

# 5. Full production readiness gate
npm run verify:prod

# 6. Environment validation
node scripts/verify-env.js
```

---

## Build Verification

```bash
# Clean build
npm run build

# Verify output exists
ls dist/  # Should contain index.html and assets/

# Preview production build locally
npm run preview
# Manually verify: login, dashboard loads, no console errors
```

---

## Database Migration Check

```bash
# Check for pending migrations
node scripts/run-migration.js

# Verify migration count
ls migrations/*.sql | Measure-Object   # Count SQL files
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM schema_migrations"  # Should match

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
ls dist/assets/*.js | ForEach-Object { (Get-Item $_).Length / 1KB }
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
