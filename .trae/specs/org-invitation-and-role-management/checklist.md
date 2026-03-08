- [x] Backend: VPS endpoints strictly enforce organization boundaries
- [x] Frontend: Organizations page displays correct data for joined organizations
- [x] Backend: Invitation acceptance flow works correctly for new and existing users
- [x] Frontend: Settings page displays invitations correctly
- [x] Database: Migration 012 and 013 run successfully in correct order
- [x] Database: `organization_invitations` table created with all required fields
- [x] Database: `organization_roles` table created with permissions JSON field
- [x] Database: `activity_feed` table created with user and organization references
- [x] Database: `organization_members.role_id` column added
- [x] Database: Predefined permissions and default roles seeded

- [x] Backend: Invitation service creates invitations with tokens and expiration
- [x] Backend: Invitation endpoint sends email notifications
- [x] Backend: Invitation acceptance endpoint validates token and adds member
- [x] Backend: Invitation decline endpoint marks invitation as declined
- [x] Backend: Pending invitations list endpoint returns correct data
- [x] Backend: Cancel invitation endpoint marks invitation as cancelled

- [x] Backend: Email service sends invitation emails with correct links
- [x] Backend: Email template includes organization name and inviter details
- [x] Backend: Email includes accept and decline links

- [x] Backend: Activity feed service creates entries for invitation events
- [x] Backend: Activity entries created when user is invited
- [x] Backend: Activity entries created when invitation is accepted
- [x] Backend: Activity entries created when invitation is declined
- [x] Backend: Activity feed API returns user's activities
- [x] Backend: Activities can be marked as read

- [x] Backend: Role service creates custom roles with permissions
- [x] Backend: Permission checking middleware denies unauthorized access
- [x] Backend: Predefined roles created with correct permission sets
- [x] Backend: Custom role endpoints work correctly
- [x] Backend: Member role updates use role_id

- [x] Backend: VPS endpoints check user permissions
- [x] Backend: Ticket endpoints check user permissions
- [x] Backend: VPS list includes organization VPSs for authorized users
- [x] Backend: Ticket list includes organization tickets for authorized users

- [x] Frontend: Organizations page displays all user's organizations
- [x] Frontend: Organizations page shows user's role in each organization
- [x] Frontend: Organizations page displays resource statistics
- [x] Frontend: Organization detail view shows accessible resources
- [x] Frontend: Organization filter works correctly
- [x] Frontend: Cross-organization resource view groups by organization

- [x] Frontend: Team page shows pending invitations
- [x] Frontend: Invite member modal works with role selection
- [x] Frontend: Cancel invitation action works
- [x] Frontend: Role management UI allows creating custom roles
- [x] Frontend: Permission checkboxes work in role creation
- [x] Frontend: Member list shows custom roles

- [x] Frontend: Activity feed component displays activities
- [x] Frontend: Activity feed shows accept/decline buttons for invitations
- [x] Frontend: Unread count badge shows correct number
- [x] Frontend: Mark as read functionality works

- [x] Frontend: VPS list shows organization VPSs
- [x] Frontend: VPS items show organization badge
- [x] Frontend: VPS filter by organization/personal/all works
- [x] Frontend: Ticket list shows organization tickets
- [x] Frontend: Ticket items show organization badge
- [x] Frontend: Ticket filter by organization/personal/all works

- [x] Frontend: Invitation acceptance page validates token
- [x] Frontend: Invitation acceptance page shows invitation details
- [x] Frontend: Accept invitation action works and redirects
- [x] Frontend: Decline invitation action works
- [x] Frontend: Error states display correctly for invalid/expired invitations
