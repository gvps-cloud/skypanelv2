---
applyTo: "src/**"
---

# Frontend Guidelines

See [AGENTS.md](../../AGENTS.md) for full conventions. Key frontend-specific reminders:

## API Calls

**Preferred**: use the `apiClient` singleton from `@/lib/api`. It automatically handles CSRF tokens (`X-CSRF-Token` from the `csrf_token` cookie), the `X-Organization-ID` header, and 401 auto-logout:

```typescript
import { apiClient } from '@/lib/api';

// Inside a queryFn or mutation:
const data = await apiClient.get<MyType>('/vps');
await apiClient.post('/ssh-keys', { name, publicKey });
await apiClient.delete(`/ssh-keys/${id}`);
```

`apiClient` authenticates via the HttpOnly `auth_token` cookie (`credentials: "include"`). Do **not** manually attach an `Authorization` header when using `apiClient`.

**Alternative** (raw fetch, e.g. in older pages like `SSHKeys.tsx`): use `fetch()` with `API_BASE_URL` from `@/lib/api` and attach `Authorization: Bearer ${token}` (get `token` from `useAuth()`), plus `X-CSRF-Token` from the `csrf_token` cookie. Avoid this pattern in new code.

For both patterns, throw on `!response.ok`. Prefer `err.error || \`HTTP ${response.status}\`` as the message.

## TanStack Query

- Export a query key factory: `export const fooKeys = { all: ['foo'] as const, detail: (id: string) => ['foo', id] as const }`.
- In `queryFn`, throw on API or business-logic failure rather than returning null/undefined.
- `onSuccess` → call `queryClient.invalidateQueries({ queryKey: fooKeys.all })`.
- Default `staleTime`: 5 minutes (`5 * 60 * 1000`). Use a longer value (10 min+) for read-only public data.

## Class Names

- Use `cn()` from `@/lib/utils` for all conditional or composed Tailwind class names.

## Routing & Guards

- Public pages → no guard, rendered via the public route list in `src/App.tsx`.
- Authenticated pages → `<ProtectedRoute>` (renders `AppLayout` with sidebar).
- Admin pages → `<AdminRoute>` (requires `user.role === 'admin'`).
- SSH console → `<StandaloneProtectedRoute>` (auth without sidebar).

## Theming

- Read `src/contexts/ThemeContext.tsx` and `src/theme/` before changing theme behavior.
- Use theme CSS variables (`--color-*`) rather than hardcoded color values.

## Marketing Pages

- Shared design system: `@/styles/home.css` classes (`.home-feature-card`, `.home-glass-panel`, etc.).
- Layout: `MarketingNavbar` + main + `MarketingFooter`.
- Navbar is `fixed top-0 z-40` ~72 px tall — content areas need `pt-[72px]`.
