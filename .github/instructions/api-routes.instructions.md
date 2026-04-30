---
applyTo: "api/routes/**"
---

# API Route Guidelines

See [AGENTS.md](../../AGENTS.md) for full conventions. Key route-specific reminders:

## Auth Middleware

Apply auth middleware once at the router level, not per-handler:

```typescript
const router = express.Router();
router.use(authenticateToken, requireOrganization); // all routes below are protected
```

Admin routes use `requireAdmin` instead of (or in addition to) `requireOrganization`.

## Imports

All local imports require the `.js` extension (ESM):

```typescript
import { query } from '../lib/database.js';
import { config } from '../config/index.js';
import { handleProviderError } from '../lib/errorHandling.js';
```

## Config

Never use `process.env` directly. Use the typed `config` object:

```typescript
import { config } from '../config/index.js';
const token = config.LINODE_API_TOKEN;
```

## Error Responses

| Scenario | Shape |
|----------|-------|
| Validation (400) | `{ error: 'Validation failed', errors: errors.array(), code: 'VALIDATION_ERROR', timestamp: new Date().toISOString() }` |
| Business logic 4xx | `{ error: 'Human-readable message' }` |
| Provider/Linode errors | `handleProviderError(res, error, 'context')` from `../lib/errorHandling.js` |

## Activity Logging

Log significant actions after successful mutations:

```typescript
import { logActivity } from '../services/activityLogger.js';
await logActivity(userId, organizationId, 'vps.created', `Created VPS ${label}`, { vpsId });
```

Common action types: `vps.created`, `vps.deleted`, `vps.rebuilt`, `vps.power_on`, `vps.power_off`, `ssh.session_started`, `billing.credited`.

## Organization Isolation

All resource queries MUST be scoped to `organization_id`. Never query across orgs:

```typescript
// ✅
await query('SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2', [id, orgId]);
// ❌
await query('SELECT * FROM vps_instances WHERE id = $1', [id]);
```
