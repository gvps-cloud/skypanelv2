# Frontend Rules

Guidance for React components, TanStack Query, routing, and styling.

> **Source:** Derived from `AGENTS.md` Frontend Rules section and `.github/instructions/frontend.instructions.md`.

## API Calls

### Preferred: apiClient Singleton

Use `apiClient` from `@/lib/api` for new API calls. It handles:
- CSRF tokens (`X-CSRF-Token` from `csrf_token` cookie)
- Organization header (`X-Organization-ID`)
- 401 auto-logout

```typescript
import { apiClient } from '@/lib/api';

// Inside a queryFn or mutation:
const data = await apiClient.get<MyType>('/vps');
await apiClient.post('/ssh-keys', { name, publicKey });
await apiClient.delete(`/ssh-keys/${id}`);
```

**Do NOT manually attach `Authorization` headers when using `apiClient`.**

### Alternative: Raw Fetch

For rare cases (uploads/downloads, impersonation), use `fetch()` with:

```typescript
import { buildApiUrl, API_BASE_URL } from '@/lib/api';

// Include credentials and required headers
const response = await fetch(buildApiUrl('/endpoint'), {
  credentials: 'include',
  headers: {
    'X-CSRF-Token': getCsrfToken(), // from csrf_token cookie
    'X-Organization-ID': orgId,
    'Authorization': `Bearer ${token}`, // from useAuth()
  }
});
```

### Error Handling

Throw on `!response.ok`. Prefer `err.error || \`HTTP ${response.status}\`` as the error message.

## TanStack Query

### Query Key Factories

Export query key factories from hook files:

```typescript
export const fooKeys = {
  all: ['foo'] as const,
  detail: (id: string) => ['foo', id] as const,
  list: (filters: FilterOptions) => ['foo', 'list', filters] as const,
};
```

### Query Function Patterns

In `queryFn`, throw on API or business-logic failure:

```typescript
const { data } = useQuery({
  queryKey: fooKeys.detail(id),
  queryFn: async () => {
    const response = await apiClient.get(`/foo/${id}`);
    if (!response.ok) {
      throw new Error(response.error || `HTTP ${response.status}`);
    }
    return response.data;
  },
});
```

### Mutation Patterns

```typescript
const mutation = useMutation({
  mutationFn: async (data: CreateFooInput) => {
    return apiClient.post('/foo', data);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: fooKeys.all });
  },
});
```

### Stale Time Guidelines

| Data Type | Default staleTime |
|-----------|-------------------|
| User mutations | 5 minutes |
| Read-only public data | 10+ minutes |
| Real-time/streaming | 0 (disabled) |

## Class Names

Use `cn()` from `@/lib/utils` for all conditional or composed Tailwind classes:

```typescript
import { cn } from '@/lib/utils';

<div className={cn(
  'base-classes',
  isActive && 'active-class',
  className,
)} />
```

## Routing & Guards

| Guard | Use For |
|-------|---------|
| `<ProtectedRoute>` | Authenticated pages (renders `AppLayout` with sidebar) |
| `<AdminRoute>` | Admin-only pages (requires `user.role === 'admin'`) |
| `<StandaloneProtectedRoute>` | SSH console (auth without sidebar) |
| `<HostingEnabledRoute>` | Hosting pages (gated by feature flag) |
| `<HostingMarketingGate>` | Redirects to `/` if hosting disabled |
| `<RegistrationEnabledRoute>` | Redirects to `/login` if registration disabled |
| `<MaintenanceGuard>` | Redirects non-admins during maintenance |

### Route Configuration

Routes are configured in `src/App.tsx`. Route guards wrap the protected sections:

```tsx
<Routes>
  {/* Public routes */}
  <Route path="/" element={<LandingPage />} />
  
  {/* Protected routes */}
  <Route element={<ProtectedRoute />}>
    <Route element={<AppLayout />}>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/vps" element={<VPSPage />} />
    </Route>
  </Route>
  
  {/* Admin routes */}
  <Route element={<AdminRoute />}>
    <Route path="/admin" element={<AdminDashboard />} />
  </Route>
</Routes>
```

## Theming

### Dual-Path Theme System

Theme behavior is split between:

1. **Frontend context**: `src/contexts/ThemeContext.tsx`
2. **API route**: `api/routes/theme.ts`

### Theming Guidelines

- Read `src/contexts/ThemeContext.tsx` and `src/theme/` before changing theme behavior
- Use theme CSS variables (`--color-*`) rather than hardcoded color values
- Theme changes may need updates in both frontend and API

## Marketing Pages

### Layout Pattern

```
MarketingNavbar (fixed top-0, ~72px tall)
  ↓
Content area with pt-[72px] offset
  ↓
MarketingFooter
```

### Shared Design System

Use classes from `@/styles/home.css`:
- `.home-feature-card`
- `.home-glass-panel`
- `.home-section-container`

### Announcement Banner Offset

Marketing pages use `--announcement-banner-height` CSS variable for proper spacing:

```typescript
// Content area needs offset when announcement banner is visible
<div style={{ paddingTop: 'var(--announcement-banner-height, 0px)' }}>
```

## Component Patterns

### shadcn/ui Components

Shared UI components live in `src/components/ui/`. Use existing shadcn components before creating new ones.

### Error Boundaries

Wrap major features with `<ErrorBoundary>` components to gracefully handle runtime errors.

### Loading States

Use loading spinners and skeletons for async operations. The `LoadingSpinner` component is available in `src/components/admin/`.

## Vite Proxy Configuration

Vite proxy config in `vite.config.ts` includes SSE/WebSocket handling for `/notifications/stream`. Frontend API paths default to `/api`; Vite proxies `/api/` to `localhost:3001` in dev.

## Production Build

Vite build includes a `removeMockData` plugin that strips example emails, passwords, and API tokens from production bundles. Do not add sensitive-looking defaults to `src/` files expecting them to ship.

## Logo

Logo source of truth: `public/favicon.svg` — the `Logo` component renders it as an image.