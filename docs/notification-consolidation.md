# Notification System Consolidation Plan

## Current State: Three Overlapping Routes

The application has three API route groups that all query the same `activity_logs` table but with different interfaces, scoping, and features:

### 1. `/api/notifications` — Real-time + Notification UI

**File**: `api/routes/notifications.ts`
**Frontend consumers**:
- `src/components/NotificationDropdown.tsx` — uses `/notifications/unread`, `/notifications/unread-count`, `/notifications/read-all`, `/notifications/stream` (SSE)

**Endpoints**:
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/stream` | SSE real-time notifications (org-scoped) |
| GET | `/unread` | Unread notifications list |
| GET | `/unread-count` | Unread count badge |
| PATCH | `/read-all` | Mark all as read (org-scoped) |
| PATCH | `/:id/read` | Mark single as read |

**Scoping**: Organization-scoped (fixed in BUG-1/BUG-2). Uses `notificationService` (PostgreSQL LISTEN on `new_activity` channel).

### 2. `/api/activities` — Activity Feed UI

**File**: `api/routes/activities.ts`
**Frontend consumers**:
- `src/components/ActivityFeed.tsx` — uses `/activities`, `/activities/unread-count`, `/activities/:id/read`, `/activities/read-all`
- `src/components/Navigation.tsx` — renders `<ActivityFeed />`

**Endpoints**:
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | User's activities (all, or unread-only) |
| GET | `/unread-count` | Unread count |
| PUT | `/read-all` | Mark all as read |
| PUT | `/:id/read` | Mark single as read |
| DELETE | `/:id` | Delete activity |
| GET | `/organization/:organizationId` | Org-scoped activities |

**Scoping**: User-scoped only (no `requireOrganization` middleware). Uses `ActivityFeedService`.

### 3. `/api/activity` — Activity Log Page

**File**: `api/routes/activity.ts`
**Frontend consumers**:
- `src/pages/Activity.tsx` — uses `/activity` (list with filters) and `/activity/export` (CSV download)

**Endpoints**:
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/recent` | Recent activity (lightweight) |
| GET | `/` | Full list with filters + pagination |
| GET | `/summary` | Counts by type/status |
| GET | `/export` | CSV export |

**Scoping**: Organization-scoped (uses `requireOrganization` on most endpoints). Direct SQL queries.

---

## Overlap Analysis

| Capability | `/api/notifications` | `/api/activities` | `/api/activity` |
|------------|---------------------|-------------------|-----------------|
| List items | `/unread` only | `/` (all/unread) | `/` (filtered/paginated) |
| Unread count | `/unread-count` | `/unread-count` | — |
| Mark all read | `/read-all` (PATCH) | `/read-all` (PUT) | — |
| Mark one read | `/:id/read` (PATCH) | `/:id/read` (PUT) | — |
| SSE stream | `/stream` | — | — |
| Delete | — | `/:id` (DELETE) | — |
| CSV export | — | — | `/export` |
| Summary | — | — | `/summary` |
| Org scoping | ✅ | ❌ (user-only) | ✅ |
| Pagination | ❌ | ❌ | ✅ |
| Filters | ❌ | ❌ | ✅ |

**Key problems**:
1. **Duplicate unread-count**: Both `/notifications/unread-count` and `/activities/unread-count` query the same table
2. **Duplicate mark-all-read**: Both `/notifications/read-all` and `/activities/read-all` do the same thing (with different HTTP methods!)
3. **`/api/activities` is NOT org-scoped**: Security gap — `ActivityFeedService` queries by `user.id` only
4. **Two UI components for the same data**: `NotificationDropdown` and `ActivityFeed` show overlapping content
5. **Inconsistent HTTP methods**: PATCH vs PUT for the same operations

---

## Recommended Consolidation

### Canonical Endpoint: `/api/notifications`

`/api/notifications` is the best canonical endpoint because:
- Already org-scoped (after BUG-1/BUG-2 fixes)
- Has SSE real-time support
- Used by `NotificationDropdown` (the primary UI)

### Migration Plan

#### Phase 1: Add missing features to `/api/notifications` (non-breaking)

1. Add `GET /notifications` — full list with filters + pagination (merge from `/activity`)
2. Add `GET /notifications/summary` — summary counts (merge from `/activity`)
3. Add `GET /notifications/export` — CSV export (merge from `/activity`)
4. Add `DELETE /notifications/:id` — delete notification (merge from `/activities`)
5. Add `GET /notifications/recent` — lightweight recent activity (merge from `/activity`)
6. Fix `ActivityFeedService` to scope by `organization_id` (or replace with direct queries)

#### Phase 2: Migrate frontend consumers

1. Update `src/components/ActivityFeed.tsx` to use `/notifications` instead of `/activities`
2. Update `src/pages/Activity.tsx` to use `/notifications` instead of `/activity`
3. Merge `NotificationDropdown` and `ActivityFeed` into a unified component (or keep separate but same data source)

#### Phase 3: Deprecate old routes

1. Add deprecation headers to `/api/activities` and `/api/activity` responses
2. Add console warnings in frontend for deprecated endpoints
3. After one release cycle, remove the old routes and `ActivityFeedService`

### What NOT to consolidate

- `ticketNotificationService` — separate system for support ticket SSE, uses different channel (`ticket_updates`). Keep as-is.
- `logActivity()` — the writer function. This is the producer, not a consumer. Keep as-is.

---

## Implementation Priority

| Step | Priority | Effort | Risk |
|------|----------|--------|------|
| Fix `/api/activities` org-scoping | High | Small | Low |
| Add pagination/filters to `/api/notifications` | Medium | Medium | Low |
| Migrate ActivityFeed.tsx to `/notifications` | Medium | Small | Low |
| Migrate Activity.tsx to `/notifications` | Medium | Small | Low |
| Deprecate `/api/activities` + `/api/activity` | Low | Small | Medium |
| Remove deprecated routes | Low | Small | Medium |

**Immediate action**: Fix the org-scoping gap in `/api/activities` (security issue). The rest can be done incrementally.
