# Migration Verification

How to verify database migrations are correctly applied and no data integrity issues exist.

---

## Pre-Migration Verification

Before running migrations, verify the current state:

```bash
# Check current migration count in the database
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM schema_migrations"

# Count migration files on disk
ls migrations/*.sql | Measure-Object

# The database count should be ≤ the file count
# If database count > file count, migrations were deleted — investigate immediately
```

---

## Running Migrations

```bash
# Apply all pending migrations
node scripts/run-migration.js

# Apply a specific migration (for targeted fixes)
node scripts/apply-single-migration.js migrations/054_fix_mark_all_notifications_read_org_scope.sql
```

The migration runner tracks applied migrations in `schema_migrations` and only runs new ones.

---

## Post-Migration Verification

After running migrations, verify:

### 1. Schema Integrity

```bash
# Verify expected tables exist
psql "$DATABASE_URL" -c "\dt" | Select-String "public |"

# Check specific table structure
psql "$DATABASE_URL" -c "\d activity_logs"
psql "$DATABASE_URL" -c "\d organizations"
psql "$DATABASE_URL" -c "\d vps_instances"
```

### 2. Function Verification

Key SQL functions that must exist and be correct:

```bash
# Verify mark_notification_read function signature
psql "$DATABASE_URL" -c "\df+ mark_notification_read"

# Verify mark_all_notifications_read includes organization_id parameter
psql "$DATABASE_URL" -c "\df+ mark_all_notifications_read"
# Expected: (user_id_param UUID, organization_id_param UUID) → INTEGER

# Verify notify_new_activity trigger
psql "$DATABASE_URL" -c "SELECT tgname FROM pg_trigger WHERE tgname = 'notify_new_activity_trigger'"
```

### 3. Data Integrity

```bash
# Check for orphaned records (VPS without organization)
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM vps_instances WHERE organization_id IS NULL"
# Expected: 0

# Check for orphaned activity logs
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM activity_logs WHERE organization_id IS NULL"
# Expected: 0 or very small (legacy records)

# Verify all users have organization membership
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM users u WHERE NOT EXISTS (SELECT 1 FROM organization_members om WHERE om.user_id = u.id)"
# Expected: 0 (or 1 for the initial admin if not yet assigned)
```

### 4. RLS (Row-Level Security)

```bash
# Verify RLS is enabled on billing/egress tables
psql "$DATABASE_URL" -c "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true"
# Expected: egress_credit_packs, egress_credit_adjustments, etc.
```

---

## Migration Development Rules

1. **Never modify existing migrations** — always add a new sequential file
2. **Migration naming**: `NNN_description.sql` where `NNN` is the next sequential number
3. **Always use `CREATE OR REPLACE`** for functions to allow re-application
4. **Test migrations locally** before applying to production
5. **Add rollback SQL** as a comment at the bottom of each migration file

### Example Migration

```sql
-- 054_fix_mark_all_notifications_read_org_scope.sql

-- Fix: mark_all_notifications_read() was not scoped by organization_id.
CREATE OR REPLACE FUNCTION mark_all_notifications_read(user_id_param UUID, organization_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE activity_logs
  SET is_read = TRUE, read_at = NOW()
  WHERE user_id = user_id_param
    AND organization_id = organization_id_param
    AND is_read = FALSE;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Rollback: Restore original function (single-argument)
-- CREATE OR REPLACE FUNCTION mark_all_notifications_read(user_id_param UUID)
-- RETURNS INTEGER AS $$
-- DECLARE updated_count INTEGER;
-- BEGIN
--   UPDATE activity_logs SET is_read = TRUE, read_at = NOW()
--   WHERE user_id = user_id_param AND is_read = FALSE;
--   GET DIAGNOSTICS updated_count = ROW_COUNT;
--   RETURN updated_count;
-- END;
-- $$ LANGUAGE plpgsql;
```

---

## Seed Scripts

| Script | Purpose | When to Run |
|--------|---------|-------------|
| `npm run seed:admin` | Create default admin user | After initial migration |
| `node scripts/seed-branding.js` | Sync `.env` branding to DB | After branding changes |
| `node scripts/generate-ssh-secret.js` | Generate `SSH_CRED_SECRET` | First-time setup |
| `node scripts/generate-encryption-key.js` | Generate `ENCRYPTION_KEY` | First-time setup |

> ⚠️ **NEVER** run `db:reset`, `db:reset:confirm`, `db:fresh`, or destructive migration commands in production — they destroy all data.
