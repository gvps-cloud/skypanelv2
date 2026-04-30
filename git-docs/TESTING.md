# Testing

Test stack, test locations, running tests, and manual testing checklist.

> **Back to**: [README](../README.md)

---

## Test Stack

| Tool                      | Purpose                          |
| ------------------------- | -------------------------------- |
| **Vitest**                | Unit and integration test runner |
| **React Testing Library** | Component testing with jsdom     |
| **Supertest**             | HTTP API endpoint testing        |
| **Playwright**            | End-to-end browser testing       |
| **fast-check**            | Property-based testing           |

---

## Test Locations

| Location                 | Type                                  |
| ------------------------ | ------------------------------------- |
| `src/**/*.test.tsx`      | Frontend component tests (co-located) |
| `api/services/*.test.ts` | Backend service tests                 |
| `api/tests/`             | Backend API tests                     |
| `tests/e2e/`             | Playwright E2E tests                  |

---

## Running Tests

```bash
# Note: Check package.json for current test script availability
# The repo includes Vitest, RTL, Supertest, and Playwright configurations

# Type checking
npm run check

# Linting
npm run lint

# Build verification
npm run build
```

---

## Manual Testing Checklist

1. **Database Setup**: `npm run db:fresh && npm run seed:admin`
2. **Auth Flow**: Login, register, 2FA setup, password reset
3. **VPS Lifecycle**: Create -> monitor -> SSH -> reboot -> delete
4. **Billing**: Add funds via PayPal -> verify wallet -> check hourly deductions
5. **Organizations**: Create org -> invite member -> accept invitation -> switch org
6. **Support**: Create ticket -> staff reply -> close ticket
7. **Admin**: User management -> impersonation -> platform settings -> plan configuration
