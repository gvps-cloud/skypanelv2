# Database Rules

Guidance for migrations, schema conventions, and database access patterns.

> **Source:** Derived from `AGENTS.md` Database & Migrations section and `.github/instructions/migrations.instructions.md`.

## Migration Rules

### Golden Rule

**Never modify an existing migration file.** Once applied, migrations are immutable. Add new numbered files instead.

### Naming Convention

Zero-padded three-digit prefix + descriptive name:

```
migrations/
├── 001_initial_schema.sql
├── 002_relax_activity_logs_constraint.sql
├── ...
├── 070_hosting_subscription_last_warning.sql
└── 072_add_linode_platform_integration.sql
```

Check the highest existing number before creating a new one.

### Idempotent Patterns

Keep migrations additive and idempotent where possible:

```sql
-- ✅ Good - idempotent
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

-- ❌ Bad - will fail on re-run
CREATE TABLE users (...);
```

### Applying Migrations

```bash
node scripts/run-migration.js
```

**Never run** `db:reset`, `db:reset:confirm`, or `db:fresh` — they destroy data.

### Migration Checksum Validation

The migration runner validates SHA256 checksums. If a previously-applied migration has a changed checksum, it logs a warning and skips that file (does not error out).

## Schema Conventions

### Primary Keys

Always use UUIDs with `gen_random_uuid()`:

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

### Timestamps

Always use `TIMESTAMPTZ` for consistency across timezones:

```sql
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```

### Soft Deletes

Use `deleted_at` column for audit history:

```sql
deleted_at TIMESTAMPTZ
```

Only hard-delete when data should never be recovered.

### Flexible Config/Metadata

Use `JSONB` with a default empty object:

```sql
config JSONB DEFAULT '{}'
metadata JSONB DEFAULT '{}'
```

### Foreign Keys

Always specify delete behavior:

```sql
-- For dependent data (cascade delete)
organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE

-- For optional references (allow null)
user_id UUID REFERENCES users(id) ON DELETE SET NULL
```

## Database Access Patterns

### Two Patterns Coexist

| Pattern | Location | Use Case |
|---------|----------|----------|
| Raw `pg` | `api/lib/database.ts` | Primary path for routes |
| Drizzle ORM | `lib/db` | Schema definitions, type-safe queries |

### Primary Pattern: Raw pg Query

New backend routes should use the `query()` helper from `api/lib/database.ts`:

```typescript
import { query } from '../lib/database.js';

const result = await query('SELECT * FROM users WHERE id = $1', [id]);
// Returns: { rows: User[], rowCount: number }
```

### Organization Scoping

**All resource queries MUST be scoped by `organization_id`.**

```typescript
// ✅ Correct - scoped by organization
await query(
  'SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2',
  [id, orgId]
);

// ❌ Incorrect - fetches across all orgs
await query('SELECT * FROM vps_instances WHERE id = $1', [id]);
```

## Drizzle ORM Usage

### Package Location

`lib/db` workspace package exports:
- `./src/index.ts` — Query helpers
- `./src/schema` — Drizzle schema definitions

### Schema Conventions

Schema definitions use Drizzle's TypeScript API. Reference existing schemas in `lib/db/src/schema/` for patterns.

### Migrations

Drizzle schema changes require manual migrations (SQL files in `migrations/`). Do not use `drizzle-kit push` in production.

### Development Sync

Use `pnpm push` / `pnpm push-force` to sync Drizzle schema to DB in development only. Do not use in production.

## Environment

### Required Variables

```bash
DATABASE_URL=postgresql://user:password@host:5432/database
```

### Verification

```bash
npm run verify:env
```

This runs `scripts/verify-env.js` to check required environment variables.