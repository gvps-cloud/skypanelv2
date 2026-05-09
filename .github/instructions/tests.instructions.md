---
name: skypanel-testing
description: Testing guidelines for skypanelv2. Applies to tests/**, src/**/*.test.*, and api/**/*.test.* files.
applyTo: "tests/**,src/**/*.test.*,api/**/*.test.*"
---

# Testing Guidelines

See [AGENTS.md](../../AGENTS.md) for dev commands. Key testing reminders:

## Running Tests

```bash
npm test                                    # All tests (vitest run)
npm run test:watch                          # Watch mode
npm run test:unit                            # Unit tests only (api/ + src/)
npm run test:coverage                        # All tests with coverage
npm run test:security                        # Security suite only
npx vitest run path/to/file.test.ts          # Single file
npx vitest run api/routes/__tests__/         # All tests in a directory
```

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
- `testTimeout: 15000` — 15 second timeout per test
- `fileParallelism: false` — avoids DB/rate-limiter state interference
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

## Playwright E2E

Playwright e2e config auto-starts `npm run dev-up` outside CI; base URL defaults to `http://localhost:5173`.

```bash
npx playwright test        # Run all e2e tests
npx playwright test --ui   # Run with Playwright UI
```

## Test Include Globs

Vitest includes these patterns:
- `src/**/*.{test,spec}.*`
- `tests/security/**/*`
- `tests/integration/**/*`
- `api/**/*.test.ts`

`tests/e2e/**` is excluded from Vitest.