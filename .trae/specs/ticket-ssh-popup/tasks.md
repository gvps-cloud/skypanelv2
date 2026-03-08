# Tasks

- [ ] Task 1: Replace SSH button logic with a modal dialog in `TicketInfoSidebar.tsx`.
  - [ ] SubTask 1.1: Import `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` from `@/components/ui/dialog` and `SSHTerminal` from `@/components/VPS/SSHTerminal`.
  - [ ] SubTask 1.2: Add state `isSSHOpen` to control the modal visibility.
  - [ ] SubTask 1.3: Update `handleSSHClick` to toggle `isSSHOpen` instead of `window.open`.
  - [ ] SubTask 1.4: Implement the `Dialog` component within `TicketInfoSidebar.tsx` matching the structure and styling from `src/pages/Admin.tsx` (using `max-w-[90vw]`, `h-[80vh]`, `bg-black`, etc.).
  - [ ] SubTask 1.5: Verify the SSH terminal opens correctly and displays the server ID in the header.

# Task Dependencies
- Task 1 is self-contained and only modifies one file.
