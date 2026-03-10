# Organization Based Ticket Support Spec

## Why
Currently, support tickets are created within the user's active organization context, which makes it difficult for users to create tickets for other organizations they belong to without switching their global context. Users perceive the system as "per user" rather than "organization/team based". This change aims to allow users to explicitly select the organization when creating a ticket, enabling them to file support requests on behalf of any team they have permissions for.

## What Changes
- **Backend**:
  - Update `POST /api/support/tickets` to accept an optional `organizationId` in the request body.
  - If `organizationId` is provided, validate that the user is a member of that organization and has `tickets_create` permission within it.
  - If validated, create the ticket under the specified `organizationId` instead of the user's current active organization.
  - If `organizationId` is NOT provided, fallback to the existing behavior (use `req.user.organizationId`).

- **Frontend**:
  - Update `CreateTicketDialog` to fetch and display a list of organizations the user belongs to.
  - Add an "Organization" dropdown selector to the ticket creation form.
    - Default value: Current active organization.
    - Options: All organizations where the user has `tickets_create` permission.
  - Update `UserSupportView` to pass the selected `organizationId` to the API when creating a ticket.

## Impact
- **Affected specs**: None directly, but enhances `user-team-management` capabilities.
- **Affected code**:
  - `api/routes/support.ts` (Ticket creation logic)
  - `src/components/support/shared/CreateTicketDialog.tsx` (UI for creation)
  - `src/components/support/UserSupportView.tsx` (API integration)

## ADDED Requirements
### Requirement: Multi-Organization Ticket Creation
The system SHALL allow users to select any organization they are a member of (with `tickets_create` permission) when creating a support ticket.

#### Scenario: User creates ticket for a different organization
- **GIVEN** a user is a member of "Org A" and "Org B"
- **AND** the user is currently in the context of "Org A"
- **WHEN** the user opens the "Create Ticket" dialog
- **AND** selects "Org B" from the organization dropdown
- **AND** submits the ticket
- **THEN** the ticket is created under "Org B"
- **AND** the ticket is visible to other members of "Org B" (with view permissions)

## MODIFIED Requirements
### Requirement: Ticket Creation API
The `POST /api/support/tickets` endpoint SHALL accept an optional `organizationId` field.
- If provided, it MUST supersede the authenticated user's active organization context.
- The system MUST verify the user's membership and permissions in the *target* organization.
