# Always-Applied Rules

These rules apply to all work in the skypanelv2 workspace, regardless of file or directory.

> **Source:** Derived from `AGENTS.md` alwaysApply section.

## Project Source of Truth

`AGENTS.md` is the primary source of truth for coding agents. When in conflict, `AGENTS.md` takes precedence over other documentation.

## Critical Conventions

### ESM Imports (Backend)

The backend is ESM (`"type": "module"`). **All local imports require `.js` extensions** even when importing `.ts` sources:

```typescript
import { query } from '../lib/database.js';
import { config } from '../config/index.js';
import { logActivity } from '../services/activityLogger.js';
```

### Zod Version Awareness

| Context | Zod Version |
|---------|-------------|
| Root (`src/`, `api/`) | Zod 4 |
| `lib/*` packages | Zod 3 |

The API differs between versions. Always use the correct version for the import location.

### Multi-Tenant Data Isolation

Many tables are multi-tenant. **Every resource query MUST be scoped by `organization_id`.**

```typescript
// Always scope by organization
await query('SELECT * FROM resources WHERE id = $1 AND organization_id = $2', [id, orgId]);
```

### Never Add Sensitive Defaults

The Vite production build strips example emails, passwords, and API tokens. Do not add sensitive-looking defaults to `src/` files.

### Route Order in api/app.ts

Public routes must be registered **before** protected routes that apply global auth middleware:

```typescript
// Public routes first
app.use('/api/hosting', hostingStatusRoutes);
app.use('/api/blog', blogRoutes);

// Then routes with global auth (notesRoutes)
app.use('/api', notesRoutes);
```

## Package Manager Split

| Directory | Package Manager | Lock File |
|-----------|----------------|-----------|
| Root (npm scripts, app deps) | npm | package-lock.json |
| `lib/*` workspace packages | pnpm | pnpm-lock.yaml |

Do not infer root React/Vite/Zod versions from the pnpm catalog — root is React 18 / Zod 4, catalog targets React 19 / Zod 3 for lib packages.

## No Strict Mode Assertions

The project has relaxed TypeScript settings. Do not introduce stricter assertions:

```json
// Current settings - do not change
{
  "strict": false,
  "noUnusedLocals": false,
  "noUnusedParameters": false
}
```

## Config Pattern

Never read `process.env` directly in route/service files. Always use the typed `config` object:

```typescript
import { config } from '../config/index.js';
const token = config.LINODE_API_TOKEN;
```

## Development Server

`npm run dev-up` is the preferred development command — it kills stale ports (3001, 5173, 8000) first, then starts **both** frontend (Vite :5173) and backend (Express :3001) concurrently. Do NOT run `npm run client:dev` or `npm run server:dev` alongside it — those are single-service commands for when you only need one side.

## Documentation Convention

- `git-docs/` contains prose documentation; prefer root configs/scripts when docs disagree.

## App Startup Behavior

`api/app.ts` validates config on import and starts metrics/billing cron unless `STARTUP_SIDE_EFFECTS_ENABLED=false`. Set that env var before importing the app for safe validation/test boots.