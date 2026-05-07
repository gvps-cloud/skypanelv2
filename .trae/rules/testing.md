# Testing Rules

Guidance for running tests, test structure, and security test patterns.

> **Source:** Derived from `AGENTS.md` Testing Notes section and `.github/instructions/tests.instructions.md`.

## Running Tests

### Commands

```bash
# All tests
npm test              # or npx vitest run

# Single file
npx vitest run path/to/file.test.ts

# Security suite only
npm run test:security

# Watch mode (development)
npm run test:watch

# Coverage
npm run test:coverage
```

Note: There is no `npm test` script alias — always use `npx vitest run` directly.

## Test Configuration

### Vitest Config (`vitest.config.ts`)

Key settings:
- `globals: true` — No need to import `describe`, `it`, `expect`
- `environment: jsdom` — DOM APIs available in all tests
- `@` alias resolves to `./src`
- `testTimeout: 15000` — 15 second timeout per test
- `fileParallelism: false` — Avoids DB/rate-limiter state interference

### Environment Variables

In test environment:
```
VITE_API_URL=http://localhost:3001/api
```

## Test Locations

| Area | Path Pattern |
|------|-------------|
| Security tests | `tests/security/*.test.ts` |
| Backend service tests | `api/services/*.test.ts` |
| Frontend tests | `src/pages/*.test.tsx`, `src/components/**/*.test.tsx` |
| Integration tests | `tests/integration/**/*` |
| Backend route tests | `api/routes/__tests__/*.test.ts` |

**E2E tests** (`tests/e2e/**`) are excluded from Vitest and run separately.

## Security Tests

### Pattern

Security tests in `tests/security/` do **not** spin up a real server. They unit-test security logic directly:

```typescript
import { tokenBlacklistService } from '../../api/services/tokenBlacklistService';

describe('Token Blacklist', () => {
  it('should reject blacklisted tokens', () => {
    tokenBlacklistService.blacklist('token123');
    expect(tokenBlacklistService.isBlacklisted('token123')).toBe(true);
  });
});
```

### Running Security Suite

```bash
npm run test:security
```

This runs `npx vitest run tests/security/` only.

## Backend Service Tests

### Co-location Pattern

Service tests are co-located with their service file:

```
api/services/
├── billingService.ts
└── billingService.test.ts
```

### Mocking Database

Mock the `query` function from `api/lib/database.js`:

```typescript
import { vi } from 'vitest';
vi.mock('../lib/database.js', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
}));
```

## Frontend Component Tests

### Test Utilities

Use helpers from `src/test-utils.tsx`:

```typescript
import { renderWithProviders } from '@/test-utils';
import { screen } from '@testing-library/react';

it('renders user data', () => {
  renderWithProviders(<UserCard user={mockUser} />);
  expect(screen.getByText(mockUser.name)).toBeInTheDocument();
});
```

### Wrapping with Providers

Wrap components needing auth/query context with `renderWithProviders()`.

## Test Patterns

### Arrange-Act-Assert

```typescript
it('should create VPS instance', async () => {
  // Arrange
  const input = { label: 'test-vps', plan: 'nanode-1gb' };
  
  // Act
  const result = await createVPS(input);
  
  // Assert
  expect(result.id).toBeDefined();
  expect(result.label).toBe('test-vps');
});
```

### Async Testing

```typescript
it('should handle async errors', async () => {
  // Use async/await with expect().rejects
  await expect(fetchData()).rejects.toThrow('Network error');
});
```

## Testing Specific Features

### After Hosting/API Changes

Common targeted test command:
```bash
npx vitest run api/routes/__tests__/hosting-store.test.ts api/tests/hosting-purchase-saga.test.ts
```

### Database-Dependent Tests

Some backend route tests use the real `DATABASE_URL` and insert/delete rows directly. Always:
1. Inspect setup/cleanup before adding cases
2. Avoid destructive DB scripts
3. Use transactions for isolation when possible

## Coverage

### Generating Coverage Report

```bash
npm run test:coverage
```

### Coverage Baseline

Reference `docs/coverage-baseline.md` for coverage thresholds.

## Verification Command

Full security verification:
```bash
npm run verify:security
```

This runs: audit + scan + tests in sequence.

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