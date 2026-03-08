# Retain VPS Information in Support Tickets

## Objective
Ensure that support tickets retain VPS information (label and IP) even if the associated VPS instance is deleted. Currently, the `vps_id` foreign key is set to NULL upon deletion, causing the VPS information to disappear from the ticket.

## Analysis
- **Current State**: `support_tickets` table has a `vps_id` column with `ON DELETE SET NULL`. When a VPS is deleted, the link is lost.
- **Requirement**: "Retain this info" - implies storing a snapshot of the VPS data at the time of ticket creation (or at least preserving it).
- **Solution**: Add `vps_label_snapshot` and `vps_ip_snapshot` columns to `support_tickets`. Populate these on creation. When querying, fall back to these values if the live VPS record is missing.

## Implementation Plan

### 1. Database Migration
- Create a new migration file (e.g., `migrations/011_add_vps_snapshot_to_support_tickets.sql`).
- Add columns: `vps_label_snapshot` (VARCHAR) and `vps_ip_snapshot` (INET).
- Backfill existing tickets by joining with `vps_instances` to populate snapshots for currently active links.

### 2. Backend Updates
- **User API (`api/routes/support.ts`)**:
  - **Create Ticket (`POST /tickets`)**: Fetch `label` and `ip_address` from `vps_instances` using the provided `vpsId`. Insert these values into the new snapshot columns.
  - **List Tickets (`GET /tickets`)**: Update the SQL query to select `COALESCE(vi.label, st.vps_label_snapshot) as vps_label`. This ensures we show the live label if it exists, or the snapshot if the VPS was deleted.
- **Admin API (`api/routes/admin.ts`)**:
  - **List Tickets (`GET /tickets`)**: Add a `LEFT JOIN` with `vps_instances` (which was missing) and use the same `COALESCE` logic to return `vps_label` to admins.

### 3. Frontend Updates
- **Admin View (`src/components/admin/AdminSupportView.tsx`)**:
  - Update `SupportTicket` interface to include `vps_label`.
  - Update the UI to display the VPS label in the ticket detail header (similar to the User view).
- **User View (`src/components/support/UserSupportView.tsx`)**:
  - No changes needed as it already expects `vps_label` from the API.

## Verification
- Review code changes.
- Ensure migration SQL is valid.
- Verify API logic handles both existing VPS (live data) and deleted VPS (snapshot data).
