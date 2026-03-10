# Fix Admin Ticket Visibility Spec

## Why
Currently, System Admins see **ALL** support tickets from **ALL** organizations when visiting the `/support` page, regardless of their current active organization context. This creates a confusing user experience where tickets from Organization B appear while the admin is ostensibly operating within Organization A. The user expectation is that the `/support` page should show tickets relevant to the currently active organization.

## What Changes
- **Backend**:
  - Modify `GET /api/support/tickets` in `api/routes/support.ts`.
  - Remove the special logic that returns all global tickets if `user.role === 'admin'`.
  - Ensure System Admins use the standard organization-scoped query path.
  - Rely on `RoleService.checkPermission` (which already grants full permissions to admins) to authorize the request, but scope the database query to `req.user.organizationId`.

## Impact
- **Affected specs**: None.
- **Affected code**: `api/routes/support.ts`.
- **User Experience**:
  - System Admins will now only see tickets for their currently active organization on the Support page.
  - To view all tickets globally, System Admins should use the Admin Panel (which uses `/api/admin/tickets`).

## ADDED Requirements
### Requirement: Scoped Ticket Visibility for Admins
The system SHALL restrict the `/api/support/tickets` endpoint to return only tickets belonging to the authenticated user's current active organization, even if the user is a System Admin.

#### Scenario: Admin Views Organization Tickets
- **GIVEN** a System Admin is active in "Org A"
- **WHEN** they visit the Support page (calling `/api/support/tickets`)
- **THEN** they should ONLY see tickets belonging to "Org A"
- **AND** they should NOT see tickets from "Org B"

## MODIFIED Requirements
### Requirement: Ticket Listing API
The `GET /api/support/tickets` endpoint SHALL always filter results by `organization_id`.
- **Old Behavior**: If user is admin, return all tickets.
- **New Behavior**: Always filter by `req.user.organizationId`, regardless of role.
