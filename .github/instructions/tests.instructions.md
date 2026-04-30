---
applyTo: "tests/**,src/**/*.test.*,api/**/*.test.*"
---

# Testing Guidelines

See [AGENTS.md](../../AGENTS.md) for dev commands. Key testing reminders:

## Running Tests

```bash
npx vitest run tests/security/   # security test suite only
npx vitest run                   # all tests
```

There is **no** `npm test` script — always run `npx vitest run` directly.

## Test Locations

| Area | Path pattern |
|------|-------------|
| Security (primary suite) | `tests/security/*.test.ts` |
| Backend service unit tests | `api/services/*.test.ts` |
| Frontend page/component tests | `src/pages/*.test.tsx`, `src/components/**/*.test.tsx` |

## Vitest Config

- `globals: true` — no need to import `describe`, `it`, `expect`
- `environment: jsdom` — DOM APIs available in all tests
- `@` alias resolves to `./src`
- `VITE_API_URL` is set to `http://localhost:3001/api` in test env

## Security Tests Pattern

Tests in `tests/security/` do **not** spin up a real server. They unit-test security logic directly:

```typescript
import { tokenBlacklistService } from '../../api/services/tokenBlacklistService';

describe('Token Blacklist', () => {
  it('should reject blacklisted tokens', () => {
    tokenBlacklistService.blacklist('token123');
    expect(tokenBlacklistService.isBlacklisted('token123')).toBe(true);
  });
});
```

## Backend Service Tests

Service tests are co-located with their service file (`api/services/billingService.test.ts`). Mock the `query` function from `api/lib/database.js`:

```typescript
import { vi } from 'vitest';
vi.mock('../lib/database.js', () => ({ query: vi.fn(), transaction: vi.fn() }));
```

## Frontend Component Tests

Use React Testing Library with `test-utils.tsx` helpers from `src/test-utils.tsx`. Wrap components with `renderWithProviders()` if they need auth/query context.
