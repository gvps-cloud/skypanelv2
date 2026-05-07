# Fix: Spontaneous Page Expansion (Content Shifts Down)

## Summary

On all authenticated pages, content periodically shifts down and then auto-corrects after ~30 seconds. The root cause is a combination of **polling queries that trigger re-renders** and **layout-sensitive components that change size during those re-renders**, most notably the `AnnouncementBanner` and the `useHostingStatus`/`useVpsProductStatus` hooks.

## Current State Analysis

### Root Cause Chain

1. **Global `staleTime: 30000`** in [App.tsx:28](file:///c:/Users/moran/emdash/repositories/skypanelv2/src/App.tsx#L28) — every TanStack Query considers data stale after 30 seconds, triggering background refetches.

2. **`useHostingStatus()` and `useVpsProductStatus()`** in [useHosting.ts:78-108](file:///c:/Users/moran/emdash/repositories/skypanelv2/src/hooks/useHosting.ts#L78-L108) — these have NO explicit `staleTime` or `refetchInterval`, so they inherit the global 30s `staleTime`. They are called in:
   - `AppLayout` (line 262-263) — determines sidebar nav items
   - `AppSidebar` (line 62-63) — conditionally renders nav items based on `hostingStatus?.enabled` and `vpsProductStatus?.enabled`
   - `Dashboard` (line 226-229) — triggers full data reload when these values change

3. **Sidebar nav items flicker** — When `useHostingStatus` or `useVpsProductStatus` refetch, the data briefly becomes `undefined` during the loading state (before the response arrives). This causes `hostingStatus?.enabled` to flip from `true` → `undefined` → `true`, which:
   - Removes and re-adds sidebar nav items (Web Hosting, Compute) in [AppSidebar.tsx:296-350](file:///c:/Users/moran/emdash/repositories/skypanelv2/src/components/AppSidebar.tsx#L296-L350)
   - Changes the sidebar height, which pushes content down

4. **Dashboard full reload** — In [Dashboard.tsx:237-303](file:///c:/Users/moran/emdash/repositories/skypanelv2/src/pages/Dashboard.tsx#L237-L303), `loadDashboardData` depends on `hostingEnabled` and `vpsEnabled`. When these flip due to refetch, the entire dashboard reloads with `setLoading(true)`, causing a loading → data transition that shifts content.

5. **AnnouncementBanner async load** — In [AnnouncementBanner.tsx:60-78](file:///c:/Users/moran/emdash/repositories/skypanelv2/src/components/AnnouncementBanner.tsx#L60-L78), the banner fetches announcements on mount. If the API call is slow or fails intermittently, the banner appears/disappears, changing `--announcement-banner-height` and shifting all content via the `paddingTop` in [App.tsx:268](file:///c:/Users/moran/emdash/repositories/skypanelv2/src/App.tsx#L268).

6. **ActivityFeed 30s polling** — In [ActivityFeed.tsx:217-228](file:///c:/Users/moran/emdash/repositories/skypanelv2/src/components/ActivityFeed.tsx#L217-L228), two queries poll every 30 seconds. Badge count changes can cause header re-renders.

### Why It Auto-Corrects

After the refetch completes, the data returns to its previous value (e.g., `hostingStatus?.enabled` goes back to `true`), so the sidebar items reappear and the layout snaps back. The ~30 second cycle matches the global `staleTime`.

## Proposed Changes

### Fix 1: Add `placeholderData: keepPreviousData` to hosting/VPS status queries

**File:** `src/hooks/useHosting.ts`

Add `placeholderData` to `useHostingStatus()` and `useVpsProductStatus()` so that during background refetches, the previous data is retained instead of becoming `undefined`. This prevents the sidebar nav items from flickering.

```typescript
import { keepPreviousData } from "@tanstack/react-query";

export function useVpsProductStatus() {
  return useQuery({
    queryKey: vpsProductKeys.status(),
    queryFn: async () => {
      const res = await apiClient.get("/vps/status");
      return res as { enabled: boolean };
    },
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000, // 5 minutes — feature flags rarely change
  });
}

export function useHostingStatus() {
  return useQuery({
    queryKey: hostingKeys.status(),
    queryFn: async () => {
      const res = await apiClient.get("/hosting/status");
      return res as { enabled: boolean };
    },
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000, // 5 minutes — feature flags rarely change
  });
}
```

**Why:** Feature flag status (`enabled: boolean`) rarely changes. A 5-minute `staleTime` prevents unnecessary refetches, and `placeholderData: keepPreviousData` ensures no `undefined` gap during refetch.

### Fix 2: Add `placeholderData` to ActivityFeed queries

**File:** `src/components/ActivityFeed.tsx`

Add `placeholderData: keepPreviousData` to both polling queries so the badge count doesn't flash to 0 during refetch.

```typescript
const { data: activitiesData, isLoading: activitiesLoading } = useQuery({
  queryKey: ['activities'],
  queryFn: async () => { ... },
  enabled: !!user,
  refetchInterval: 30000,
  refetchOnWindowFocus: true,
  placeholderData: keepPreviousData,
});

const { data: unreadCountData } = useQuery({
  queryKey: ['activities', 'unread-count'],
  queryFn: async () => { ... },
  enabled: !!user,
  refetchInterval: 30000,
  refetchOnWindowFocus: true,
  placeholderData: keepPreviousData,
});
```

### Fix 3: Prevent Dashboard full reload on status refetch

**File:** `src/pages/Dashboard.tsx`

The `loadDashboardData` callback depends on `hostingEnabled` and `vpsEnabled`. When these flip due to refetch, the entire dashboard reloads. Fix by:
1. Using a ref to track the "initial" enabled state (only reload on first load, not on refetch)
2. Or better: remove `hostingEnabled`/`vpsEnabled` from the `loadDashboardData` dependency array and use refs instead

```typescript
const hostingEnabledRef = useRef(hostingEnabled);
const vpsEnabledRef = useRef(vpsEnabled);

// Only update refs when values actually change (not on refetch flicker)
useEffect(() => {
  if (hostingEnabled !== hostingEnabledRef.current) {
    hostingEnabledRef.current = hostingEnabled;
  }
}, [hostingEnabled]);

useEffect(() => {
  if (vpsEnabled !== vpsEnabledRef.current) {
    vpsEnabledRef.current = vpsEnabled;
  }
}, [vpsEnabled]);

const loadDashboardData = useCallback(async () => {
  if (!token) return;
  setLoading(true);
  try {
    if (vpsEnabledRef.current) {
      // ... VPS loading
    }
    // ... rest of loading
  } finally {
    setLoading(false);
  }
}, [token]); // Only depends on token now
```

### Fix 4: AnnouncementBanner — prevent layout shift from async load

**File:** `src/components/AnnouncementBanner.tsx`

The banner currently returns `null` when `announcements.length === 0`, which means the CSS variable `--announcement-banner-height` starts at `0px`, then jumps to the banner height when announcements load. Fix by:

1. Keep the container always rendered (but invisible when no announcements) so the ResizeObserver can track it
2. Or better: cache the last known announcements in `sessionStorage` so the banner renders immediately on subsequent page loads

```typescript
// Add sessionStorage caching
const SESSION_KEY = "skypanelv2:cached-announcements";

// On mount, initialize from cache
const [announcements, setAnnouncements] = useState<Announcement[]>(() => {
  try {
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached) return JSON.parse(cached) as Announcement[];
  } catch {}
  return [];
});

// After fetch, update cache
const fetchAnnouncements = useCallback(async () => {
  try {
    const data = await apiClient.get<{ announcements: Announcement[] }>("/announcements");
    if (data.announcements) {
      const dismissed = getDismissedIds();
      const filtered = (data.announcements as Announcement[]).filter(
        (a) => !dismissed.has(a.id)
      );
      setAnnouncements(filtered);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(filtered));
    }
  } catch {
    // Silently fail
  }
}, []);
```

### Fix 5: Increase staleTime for site status query

**File:** `src/hooks/useSiteStatus.ts`

The site status query has `refetchInterval: 60_000` and `staleTime: 30_000`. The 30s staleTime means it refetches on window focus after 30s. Increase staleTime to match the refetch interval.

```typescript
export function useSiteStatus() {
  return useQuery<SiteStatus>({
    queryKey: siteStatusKeys.all(),
    queryFn: async () => { ... },
    staleTime: 60_000,     // Match refetchInterval
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });
}
```

## Assumptions & Decisions

1. **Feature flag status is stable** — `hostingStatus.enabled` and `vpsProductStatus.enabled` change very rarely (admin toggles them). A 5-minute staleTime is safe and prevents the 30-second refetch cycle that causes flickering.

2. **`placeholderData: keepPreviousData` is the primary fix** — This is the most impactful change. It prevents the `undefined` gap during background refetches that causes sidebar items to disappear/reappear.

3. **Dashboard should not reload on status refetch** — The current pattern of putting `hostingEnabled`/`vpsEnabled` in the `loadDashboardData` dependency array causes a full reload every time the status query refetches. Using refs breaks this cycle.

4. **AnnouncementBanner caching is a nice-to-have** — The primary fix for the banner is that Fix 1 prevents the status flickering that was the main cause. The sessionStorage caching is an additional improvement for first-load layout shifts.

5. **No changes to VPS polling intervals** — The VPS detail/list pages have adaptive polling (10s/30s) which is intentional for real-time status updates. These don't cause the global layout shift issue.

## Verification Steps

1. **Type check:** `npm run check` — ensure no TypeScript errors
2. **Lint:** `npm run lint` — ensure no lint errors
3. **Test suite:** `npx vitest run` — ensure no regressions
4. **Manual browser testing using the SOLO built-in browser:**
   - Start the dev server (`npm run dev`)
   - Open the app in the SOLO built-in browser
   - Log in and navigate to the Dashboard
   - **Primary test — sit on the page for 2+ minutes and observe:**
     - Verify no spontaneous content shift / page expansion
     - Verify the page height remains stable (no sudden growth then shrink)
   - **Tab refocus test — switch away and back:**
     - Switch to a different browser tab, wait 30+ seconds, switch back
     - Verify no layout jump on refocus (no sidebar flicker, no content shift)
   - **Sidebar stability test:**
     - Verify nav items (Web Hosting, Compute) don't flicker or disappear/reappear
     - Verify sidebar width stays constant
   - **Multi-page test — navigate to each page and wait 30+ seconds:**
     - Dashboard — verify no full reload cycle (no flash of loading state)
     - VPS list page — verify stable layout
     - Billing page — verify stable layout
     - Activity page — verify stable layout
   - **Take screenshots** before and after the 2-minute wait on Dashboard to compare layout stability
