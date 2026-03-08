# Admin Servers Management Redesign Plan

## Goals
- Expand `/admin#servers` so admins get the same practical VPS controls already exposed elsewhere (SSH, detailed view, lifecycle actions).
- Keep pagination default at 5 items per page and preserve search/status filtering behavior.
- Replace the current dense table-only presentation with a more readable card-based desktop layout while keeping data scanability.

## Scope
- Frontend: `src/pages/Admin.tsx`, and optionally a new reusable admin component under `src/components/admin/`.
- Backend authorization alignment: VPS lifecycle routes and SSH bridge access checks.
- No route changes required (`/admin#servers` remains the entry point).

## Implementation Steps

### 1) Audit and align action parity
- Enumerate all server-related actions currently available in:
  - Admin user detail VPS list (`src/components/admin/UserVPSList.tsx`)
  - VPS detail + SSH flows (`src/pages/VPSDetail.tsx`, `src/pages/VpsSshConsole.tsx`, `src/components/VPS/SSHTerminal.tsx`)
- Build a canonical action set for admin servers cards:
  - View details (`/vps/:id`)
  - SSH (`/vps/:id/ssh`, enabled only when server status allows)
  - Boot / Shutdown / Reboot
  - Optional quick copy helpers (IP, provider id) only if consistent with existing UI patterns

### 2) Fix backend authorization gaps for true admin management
- Confirm lifecycle endpoints (`POST /api/vps/:id/{boot|shutdown|reboot}`) allow admin cross-organization access.
- Update SSH websocket ownership validation in `api/services/sshBridge.ts`:
  - Keep org-based ownership checks for non-admin users.
  - Allow admin role to connect to any `vps_instances.id` without organization restriction.
  - Preserve all existing auth + token validation and error handling semantics.
- Ensure no security regression by keeping role check explicit and least-privilege for non-admins.

### 3) Refactor `/admin#servers` UI to card-first layout
- Replace row-only rendering in `Admin.tsx` with a responsive “card table” pattern:
  - Desktop: one card per server with structured sections (identity, status, networking, plan, metadata, actions).
  - Mobile/tablet: same card blocks stacked naturally.
- Keep current filter controls (search + status) above the list.
- Preserve key data fields currently shown in table (label, status, ip, plan/spec summary, region, provider, updated).

### 4) Add full management action bar per server card
- Add clear grouped controls per server card:
  - Primary: Boot / Shutdown / Reboot
  - Secondary: View, SSH
- Apply status-aware enable/disable states and loading state per server action to avoid duplicate submits.
- Reuse existing feedback conventions (`toast`) for success/failure messaging.

### 5) Pagination behavior (default 5) and UX polish
- Keep default page size at 5.
- Reset to page 1 when filters change.
- Render pagination summary and controls below cards:
  - Previous/Next
  - Page buttons
  - “Showing X–Y of Z”
- Ensure pagination operates on filtered results, not raw list.

### 6) Code organization and cleanup
- If `Admin.tsx` grows too large, extract server rendering into a dedicated component, e.g.:
  - `src/components/admin/AdminServersManager.tsx`
- Centralize helper formatters/action-availability helpers for readability.
- Remove any dead/duplicate imports and fix lint issues introduced by refactor.

### 7) Verification checklist
- Functional checks:
  - Filters still work with card layout.
  - Pagination default is 5 and navigation works across filtered results.
  - Admin can trigger boot/shutdown/reboot from `/admin#servers`.
  - Admin can open `/vps/:id` and `/vps/:id/ssh` from cards.
- Authorization checks:
  - Admin can manage instances outside own organization.
  - Non-admin behavior remains organization-scoped.
- Stability checks:
  - Run project lint/type checks and targeted test command(s) relevant to changed files.
  - Manual UI pass on desktop and narrow viewport for card readability and button wrapping.

## Delivery Notes
- Maintain existing visual language (shadcn + Tailwind utilities already used in admin screens).
- Avoid introducing new dependencies.
- Keep all changes backward-compatible with current routes and API contract.
