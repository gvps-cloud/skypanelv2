# Tasks

- [x] Task 1: Update Backend Ticket Creation Logic
  - [x] SubTask 1.1: Modify `POST /api/support/tickets` in `api/routes/support.ts` to extract `organizationId` from request body.
  - [x] SubTask 1.2: Implement validation logic to check if user is a member of the provided `organizationId` and has `tickets_create` permission.
  - [x] SubTask 1.3: Ensure the ticket is inserted with the correct `organizationId`.

- [x] Task 2: Update Frontend Ticket Creation UI
  - [x] SubTask 2.1: Update `CreateTicketDialog.tsx` to fetch the user's organizations (using `/api/organizations` or similar).
  - [x] SubTask 2.2: Add an Organization selector (Select/Dropdown) to the form.
  - [x] SubTask 2.3: Filter the organization list to only show orgs where the user has ticket creation permissions.
  - [x] SubTask 2.4: Pass the selected `organizationId` to the `onSubmit` handler.

- [x] Task 3: Integrate Frontend and Backend
  - [x] SubTask 3.1: Update `UserSupportView.tsx`'s `handleCreateTicket` to include `organizationId` in the API payload.
  - [x] SubTask 3.2: Verify that creating a ticket for a different organization works correctly (ticket appears in that org's list).
