# Notification System Consolidation Analysis

## Current State

Three notification-related endpoints exist, but they use **different database tables**:

| Endpoint | Table | Service | Purpose |
|---|---|---|---|
| `/api/activity` | `activity_logs` | Direct query | Activity log feed — historical events with filters/pagination |
| `/api/activities` | `activity_feed` | ActivityFeedService | Activity feed entries — title/description format |
| `/api/notifications` | `activity_logs` | NotificationService | Real-time push via SSE + CRUD |

## Key Finding: NOT Duplicates

These are **completely different systems** using different tables:

- **`activity_logs`** — Detailed audit log with entity_type, event_type, metadata JSON, status. Used by `activity.ts` (query) and `notifications.ts` (SSE push).
- **`activity_feed`** — Simpler feed entries with title/description. Used by `ActivityFeedService` for invitations and similar lightweight notifications.

The design doc incorrectly labeled these as redundant. They are not — they have different schemas, different use cases, and different consumers.

## Consumer Map

### `/api/activity`
- Frontend: `Activity.tsx` fetches activity feed
- Table: `activity_logs`
- No SSE — pull-based only

### `/api/activities`
- Frontend: **No known consumer** — only in API manifest
- Table: `activity_feed`
- No SSE — pull-based only
- Used internally by `ActivityFeedService.createActivity()` for invitation events

### `/api/notifications`
- Frontend: `NotificationContext` subscribes to SSE stream
- Table: `activity_logs` (same as `/api/activity`)
- **SSE push** via `notificationService.emit()` — real-time

## Conclusion

**No consolidation is needed.** The three systems are legitimately separate:

1. `/api/activity` — pull-based historical log (Activity page)
2. `/api/activities` — pull-based feed (unused by frontend, used for invitation notifications internally)
3. `/api/notifications` — push-based real-time notifications (SSE)

If there is a desire to reduce code, the opportunity is:
- Merge `ActivityFeedService` into `activityLogger` service (both write to different tables)
- Do NOT merge the three route files — they serve different consumers

## Potential Improvement: Error Handling

Both `activities.ts` and `activity.ts` use raw `res.status(500).json(...)` in catch blocks. These should be updated to use `sendSafeErrorResponse` from `api/lib/errorHandling.js`.

See the catch blocks at:
- `api/routes/activities.ts` lines 22, 38, and others
- `api/routes/activity.ts` lines 47, 128
