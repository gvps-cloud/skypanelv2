# Tasks

- [x] Task 1: Scope admin ticket visibility
  - [x] Modify `api/routes/support.ts` to remove global admin ticket fetching in `GET /tickets`.
  - [x] Verify that `RoleService.checkPermission` correctly handles admin bypass for permission checks (so they can still see the org tickets).
