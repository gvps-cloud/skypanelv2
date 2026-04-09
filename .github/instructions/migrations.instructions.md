---
applyTo: "migrations/**"
---

# Migration Guidelines

See [AGENTS.md](../../AGENTS.md) for full context.

## Rules

- **Never modify an existing migration file.** Once applied, they are immutable.
- New migrations must be sequential, zero-padded to 3 digits: `052_description.sql`, `053_description.sql`, etc.
- Check the highest existing number in `migrations/` before creating a new one.
- Keep migrations additive and idempotent where possible (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).
- Apply pending migrations with: `node scripts/run-migration.js`
- **Never run** `db:reset`, `db:fresh`, or `db:reset:confirm` — they destroy data.

## Naming

`NNN_short_snake_case_description.sql` — e.g., `052_add_user_preferences_table.sql`

## Schema Conventions

- Primary keys: UUID with `gen_random_uuid()` default.
- Timestamps: `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ DEFAULT NOW()`.
- Soft deletes: add `deleted_at TIMESTAMPTZ` column rather than hard-deleting rows where audit history matters.
- JSONB for flexible config/metadata: prefer `JSONB DEFAULT '{}'` over varchar JSON strings.
- Foreign keys: always add `ON DELETE CASCADE` or `ON DELETE SET NULL` explicitly.
