# Organization Invitation and Role Management Spec

## Why
The current team management system lacks essential features for real-world collaboration: users receive no notification when invited to join organizations, there's no granular permission system, and users cannot view all their organizational resources in one place. This prevents effective team collaboration and resource management.

## What Changes
- Add email notification system for organization invitations
- Add activity feed notifications for invitation events
- Implement fine-grained role-based permission system with granular permissions
- Create dedicated organization management page for cross-organization resource visibility
- Update database schema to support invitations and granular permissions
- Add invitation acceptance/decline flow

## Impact
- **Affected specs**: user-team-management (extends existing functionality)
- **Affected code**: `api/routes/organizations.ts`, database schema, frontend organization pages, notification system

## ADDED Requirements
### Requirement: Email Notifications
The system SHALL send email notifications when users are invited to organizations.

#### Scenario: Send Invitation Email
- **WHEN** organization owner/admin invites a user by email
- **THEN** send invitation email to the invited user
- **AND** email contains invitation link with token
- **AND** email includes organization name and inviter details
- **AND** email provides options to accept or decline

#### Scenario: Accept Invitation via Email Link
- **WHEN** invited user clicks accept link in email
- **THEN** user is added to organization with specified role
- **AND** invitation is marked as accepted
- **AND** redirect to organization page

#### Scenario: Decline Invitation via Email Link
- **WHEN** invited user clicks decline link in email
- **THEN** invitation is marked as declined
- **AND** organization owner is notified of decline

### Requirement: Activity Feed Notifications
The system SHALL display organization invitation events in activity feed.

#### Scenario: Invitation Created Notification
- **WHEN** user is invited to organization
- **THEN** create activity feed entry for both inviter and invitee
- **AND** notification shows "You have been invited to join [Org Name]"
- **AND** notification includes accept/decline action buttons

#### Scenario: Invitation Accepted Notification
- **WHEN** invited user accepts invitation
- **THEN** create activity feed entry for organization members
- **AND** notification shows "[User Name] has joined [Org Name]"

#### Scenario: Invitation Declined Notification
- **WHEN** invited user declines invitation
- **THEN** create activity feed entry for organization owner
- **AND** notification shows "[User Name] declined invitation to [Org Name]"

### Requirement: Granular Role-Based Permissions
The system SHALL support fine-grained permissions for organization roles.

#### Scenario: Define Permission Categories
- **WHEN** system initializes roles
- **THEN** define permissions for: `vps_view`, `vps_create`, `vps_delete`, `vps_manage`, `tickets_view`, `tickets_create`, `tickets_manage`, `billing_view`, `billing_manage`, `members_manage`, `settings_manage`

#### Scenario: Create Custom Roles
- **WHEN** organization owner/admin creates a custom role
- **THEN** allow selecting specific permissions from available categories
- **AND** save role with assigned permissions
- **AND** role can be assigned to organization members

#### Scenario: Predefined Roles
- **WHEN** system initializes
- **THEN** create predefined roles with permission sets:
  - `owner`: All permissions
  - `admin`: All except billing_manage and members_manage
  - `vps_manager`: vps_view, vps_create, vps_manage
  - `support_agent`: tickets_view, tickets_create, tickets_manage
  - `viewer`: vps_view, tickets_view, billing_view

#### Scenario: Enforce Permissions
- **WHEN** user attempts action on organization resource
- **THEN** check user's role permissions for that resource type
- **AND** allow action if user has required permission
- **AND** deny action with appropriate error message if not authorized

### Requirement: Invitation System
The system SHALL maintain pending invitations and track their status.

#### Scenario: Create Pending Invitation
- **WHEN** organization owner/admin invites user by email
- **THEN** create invitation record with status "pending"
- **AND** generate unique invitation token
- **AND** set expiration time (e.g., 7 days)
- **AND** store inviter, organization, role, and invited email

#### Scenario: List Pending Invitations
- **WHEN** organization owner/admin views team management
- **THEN** display list of pending invitations
- **AND** show invited email, role, invitation date, and expiration
- **AND** provide option to cancel invitation

#### Scenario: Cancel Pending Invitation
- **WHEN** organization owner/admin cancels invitation
- **THEN** mark invitation as "cancelled"
- **AND** prevent acceptance of cancelled invitations

#### Scenario: Invitation Expiration
- **WHEN** invitation expiration time passes
- **THEN** mark invitation as "expired"
- **AND** prevent acceptance of expired invitations

### Requirement: Organization Resource Management Page
The system SHALL provide a dedicated page for users to manage all organizational resources they have access to.

#### Scenario: View All Organizations
- **WHEN** user navigates to /organizations
- **THEN** display list of all organizations user belongs to
- **AND** show user's role in each organization
- **AND** show organization statistics (VPS count, ticket count, etc.)

#### Scenario: Filter Resources by Organization
- **WHEN** user selects an organization from the list
- **THEN** display all resources user can access in that organization
- **AND** respect user's role permissions for each resource type
- **AND** show only resources user has permission to view

#### Scenario: Cross-Organization Resource View
- **WHEN** user selects "All Organizations" view
- **THEN** display all resources across all organizations
- **AND** group resources by organization
- **AND** show which organization each resource belongs to
- **AND** indicate user's permission level for each resource

#### Scenario: Resource Quick Actions
- **WHEN** user views organization resource
- **THEN** show action buttons based on user's permissions
- **AND** hide actions user doesn't have permission for

### Requirement: VPS Resource Visibility
The system SHALL allow organization VPSs to be visible to members with appropriate permissions.

#### Scenario: VPS Appears in Member Account
- **WHEN** user has `vps_view` permission in organization
- **THEN** organization VPSs appear in user's VPS list
- **AND** show organization badge/label for organizational VPSs
- **AND** differentiate from personal VPSs

#### Scenario: Filter VPSs by Organization
- **WHEN** user views VPS list
- **THEN** provide filter to show only personal VPSs, only organizational VPSs, or all VPSs
- **AND** maintain filter selection across page navigation

#### Scenario: VPS Permission Check
- **WHEN** user attempts VPS action (start, stop, delete, etc.)
- **THEN** check user's VPS permissions in VPS's organization
- **AND** allow action if user has `vps_manage` permission
- **AND** allow view-only actions if user has `vps_view` permission

#### Bugfix: Prevent Admin Global Visibility
- **WHEN** an admin user views uptime or billing data
- **THEN** the results are scoped only to the organization the admin is currently acting within (or to their personal resources)
- **AND** admins no longer see VPS uptime or transactions from unrelated organizations or users
- **AND** if the admin has no organization context, the endpoints return only personal VPSs/transactions or a 403 if access is not allowed

#### Requirement: Billing Permission Enforcement
- **WHEN** a member requests organization wallet transactions or a billing summary
- **THEN** the system checks for the `billing_view` permission on the user's role
- **AND** only users granted `billing_view` (typically owners) may see organization-wide data
- **AND** requests from members without this permission are rejected with a 403 error

### Requirement: Ticket Resource Visibility
The system SHALL allow organization support tickets to be visible to members with appropriate permissions.

#### Scenario: Tickets Appear in Member Account
- **WHEN** user has `tickets_view` permission in organization
- **THEN** organization tickets appear in user's ticket list
- **AND** show organization badge/label for organizational tickets
- **AND** differentiate from personal tickets

#### Scenario: Ticket Permission Check
- **WHEN** user attempts ticket action (create, update, close, etc.)
- **THEN** check user's ticket permissions in ticket's organization
- **AND** allow action if user has appropriate ticket permission

## MODIFIED Requirements
### Requirement: Enhanced Team Management API
The existing team management API SHALL be extended to support invitations and granular permissions.

#### Scenario: Invite Member with Email
- **WHEN** authenticated owner/admin requests `POST /api/organizations/:id/members/invite` with `{ email, role }`
- **THEN** create pending invitation
- **AND** send invitation email
- **AND** create activity feed notification
- **AND** return invitation details

#### Scenario: Accept Invitation
- **WHEN** user requests `POST /api/organizations/invitations/:token/accept`
- **THEN** verify invitation token is valid and not expired
- **AND** add user to organization with specified role
- **AND** mark invitation as accepted
- **AND** create activity feed notification
- **AND** redirect to organization page

#### Scenario: Decline Invitation
- **WHEN** user requests `POST /api/organizations/invitations/:token/decline`
- **THEN** mark invitation as declined
- **AND** create activity feed notification for organization owner
- **AND** return success message

#### Scenario: List Pending Invitations
- **WHEN** authenticated owner/admin requests `GET /api/organizations/:id/invitations`
- **THEN** return list of pending invitations
- **AND** include invited email, role, created date, expiration

#### Scenario: Cancel Invitation
- **WHEN** authenticated owner/admin requests `DELETE /api/organizations/invitations/:id`
- **THEN** mark invitation as cancelled
- **AND** prevent further acceptance
- **AND** return success message

#### Scenario: Manage Roles
- **WHEN** authenticated owner/admin requests `POST /api/organizations/:id/roles` with `{ name, permissions }`
- **THEN** create custom role with specified permissions
- **AND** return role details

#### Scenario: Update Member Role
- **WHEN** authenticated owner/admin requests `PUT /api/organizations/:id/members/:userId/role` with `{ roleId }`
- **THEN** update user's role in organization
- **AND** verify role exists in organization
- **AND** return updated member details

## REMOVED Requirements
### Requirement: Direct Member Addition
**Reason**: Directly adding users without invitation flow is being replaced with proper invitation system that includes email notifications and acceptance flow.

**Migration**: Existing direct member addition endpoint will be deprecated but kept for backward compatibility. New invitations should use the invitation flow.

## Database Schema Changes
### New Tables
- `organization_invitations`: id, organization_id, invited_email, role_id, inviter_id, token, status, expires_at, created_at, updated_at
- `organization_roles`: id, organization_id, name, permissions (json), is_custom, created_at, updated_at
- `organization_permissions`: predefined permission categories and descriptions
- `activity_feed`: id, user_id, organization_id, type, title, description, data (json), is_read, created_at

### Modified Tables
- `organization_members`: add `role_id` column (nullable, default to default role)
