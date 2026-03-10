# Support Tickets Organization Filter Fix - Bugfix Design

## Overview

The support tickets page currently displays tickets from all organizations that a user belongs to, rather than filtering to show only tickets for the currently active organization context. This bug occurs because:

1. The backend API endpoint `/api/support/tickets` correctly filters by `organizationId` from the JWT token for non-admin users with `tickets_view` permission
2. However, when a user switches organizations using `switchOrganization()`, the frontend does not invalidate or refetch the tickets list
3. The frontend `UserSupportView` component fetches tickets once on mount via `useEffect` with `authHeader` as the only dependency, but `authHeader` doesn't change when the organization context changes (only the token payload changes)
4. This results in stale cached tickets from the previous organization being displayed

The fix requires making the frontend tickets list reactive to organization context changes by adding the user's `organizationId` as a dependency to the fetch effect.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when a user who belongs to multiple organizations switches from one organization to another
- **Property (P)**: The desired behavior - tickets list should automatically refresh and display only tickets for the newly selected organization
- **Preservation**: Existing admin behavior (seeing all tickets), ticket creation, permission-based filtering, and SSE real-time updates must remain unchanged
- **fetchTickets**: The function in `UserSupportView.tsx` that fetches tickets from `/api/support/tickets`
- **organizationId**: The property in the user object (from AuthContext) that determines the currently active organization context
- **switchOrganization**: The AuthContext function that changes the user's active organization and updates the JWT token

## Bug Details

### Bug Condition

The bug manifests when a user who belongs to multiple organizations switches from one organization to another. The `fetchTickets` function is called only once on component mount and does not re-execute when the organization context changes, causing stale tickets from the previous organization to remain displayed.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { userAction: string, userOrganizations: string[], currentOrgId: string, previousOrgId: string }
  OUTPUT: boolean
  
  RETURN input.userAction == 'switchOrganization'
         AND input.userOrganizations.length > 1
         AND input.currentOrgId != input.previousOrgId
         AND ticketsListNotRefreshed()
END FUNCTION
```

### Examples

- User belongs to Organization A and Organization B
- User views support tickets while in Organization A context (sees tickets T1, T2 from Org A)
- User switches to Organization B using the organization switcher
- Expected: Tickets list refreshes and shows only tickets from Organization B
- Actual: Tickets list still shows T1, T2 from Organization A (stale data)

- User belongs to Organization X, Y, and Z
- User creates a new ticket while in Organization Y context
- User switches to Organization Z
- Expected: New ticket is not visible (belongs to Org Y), only Org Z tickets shown
- Actual: New ticket from Org Y is still visible along with old cached tickets

- User switches from Organization A to Organization B and back to Organization A
- Expected: Each switch triggers a fresh fetch of tickets for the selected organization
- Actual: Cached tickets from the first Organization A view persist through all switches

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Admin users must continue to see all tickets across all organizations (no organization filtering)
- Non-admin users with `tickets_view` permission must continue to see all tickets within their current organization
- Non-admin users without `tickets_view` permission must continue to see only tickets they personally created
- Ticket creation must continue to associate tickets with the currently active organization context
- Real-time updates via Server-Sent Events (SSE) must continue to work correctly for open tickets
- Ticket replies, status updates, and all other ticket operations must continue to function correctly

**Scope:**
All inputs that do NOT involve switching between organizations should be completely unaffected by this fix. This includes:
- Initial page load and ticket fetching
- Creating new tickets
- Viewing and replying to tickets
- Real-time SSE updates for ticket messages
- All ticket operations (status change, priority change, assignment, deletion)

## Hypothesized Root Cause

Based on the bug description and code analysis, the root cause is:

1. **Missing Dependency in useEffect**: The `fetchTickets` function is wrapped in a `useCallback` with `authHeader` as its only dependency. The `useEffect` that calls `fetchTickets` also only depends on `fetchTickets`. When the user switches organizations, the `authHeader` object reference doesn't change (it's still `{ Authorization: 'Bearer <token>' }`), even though the token payload contains a different `organizationId`.

2. **No Organization Context Tracking**: The frontend component doesn't track the user's current `organizationId` from the AuthContext, so it has no way to detect when the organization context changes.

3. **Backend is Correct**: The backend `/api/support/tickets` endpoint correctly reads `organizationId` from the JWT token (via `requireOrganization` middleware) and filters tickets appropriately. The bug is purely on the frontend side.

4. **Token Payload vs Token Reference**: React's dependency tracking works on reference equality. The `authHeader` object is recreated via `useMemo` when `token` changes, but the `token` string reference itself doesn't change when `switchOrganization` is called - only the decoded payload changes.

## Correctness Properties

Property 1: Bug Condition - Organization Switch Triggers Ticket Refresh

_For any_ user action where the user switches from one organization to another (isBugCondition returns true), the fixed UserSupportView component SHALL automatically refetch the tickets list from the backend API, causing the displayed tickets to update to show only tickets belonging to the newly selected organization.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Non-Switch Operations Unchanged

_For any_ user interaction that is NOT an organization switch (viewing tickets, creating tickets, replying to tickets, real-time updates), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing functionality for ticket management and real-time communication.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

**File**: `src/components/support/UserSupportView.tsx`

**Function**: `UserSupportView` component

**Specific Changes**:

1. **Add organizationId Dependency**: Extract `user.organizationId` from the AuthContext and add it as a dependency to the `fetchTickets` useCallback
   - Import: Already imports `useAuth` from `@/contexts/AuthContext`
   - Extract: `const { user } = useAuth();` (already present)
   - Access: `user?.organizationId`
   - Add to `fetchTickets` dependencies: `[authHeader, user?.organizationId]`

2. **Update useEffect Dependency**: The `useEffect` that calls `fetchTickets` will automatically re-run when `fetchTickets` changes, which will now happen when `organizationId` changes
   - Current: `useEffect(() => { fetchTickets(); }, [fetchTickets]);`
   - No change needed to the useEffect itself, as it already depends on `fetchTickets`

3. **Handle Admin Users**: Ensure admin users (who see all tickets) don't trigger unnecessary refetches
   - Admin users have `role === 'admin'` and may not have a stable `organizationId`
   - Consider adding a check: only include `organizationId` dependency for non-admin users
   - Alternative: Accept that admin users will refetch (harmless, as they see all tickets anyway)

4. **Clear Selected Ticket on Organization Switch**: When organization changes, clear the selected ticket to avoid showing a ticket from the previous organization
   - Add a new `useEffect` that watches `user?.organizationId`
   - When it changes, call `setSelectedTicket(null)` to close any open ticket detail view
   - This prevents confusion where a user sees a ticket from Org A while in Org B context

5. **Close SSE Connection on Organization Switch**: Ensure the EventSource connection is closed when switching organizations
   - The existing `useEffect` for SSE already has cleanup logic that closes the connection
   - When `selectedTicket` is set to null (step 4), the SSE effect will automatically clean up
   - No additional changes needed

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate a user switching organizations and assert that the tickets list is refetched. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Organization Switch Test**: User belongs to Org A and Org B, views tickets in Org A, switches to Org B (will fail on unfixed code - tickets not refetched)
2. **Multiple Switch Test**: User switches from Org A to Org B to Org C (will fail on unfixed code - tickets remain stale)
3. **Switch and Create Test**: User switches organizations and creates a new ticket (may fail on unfixed code - new ticket appears in wrong org's list)
4. **Admin User Switch Test**: Admin user switches organizations (should see all tickets regardless, but may not refetch)

**Expected Counterexamples**:
- `fetchTickets` is not called when `user.organizationId` changes
- Possible causes: missing dependency in useCallback, no tracking of organizationId, token reference doesn't change

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := UserSupportView_fixed(input)
  ASSERT ticketsListRefreshed(result)
  ASSERT displayedTicketsMatchCurrentOrganization(result)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT UserSupportView_original(input) = UserSupportView_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for non-organization-switch interactions, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Initial Load Preservation**: Observe that initial ticket fetching works correctly on unfixed code, then write test to verify this continues after fix
2. **Ticket Creation Preservation**: Observe that creating tickets works correctly on unfixed code, then write test to verify this continues after fix
3. **Ticket Reply Preservation**: Observe that replying to tickets works correctly on unfixed code, then write test to verify this continues after fix
4. **SSE Updates Preservation**: Observe that real-time updates work correctly on unfixed code, then write test to verify this continues after fix
5. **Admin View Preservation**: Observe that admin users see all tickets on unfixed code, then write test to verify this continues after fix

### Unit Tests

- Test that `fetchTickets` is called on initial component mount
- Test that `fetchTickets` is called when `user.organizationId` changes
- Test that `fetchTickets` is NOT called when other user properties change (e.g., firstName, email)
- Test that selected ticket is cleared when organization context changes
- Test that admin users can still see all tickets after the fix

### Property-Based Tests

- Generate random organization switch sequences and verify tickets are always refetched
- Generate random user interactions (create, reply, view) and verify they work correctly across organization switches
- Test that SSE connections are properly cleaned up across many organization switches

### Integration Tests

- Test full user flow: login, view tickets in Org A, switch to Org B, verify only Org B tickets shown
- Test that creating a ticket in Org A, switching to Org B, and viewing tickets shows the new ticket only in Org A
- Test that admin users see all tickets regardless of organization context
- Test that real-time updates continue to work after switching organizations
