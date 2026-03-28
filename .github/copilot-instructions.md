---
description: "SkyPanelV2 coding guidelines. Use when: working with React, TypeScript, Express, PostgreSQL, VPS billing, organizations, or egress systems."
---

# SkyPanelV2 Development Guidelines

## Critical Safety Rules

### Database Operations

**NEVER run database reset commands.** This is a live production database.

```bash
# FORBIDDEN - These destroy ALL data:
npm run db:fresh
npm run db:reset
npm run db:reset:confirm
node scripts/reset-database.js
```

**Allowed database operations:**
- `node scripts/run-migration.js` — Apply pending migrations
- `node scripts/apply-single-migration.js <file>` — Apply specific migration
- `npm run seed:admin` — Create default admin user (development only)

### Pre-commit Hooks

**NEVER skip or disable pre-commit hooks.** They protect against bad commits.

```bash
# FORBIDDEN:
git commit --no-verify
git commit -n
```

## Architecture Overview

SkyPanelV2 is a full-stack VPS hosting and billing panel with three product surfaces:
1. **Public marketing pages** — Home, pricing, FAQ, contact, status
2. **Customer portal** — Dashboard, VPS management, billing, support, SSH console
3. **Admin dashboard** — User management, billing ops, platform settings

### Key Technologies

| Layer | Stack |
|-------|-------|
| Frontend | React 18, TypeScript, Vite, TanStack Query, shadcn/ui, Tailwind |
| Backend | Express 4, TypeScript ESM, PostgreSQL, JWT auth |
| Infrastructure | Linode API, PayPal, Resend/SMTP email |

### Data Isolation

**All resource queries MUST be scoped to `organization_id`.** This prevents cross-organization data leakage.

```typescript
// CORRECT - Organization-scoped query
const result = await query(
  'SELECT * FROM vps_instances WHERE organization_id = $1 AND id = $2',
  [orgId, vpsId]
);

// WRONG - Unscoped query leaks data across orgs
const result = await query(
  'SELECT * FROM vps_instances WHERE id = $1',
  [vpsId]
);
```

## Code Style

### Database Operations

Use shared helpers from `api/lib/database.ts`:

```typescript
import { query, transaction } from '../lib/database.js';

// Simple query
const result = await query('SELECT * FROM users WHERE id = $1', [userId]);

// Transaction
const result = await transaction(async (client) => {
  await client.query('UPDATE wallets SET balance = balance - $1 WHERE organization_id = $2', [amount, orgId]);
  await client.query('INSERT INTO payment_transactions (...) VALUES (...)', [...]);
  return { success: true };
});
```

### Provider Token Resolution

Always normalize tokens before creating providers:

```typescript
import { normalizeProviderToken } from '../lib/providerTokens.js';
const token = await normalizeProviderToken(providerId);
const provider = ProviderFactory.create('linode', token);
```

### Route/Service Split

Keep HTTP handling in route files (`api/routes/`), business logic in services (`api/services/`).

## Build Commands

```bash
npm run dev          # Start frontend + backend dev servers
npm run dev-up       # Kill ports, then start dev (clean startup)
npm run build        # TypeScript check + Vite production build
npm run lint         # ESLint validation
npm run check        # TypeScript type checking
```

## Key Files to Check

| Before Changing | Check This File |
|-----------------|-----------------|
| Frontend routes | `src/App.tsx` |
| API routes | `api/app.ts` |
| Database queries | `api/lib/database.ts` |
| npm scripts | `package.json` |

## Documentation References

- **`AGENTS.md`** — Current repository state, practical guidance for agents
- **`CLAUDE.md`** — Claude Code-specific instructions, deeper architecture
- **`README.md`** — Full system documentation, flow diagrams
- **`egress-readme.md`** — Egress billing system details
- **`scripts/README.md`** — Database and admin scripts reference
- **`api/services/providers/README.md`** — Provider abstraction layer

## Common Patterns

### Authentication Middleware

Protected routes use JWT middleware that sets `req.user`:

```typescript
// req.user contains: { userId, role, email }
```

### Organization Role Checking

Use `RoleService` for granular permission validation:

```typescript
import { RoleService } from '../services/roleService.js';
const hasPermission = await RoleService.hasPermission(userId, orgId, 'egress_manage');
```

### Real-Time Notifications

PostgreSQL `LISTEN/NOTIFY` → `notificationService` EventEmitter → SSE endpoint (`/api/notifications`)

### Billing

- **Hourly billing**: Runs every 60 minutes from `server.ts`
- **Billing reminders**: Runs every 24 hours from `billingCronService.ts`
- **Egress monitoring**: Runs hourly, auto-suspends VPS when credits reach zero

## Security Notes

- **Passwords**: bcrypt hashing
- **SSH credentials**: AES-256-GCM encryption via `SSH_CRED_SECRET`
- **Provider tokens**: AES-256-GCM encryption via `ENCRYPTION_KEY`
- **JWT tokens**: HMAC-SHA256, stored in HttpOnly cookies
- **Row-level security**: Enabled on `user_api_keys` table
