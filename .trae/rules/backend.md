# Backend Rules

Guidance for Express API routes, services, middleware, and error handling.

> **Source:** Derived from `AGENTS.md` Backend Rules section and `.github/instructions/api-routes.instructions.md`.

## Route Structure

### Entry Points

- `api/server.ts` — Listening entrypoint (starts HTTP server)
- `api/app.ts` — Builds middleware stack and registers all routes; also serves `dist/` in production

### Route Registration

Apply middleware at the **router level** rather than per-handler:

```typescript
const router = express.Router();

// All routes below are protected
router.use(authenticateToken, requireOrganization);

// Admin routes use requireAdmin
router.use(authenticateToken, requireAdmin);
```

### ESM Imports

All local imports require `.js` extension:

```typescript
import { query } from '../lib/database.js';
import { config } from '../config/index.js';
import { handleProviderError } from '../lib/errorHandling.js';
```

## Configuration

Never use `process.env` directly. Use the typed `config` object:

```typescript
import { config } from '../config/index.js';

// ✅ Correct
const token = config.LINODE_API_TOKEN;

// ❌ Incorrect
const token = process.env.LINODE_API_TOKEN;
```

## Error Handling

### Error Response Shapes

| Scenario | Response Shape |
|----------|----------------|
| Validation (400) | `{ error: 'Validation failed', errors: errors.array(), code: 'VALIDATION_ERROR', timestamp: new Date().toISOString() }` |
| Business logic 4xx | `{ error: 'Human-readable message' }` |
| Provider/Linode errors | `handleProviderError(res, error, 'context')` from `api/lib/errorHandling.ts` |

### Provider Error Handling

```typescript
import { handleProviderError } from '../lib/errorHandling.js';

try {
  const result = await linodeService.createInstance(data);
} catch (error) {
  handleProviderError(res, error, 'Creating VPS');
}
```

## Activity Logging

Log significant actions after successful mutations using `logActivity()`:

```typescript
import { logActivity } from '../services/activityLogger.js';

await logActivity(userId, organizationId, 'vps.created', `Created VPS ${label}`, { vpsId });
```

### Common Activity Action Types

Use existing action types — do not invent ad-hoc strings:

| Action Type | Use For |
|-------------|---------|
| `vps.created` | VPS instance created |
| `vps.deleted` | VPS instance deleted |
| `vps.rebuilt` | VPS OS rebuilt |
| `vps.power_on` | VPS powered on |
| `vps.power_off` | VPS powered off |
| `ssh.session_started` | SSH session started |
| `billing.credited` | Account credited |
| `support.ticket_created` | Support ticket created |
| `support.ticket_replied` | Support ticket replied |
| `blog.post_created` | Blog post created |
| `blog.post_updated` | Blog post updated |

## Organization Isolation

**All resource queries MUST be scoped to `organization_id`.** Never query across organizations:

```typescript
// ✅ Correct - scoped by organization
await query('SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2', [id, orgId]);

// ❌ Incorrect - fetches across all orgs
await query('SELECT * FROM vps_instances WHERE id = $1', [id]);
```

## Database Access

### Primary Pattern: Raw pg

New backend routes should use the raw `pg` `query()` helper from `api/lib/database.ts`:

```typescript
import { query } from '../lib/database.js';

const result = await query('SELECT * FROM users WHERE id = $1', [id]);
```

### Alternative: Drizzle ORM

`@workspace/db` exports `./src/index.ts` (query helpers) and `./schema` (Drizzle schema definitions). Use when Drizzle patterns are already established.

## Middleware Stack

| Middleware | Purpose |
|------------|---------|
| `authenticateToken` | JWT verification |
| `requireOrganization` | Org context |
| `requireAdmin` | Admin role check |
| `rateLimiter` | Rate limiting |

## API Middleware Stack

The `/api` path in `api/app.ts` gets these middleware applied globally:
- CSRF protection
- API-key authentication
- Smart rate limits
- Rate-limit response headers

## Services Directory

Business logic lives in `api/services/`:

| Service | Purpose |
|---------|---------|
| `activityLogger.ts` | Activity feed logging |
| `billingService.ts` | Billing calculations |
| `authService.ts` | Authentication |
| `linodeService.ts` | Linode API wrapper |
| `enhanceService.ts` | Enhance hosting API |
| `emailService.ts` | Email sending |
| `errorHandling.ts` | Provider error normalization |

## Additional Services

| Service | Purpose |
|---------|---------|
| `egressCreditService.ts` | Egress prepaid billing |
| `egressHourlyBillingService.ts` | Egress hourly billing |
| `egress/` | Egress billing sub-directory |
| `fraudLabsProService.ts` | Fraud screening |
| `refundService.ts` | Refund processing |

## App Startup

`api/app.ts` validates config on import and starts metrics/billing cron unless `STARTUP_SIDE_EFFECTS_ENABLED=false`. Set that env var before importing the app for safe validation/test boots.