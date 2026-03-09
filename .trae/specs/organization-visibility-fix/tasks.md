# Tasks

- [x] Task 1: Update Organization List Visibility
  - [x] SubTask 1.1: Modify `GET /` endpoint in `api/routes/organizations.ts` to remove the special logic for admins that fetches all organizations.
  - [x] SubTask 1.2: Ensure admins use the same query logic as regular users (filtering by `organization_members`).

- [x] Task 2: Update Organization Resource Visibility and Permissions
  - [x] SubTask 2.1: Modify `GET /resources` endpoint in `api/routes/organizations.ts` to remove the special logic for admins that fetches all resources.
  - [x] SubTask 2.2: Ensure admins use the same query logic as regular users (filtering by `organization_members`).
  - [x] SubTask 2.3: Update permission logic in `GET /resources` to grant `vps_view` and `tickets_view` permissions to users with the 'member' legacy role.

- [x] Task 3: Update Access Control Middleware
  - [x] SubTask 3.1: Modify `requireOrgAccess` middleware in `api/routes/organizations.ts` to remove the system admin bypass (`if (user.role === 'admin')`).
  - [x] SubTask 3.2: Ensure system admins must be members of an organization to access its details via user-facing endpoints.

# Task Dependencies
- Task 2 depends on Task 1 (logically, to ensure consistent visibility).
- Task 3 depends on Task 1 (to ensure consistent access control).
