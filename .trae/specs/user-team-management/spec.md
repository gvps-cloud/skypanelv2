# User Team Management Spec

## Why
Users currently cannot manage their own organizations (teams). They are locked into a single-user organization created at signup. This prevents collaboration and multi-user management of resources.

## What Changes
- Create a new API route `api/routes/organizations.ts` to handle organization member management.
- Create a new frontend page `src/pages/settings/Team.tsx` to display and manage team members.
- Update `api/app.ts` to register the new route.
- Update `src/App.tsx` and `src/components/layout/SettingsLayout.tsx` to expose the new Team settings page.

## Impact
- **Affected specs**: None (new feature)
- **Affected code**: `api/app.ts`, `src/App.tsx`, `src/components/layout/SettingsLayout.tsx`

## ADDED Requirements
### Requirement: Team Management API
The system SHALL provide endpoints for Organization Owners and Admins to manage team members.

#### Scenario: List Members
- **WHEN** authenticated user requests `GET /api/organizations/:id/members`
- **THEN** return list of members with their roles
- **AND** verify user belongs to the organization

#### Scenario: Add Member
- **WHEN** authenticated owner/admin requests `POST /api/organizations/:id/members` with `{ email, role }`
- **THEN** add user to organization if they exist
- **AND** return success message
- **AND** fail if user does not exist (MVP)

#### Scenario: Remove Member
- **WHEN** authenticated owner/admin requests `DELETE /api/organizations/:id/members/:userId`
- **THEN** remove user from organization
- **AND** prevent removing the last owner

#### Scenario: Update Role
- **WHEN** authenticated owner/admin requests `PUT /api/organizations/:id/members/:userId` with `{ role }`
- **THEN** update user role
- **AND** prevent downgrading self if last owner

### Requirement: Team Management UI
The system SHALL provide a "Team" tab in user settings.

#### Scenario: View Team
- **WHEN** user clicks "Team" in settings
- **THEN** display list of members in a table/card layout
- **AND** show "Add Member" button if user has permission

#### Scenario: Manage Members
- **WHEN** user clicks "Add Member"
- **THEN** show modal to enter email and select role
- **WHEN** user clicks "Remove" on a member
- **THEN** show confirmation dialog and remove member
