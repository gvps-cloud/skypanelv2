# SkyPanelV2 - Copilot Instructions

## Architecture Overview

Full-stack cloud billing panel: React 18 SPA (`src/`) + Express API (`api/`) + PostgreSQL. VPS hosting reseller with PayPal wallet system and Linode provider integration.

### Data Flow
1. **Frontend** → `src/lib/api.ts` (`apiClient`) handles auth headers + auto-logout on 401
2. **API routes** → `api/routes/` use `authenticateToken` middleware setting `req.user` and `req.organizationId`
3. **Business logic** → `api/services/` (e.g., `billingService.ts`, `linodeService.ts`)
4. **Database** → `api/lib/database.ts` provides `query()` and `transaction()` helpers with pg pool

### Key Patterns

**Protected Routes**: All authenticated endpoints use `authenticateToken` + optionally `requireOrganization` or `requireAdmin`:
```typescript
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
router.use(authenticateToken);
router.get('/admin-only', requireAdmin, handler);
```

**Database Transactions**: Use for multi-step operations (especially billing):
```typescript
import { transaction } from '../lib/database.js';
await transaction(async (client) => {
  await client.query('UPDATE wallets SET balance = balance - $1', [amount]);
  await client.query('INSERT INTO billing_cycles ...', [...]);
});
```

**Frontend API Calls**: Always use the shared client for consistent auth:
```typescript
import { apiClient } from '@/lib/api';
const data = await apiClient.get('/vps/instances');
await apiClient.post('/support/tickets', { subject, message });
```

**Provider Abstraction**: VPS operations go through `api/services/providers/`:
- `ProviderFactory.ts` → returns `LinodeProviderService` with decrypted token
- Never call Linode SDK directly; use the factory pattern

## Development Commands

```bash
npm run dev           # Concurrent frontend (5173) + backend (3001)
npm run db:fresh      # Reset DB + apply all migrations
npm run seed:admin    # Create admin@skypanelv2.com / admin123
npm run test          # Vitest once
npm run test:watch    # Vitest watch mode
npm run check         # TypeScript validation
```

## Project Conventions

### File Organization
- Routes: `api/routes/{feature}.ts`, admin routes in `api/routes/admin/`
- Services: `api/services/{name}Service.ts` for business logic
- React pages: `src/pages/{Feature}.tsx`, components in `src/components/`
- Use `@/*` import alias for src files: `import { Button } from '@/components/ui/button'`

### Naming & Style
- Components/pages: PascalCase `.tsx`
- Hooks: `use{Name}.ts` 
- Services/utils: camelCase
- Database columns: snake_case, TypeScript interfaces: camelCase
- API returns `{ success: true, data }` or `{ error: "message" }`

### React State
- Server state: TanStack Query (`useQuery`, `useMutation`)
- Client state: Zustand stores
- Auth/Theme: React Context (`useAuth()`, `useTheme()`)

## Critical Integrations

### Billing Scheduler
`api/server.ts` starts hourly billing on boot via `BillingService.runHourlyBilling()`. Deducts from organization wallets for active VPS instances. Test with:
```bash
node scripts/test-hourly-billing.js
```

### SSH WebSocket Bridge
`initSSHBridge(server)` in `api/server.ts` enables browser-based terminal access at `/api/vps/:id/ssh`.

### Real-time Notifications
PostgreSQL LISTEN/NOTIFY → SSE stream at `/api/notifications/stream`. Frontend subscribes via EventSource.

## Migrations

Sequential SQL files in `migrations/`. Apply with:
```bash
node scripts/run-migration.js              # All pending
node scripts/apply-single-migration.js migrations/00X_name.sql  # Specific
```

Always add columns with `IF NOT EXISTS` for idempotency. The billing service auto-creates missing columns like `last_billed_at`.

## Testing

Tests colocated as `*.test.ts(x)`. Key test files:
- `src/lib/api.test.ts` - API client URL building
- `src/lib/vpsStepConfiguration.test.ts` - VPS wizard logic

Mock external services; don't hit live Linode/PayPal in tests. Use `src/test-utils.tsx` for provider wrappers.

## Environment Variables

Essential for development (see `repo-docs/ENVIRONMENT_VARIABLES.md`):
- `DATABASE_URL` - PostgreSQL connection
- `JWT_SECRET` - Token signing (32+ chars)
- `SSH_CRED_SECRET` / `ENCRYPTION_KEY` - Provider token encryption
- `LINODE_API_TOKEN` - For VPS operations
- `VITE_COMPANY_NAME` - White-label branding
