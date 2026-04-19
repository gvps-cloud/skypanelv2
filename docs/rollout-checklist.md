# Rollout Checklist

Step-by-step procedure for deploying a new release to production.

---

## Pre-Rollout (5–10 minutes)

1. **Verify all pre-release checks pass**
   ```bash
   npm run verify:prod
   node scripts/verify-env.js
   ```

   Note: `npm run scan:code` now returns `0` findings in the current repo state. The immutable bootstrap migration `migrations/001_initial_schema.sql` is excluded from the gate scan because its seeded bcrypt hash is an intentional false positive, not a runtime secret.

2. **Confirm pending database migrations are understood**
   Review new files in `migrations/` and ensure they are additive and safe before rollout.
   - New migrations should be additive only (no DROP/ALTER on existing columns)
   - Review the SQL for any destructive operations

3. **Notify team** — announce deployment window in your communication channel

4. **Archive current state**
   ```bash
    git tag -a pre-release-YYYYMMDDHHMM -m "Pre-release snapshot"
    npx pm2 list  # Record current process state
   ```

---

## Rollout Steps

### Step 1: Apply Database Migrations

```bash
node scripts/run-migration.js
```

- Verify no errors in output
- Confirm expected migration count in `schema_migrations`

### Step 2: Build Application

```bash
npm run build
```

- Confirm `dist/` directory is updated
- Check for build errors or warnings

### Step 3: Deploy (PM2 zero-downtime reload)

```bash
npm run pm2:reload
```

- PM2 spawns new processes before killing old ones
- Verify processes come back online:

```bash
npm run pm2:list
# All processes should show "online" status
```

### Step 4: Verify Health

```bash
# Application health
curl -s https://yourdomain.com/api/health | jq .

# Check PM2 logs for startup errors
npx pm2 logs --lines 20
```

For local validation-only PM2 boots, use alternate ports plus `STARTUP_SIDE_EFFECTS_ENABLED=false`, then confirm the startup skip message rather than scheduler activity.

### Step 5: Smoke Test

Quick manual verification of core flows:

- [ ] Login works
- [ ] Dashboard loads
- [ ] VPS list displays
- [ ] Billing page loads
- [ ] Admin panel accessible (admin user)

---

## Post-Rollout (15–30 minutes)

1. **Monitor logs** for errors or warnings:
   ```bash
   npx pm2 logs --lines 0
   ```

2. **Check application metrics**:
   - Response times on key endpoints
   - Error rate in logs
   - Memory usage: `npx pm2 monit`

3. **Verify schedulers are running**:
   ```bash
    npx pm2 logs --lines 50 | Select-String "scheduler|billing|egress"
   ```

   If you intentionally used `STARTUP_SIDE_EFFECTS_ENABLED=false` for a local validation boot, this check should instead show the startup-side-effects skip message.

4. **Confirm SSE notifications** are working (trigger a VPS action and check browser)

5. **Tag the release**:
   ```bash
   git tag -a vX.Y.Z -m "Release vX.Y.Z"
   ```

---

## Rollback Procedure

If critical issues are discovered post-rollout:

### Option A: Revert Code (Preferred)

1. Revert to a previously prepared release artifact or checked-out release tag:
   ```bash
   npm run build
   npm run pm2:reload
   ```

2. Database: create a **new migration** to undo schema changes (never modify existing migrations)

### Option B: PM2 Restart with Previous Build

1. If the previous build is still in `dist/` backup:
   ```bash
   # Restore previous build
   cp -r dist.backup/* dist/
   npm run pm2:reload
   ```

### Option C: Full Service Restart

```bash
npm run pm2:stop
npm run pm2:start
```

---

## Emergency Contacts

- Document the on-call rotation or escalation path
- Keep database connection info accessible for manual intervention
- Maintain access to the hosting provider console (Linode) for infrastructure-level issues
