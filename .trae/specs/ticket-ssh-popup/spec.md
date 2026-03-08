# Ticket Sidebar SSH Popup Spec

## Why
The current implementation of the SSH button in the ticket sidebar opens a new browser window, which is inconsistent with the rest of the application (specifically the `/admin#servers` page) and provides a disjointed user experience. The user requested a "popup" style consistent with the admin server list.

## What Changes
- Modify `src/components/support/shared/TicketInfoSidebar.tsx` to replace the `window.open` logic with a `Dialog` (modal) component.
- The `Dialog` will contain the `SSHTerminal` component, providing an embedded SSH console.
- The styling of the `Dialog` will match the implementation in `src/pages/Admin.tsx` (dark theme, specific dimensions, header with server ID).

## Impact
- **Affected Specs**: None directly, but UI consistency is improved.
- **Affected Code**: `src/components/support/shared/TicketInfoSidebar.tsx`.

## ADDED Requirements
### Requirement: Embedded SSH Console
The system SHALL provide an embedded SSH console within a modal dialog when the admin clicks the "SSH" button in the ticket sidebar.

#### Scenario: Open SSH Console
- **WHEN** an admin clicks the "SSH" button in the ticket sidebar
- **THEN** a modal dialog opens containing the SSH terminal for the linked VPS.
- **AND** the modal has a header displaying the server ID.
- **AND** the terminal fits within the modal content area.

## MODIFIED Requirements
### Requirement: SSH Button Action
**Old Behavior**: Opens a new browser window/tab.
**New Behavior**: Opens a modal dialog within the current page.

## REMOVED Requirements
### Requirement: New Window for SSH
**Reason**: Replaced by modal dialog for better UX and consistency.
