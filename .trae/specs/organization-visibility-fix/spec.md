# Organization Visibility and Permissions Spec

## Why
Currently, there are two main issues with the `/organizations` page:
1.  **Member Resource Visibility**: Users who are members of an organization (legacy 'member' role) cannot see resources (VPSs, Tickets) because they lack the necessary permissions in the API response.
2.  **Admin Organization Visibility**: System Admins currently see *all* organizations on the platform in their dashboard, even those they are not members of. The requirement is that Admins should only see organizations they have explicitly joined or been invited to, treating them like regular users in this context.

## What Changes

### Backend (`api/routes/organizations.ts`)

-   **Modify `GET /` Endpoint**:
    -   Remove the special logic that fetches *all* organizations if the user is a system admin.
    -   Admins will now use the same logic as regular users: fetching only organizations where they have a membership record in `organization_members`.
    -   **BREAKING**: System admins will no longer see all organizations in their personal dashboard. They must use the Admin Panel for platform management.

-   **Modify `GET /resources` Endpoint**:
    -   Remove the special logic that fetches resources for *all* organizations if the user is a system admin.
    -   Admins will now use the same logic as regular users: fetching resources only for organizations they are members of.
    -   **Update Permission Logic**:
        -   Add support for the legacy 'member' role in the permission fallback logic.
        -   Grant `vps_view` and `tickets_view` permissions to users with the 'member' legacy role.
        -   This ensures that invited members can see the resources of the organization they joined.

-   **Modify `requireOrgAccess` Middleware**:
    -   Remove the system admin bypass (`if (user.role === 'admin') return next()`).
    -   System admins will require explicit membership in an organization to access its details via these user-facing endpoints.
    -   **Note**: Platform management should continue to use dedicated `/api/admin` endpoints which are unaffected by this change.

## Impact
-   **Affected Specs**: None directly, but changes the behavior of Organization Management.
-   **Affected Code**: `api/routes/organizations.ts`.
-   **User Experience**:
    -   Regular members will now see VPSs and Tickets in organizations they joined.
    -   System Admins will have a cleaner dashboard showing only their relevant organizations.

## ADDED Requirements
### Requirement: Member Visibility
The system SHALL allow users with the 'member' role to view VPS instances and Support Tickets within the organization.

#### Scenario: Member Views Resources
-   **WHEN** a user with 'member' role visits `/organizations`
-   **THEN** they should see the organization in the list
-   **AND** they should see the VPS instances and Tickets associated with that organization in the "Cross-Organization Resources" section.

## MODIFIED Requirements
### Requirement: Admin Dashboard Visibility
The system SHALL restrict the `/organizations` list for System Admins to only show organizations they are members of.

#### Scenario: Admin Views Organizations
-   **WHEN** a System Admin visits `/organizations`
-   **THEN** they should ONLY see organizations they have created or been invited to.
-   **AND** they should NOT see other users' organizations that they are not a member of.
