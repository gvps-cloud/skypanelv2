# Tasks

- [x] Task 1: Create database schema for invitations and permissions
  - [x] SubTask 1.1: Create migration for `organization_invitations` table
  - [x] SubTask 1.2: Create migration for `organization_roles` table
  - [x] SubTask 1.3: Create migration for `activity_feed` table
  - [x] SubTask 1.4: Create migration to add `role_id` column to `organization_members`
  - [x] SubTask 1.5: Create seed data for predefined permissions and default roles

- [x] Task 2: Implement invitation backend API
  - [x] SubTask 2.1: Create invitation service layer in `api/services/invitations.ts`
  - [x] SubTask 2.2: Implement `POST /api/organizations/:id/members/invite` endpoint
  - [x] SubTask 2.3: Implement `POST /api/organizations/invitations/:token/accept` endpoint
  - [x] SubTask 2.4: Implement `POST /api/organizations/invitations/:token/decline` endpoint
  - [x] SubTask 2.5: Implement `GET /api/organizations/:id/invitations` endpoint
  - [x] SubTask 2.6: Implement `DELETE /api/organizations/invitations/:id` endpoint

- [x] Task 3: Implement email notification system
  - [x] SubTask 3.1: Create email service in `api/services/email.ts`
  - [x] SubTask 3.2: Create invitation email template
  - [x] SubTask 3.3: Integrate email sending into invitation creation flow
  - [x] SubTask 3.4: Test email sending functionality

- [x] Task 4: Implement activity feed system
  - [x] SubTask 4.1: Create activity feed service in `api/services/activityFeed.ts`
  - [x] SubTask 4.2: Implement `POST /api/activities` endpoint to create activity entries
  - [x] SubTask 4.3: Implement `GET /api/activities` endpoint to retrieve user activities
  - [x] SubTask 4.4: Add activity creation triggers in invitation flow
  - [x] SubTask 4.5: Add activity creation triggers in member join/leave flow

- [x] Task 5: Implement granular role management backend
  - [x] SubTask 5.1: Create role service in `api/services/roles.ts`
  - [x] SubTask 5.2: Implement permission checking middleware
  - [x] SubTask 5.3: Implement `POST /api/organizations/:id/roles` endpoint to create custom roles
  - [x] SubTask 5.4: Implement `GET /api/organizations/:id/roles` endpoint to list roles
  - [x] SubTask 5.5: Implement `PUT /api/organizations/:id/roles/:roleId` endpoint to update roles
  - [x] SubTask 5.6: Implement `DELETE /api/organizations/:id/roles/:roleId` endpoint to delete roles
  - [x] SubTask 5.7: Update member endpoints to use role_id instead of role string

- [x] Task 6: Update VPS and ticket APIs to respect permissions
  - [x] SubTask 6.1: Add permission checks to VPS endpoints (list, create, update, delete)
  - [x] SubTask 6.1a: Add permission checks to billing endpoints (wallet transactions, summary, uptime)
  - [x] SubTask 6.2: Add permission checks to ticket endpoints (list, create, update, delete)
  - [x] SubTask 6.3: Update VPS list endpoint to include organization VPSs for authorized users
  - [x] SubTask 6.4: Update ticket list endpoint to include organization tickets for authorized users

- [x] Task 7: Create organization management page UI
  - [x] SubTask 7.1: Create `src/pages/Organizations.tsx` page component
  - [x] SubTask 7.2: Create organization list view with statistics
  - [x] SubTask 7.3: Create organization detail view with resource list
  - [x] SubTask 7.4: Add organization filter component
  - [x] SubTask 7.5: Add route for `/organizations` in `src/App.tsx`

- [x] Task 8: Update Team Management UI for invitations and roles
  - [x] SubTask 8.1: Update `src/pages/settings/Team.tsx` to show pending invitations
  - [x] SubTask 8.2: Add "Invite Member" modal with role selection
  - [x] SubTask 8.3: Add invitation management actions (cancel)
  - [x] SubTask 8.4: Add role management UI (create/edit/delete custom roles)
  - [x] SubTask 8.5: Update member list to show custom roles
  - [x] SubTask 8.6: Add permission checkboxes for custom role creation

- [x] Task 9: Create activity feed UI
  - [x] SubTask 9.1: Create `src/components/ActivityFeed.tsx` component
  - [x] SubTask 9.2: Add activity feed to navigation or header
  - [x] SubTask 9.3: Implement activity item display with accept/decline buttons for invitations
  - [x] SubTask 9.4: Add mark as read functionality
  - [x] SubTask 9.5: Add unread count badge

- [x] Task 10: Update VPS and ticket UIs for organization resources
  - [x] SubTask 10.1: Update VPS list to show organization VPSs
  - [x] SubTask 10.2: Add organization badge to VPS items
  - [x] SubTask 10.3: Add VPS filter by organization/personal/all
  - [x] SubTask 10.4: Update ticket list to show organization tickets
  - [x] SubTask 10.5: Add organization badge to ticket items
  - [x] SubTask 10.6: Add ticket filter by organization/personal/all

- [x] Task 11: Create invitation acceptance flow UI
  - [x] SubTask 11.1: Create `src/pages/AcceptInvitation.tsx` page
  - [x] SubTask 11.2: Handle invitation token validation
  - [x] SubTask 11.3: Show invitation details with accept/decline options
  - [x] SubTask 11.4: Add success/error states
  - [x] SubTask 11.5: Add route for `/organizations/invitations/:token`

- [x] Task 12: Fix database migration order
  - [x] SubTask 12.1: Remove duplicate migration files
  - [x] SubTask 12.2: Ensure roles migration runs before invitations migration
  - [x] SubTask 12.3: Verify migration runs successfully

- [x] Task 13: Fix organization system issues
  - [x] SubTask 13.1: Fix VPS visibility (users should not see other users' VPS)
  - [x] SubTask 13.1a: Fix billing page privacy (admins/users should not see data from other organizations)
  - [x] SubTask 13.2: Fix `/organizations` page display (ensure data loads correctly)
  - [x] SubTask 13.3: Fix email invitation joining flow
  - [x] SubTask 13.4: Fix `/settings` page invitation management

# Task Dependencies
- Task 2 depends on Task 1 (Database schema required for invitation API)
- Task 3 depends on Task 2 (Invitation API required for email notifications)
- Task 4 depends on Task 2 (Invitation API required for activity feed)
- Task 5 depends on Task 1 (Database schema required for role management)
- Task 6 depends on Task 5 (Role management required for permission checks)
- Task 7 depends on Task 6 (Permission checks required for organization page)
- Task 8 depends on Task 2 and Task 5 (Invitation API and role management required)
- Task 9 depends on Task 4 (Activity feed API required for UI)
- Task 10 depends on Task 6 (Permission checks required for resource visibility)
- Task 11 depends on Task 2 (Invitation API required for acceptance flow)
