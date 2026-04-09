---
applyTo: "src/**"
---

# Frontend Guidelines

See [AGENTS.md](../../AGENTS.md) for full conventions. Key frontend-specific reminders:

## API Calls

- No shared `apiClient` wrapper. Use `fetch()` with `API_BASE_URL` from `src/lib/api.ts`.
- Always attach `Authorization: Bearer ${token}` — get `token` from `useAuth()`.
- Throw on `!response.ok`. Prefer `err.error || \`HTTP ${response.status}\`` as the message.

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
