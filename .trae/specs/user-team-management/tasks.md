# Tasks

- [x] Task 1: Create organization management backend API
  - [x] SubTask 1.1: Create `api/routes/organizations.ts` with endpoints for listing, adding, removing, and updating members.
  - [x] SubTask 1.2: Implement `GET /:id/members` to list organization members.
  - [x] SubTask 1.3: Implement `POST /:id/members` to add existing user by email.
  - [x] SubTask 1.4: Implement `DELETE /:id/members/:userId` to remove member.
  - [x] SubTask 1.5: Implement `PUT /:id/members/:userId` to update member role.
  - [x] SubTask 1.6: Register new route in `api/app.ts`.

- [x] Task 2: Create frontend Team Management UI
  - [x] SubTask 2.1: Create `src/pages/settings/Team.tsx` component.
  - [x] SubTask 2.2: Add "Team" tab to `src/components/layout/SettingsLayout.tsx`.
  - [x] SubTask 2.3: Update `src/App.tsx` to include `/settings/team` route.
  - [x] SubTask 2.4: Implement member list view with "Add Member" button.
  - [x] SubTask 2.5: Implement "Add Member" modal with email input and role selection.
  - [x] SubTask 2.6: Implement "Remove Member" and "Change Role" actions in the list.

# Task Dependencies
- Task 2 depends on Task 1 (Backend API required for frontend implementation)
