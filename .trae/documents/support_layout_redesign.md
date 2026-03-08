# Implementation Plan - Support Ticket Layout Redesign

The goal is to redesign the support ticket interface (specifically the client-side `/support` view) to utilize screen space more effectively. The new layout will move the chat interface to the left and use the empty space on the right to display a dedicated information sidebar.

## User Requirements
- **Layout**: Move chat to the left, use right side for info.
- **Content**: Display "corresponding client's account balance", "VPS in question", and "other relevant information".
- **Scope**: Primarily "client side `/support`", but applying the pattern to Admin view is logical for consistency and the "client balance" requirement strongly implies admin utility as well.

## Proposed Changes

### 1. Create `TicketInfoSidebar` Component
Create a new shared component `src/components/support/shared/TicketInfoSidebar.tsx`.
- **Props**:
    - `ticket`: The `SupportTicket` object.
    - `balance`: (Optional) The user's wallet balance (number or string).
    - `user`: (Optional) The user object (for admin view to show client details).
    - `isAdmin`: Boolean to toggle specific admin-only fields.
- **Sections**:
    - **Ticket Details**: ID, Status, Priority, Category, Dates.
    - **Related Service**: VPS Label/ID (if linked).
    - **Account Info**: Wallet Balance (displayed as "My Balance" for user, "Client Balance" for admin).
    - **Client Details** (Admin only): Name, Email.

### 2. Update `UserSupportView.tsx`
- **Data Fetching**:
    - Fetch the current user's wallet balance on mount (using `/api/payments/wallet/balance` or similar).
- **Layout Structure**:
    - Change the main content area from a single column to a flex row.
    - **Left Column (Chat)**:
        - `TicketDetailHeader` (Keep subject/status, maybe remove duplicate info if it moves to sidebar).
        - Message List (ScrollArea).
        - Reply Box.
    - **Right Column (Sidebar)**:
        - `TicketInfoSidebar` component.
        - Fixed width (e.g., `w-80` or `w-96`), border-l, background `muted/10` or similar.

### 3. Update `AdminSupportView.tsx` (Optional but recommended)
- **Data Fetching**:
    - When selecting a ticket, fetch the *creator's* balance if possible (or just display what's available).
- **Layout Structure**:
    - Apply the same 2-column layout within the detail view.
    - Pass `isAdmin={true}` to `TicketInfoSidebar`.

## Step-by-Step Implementation

1.  **Create `TicketInfoSidebar.tsx`**: Implement the sidebar UI with sections for Ticket Info, Service Info, and Account Info.
2.  **Modify `UserSupportView.tsx`**:
    - Add state for `walletBalance`.
    - Fetch balance on mount.
    - Update the JSX layout to include the sidebar.
3.  **Refine `TicketDetailHeader.tsx`** (Optional): If the header feels too cluttered with the sidebar, simplify it. (For now, I'll keep it as is or slightly adjust).

## Verification
- Check `/support` view.
- Verify the layout is split (Chat Left | Info Right).
- Verify "My Balance" is shown.
- Verify VPS info is shown if `vps_id` is present.
