# Organization Context Persistence Fix - Bugfix Design

## Overview

This bugfix addresses the loss of organization context after page refresh. Currently, when a user switches to an organization, the selection is stored only in the frontend's localStorage without backend persistence or proper initialization on page load. The fix will implement a complete persistence mechanism that stores the active organization context in the database and properly restores it on application initialization.

The approach involves:
1. Adding a database column to track the user's active organization
2. Creating a backend API endpoint to persist organization context switches
3. Updating the frontend AuthContext to call the backend API and properly initialize from the database
4. Ensuring the dashboard and all organization-scoped resources load correctly based on the persisted context

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when a user refreshes the page after switching to an organization context
- **Property (P)**: The desired behavior when the bug condition occurs - the organization context should persist and resources should load correctly
- **Preservation**: Existing organization switching UI behavior, success messages, and button states that must remain unchanged by the fix
- **switchOrganization**: The function in `src/contexts/AuthContext.tsx` that updates the user's active organization context
- **active_organization_id**: The new database column in the users table that will store the user's currently selected organization
- **organizationId**: The property in the User interface that represents the active organization context

## Bug Details

### Bug Condition

The bug manifests when a user switches to an organization and then refreshes the page or navigates away and returns. The `switchOrganization` function in AuthContext only updates localStorage without persisting to the backend database, and the application initialization does not properly restore the organization context from the server.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { action: string, hasActiveOrg: boolean }
  OUTPUT: boolean
  
  RETURN input.action == 'page_refresh' 
         AND input.hasActiveOrg == true
         AND organizationContextNotPersisted()
END FUNCTION
```

### Examples

- **Example 1**: User clicks "Switch to Organization" for "Acme Corp" → sees success message and "Active" button → refreshes page → button reverts to "Switch to Organization" and dashboard shows personal resources instead of Acme Corp resources
- **Example 2**: User switches to "Tech Solutions" organization → navigates to VPS page → closes browser → reopens and logs in → organization context is lost, user sees personal context instead
- **Example 3**: User switches to "Dev Team" organization → views organization's support tickets → refreshes page → tickets disappear because context is lost
- **Edge Case**: User switches to organization → organization is deleted by owner → refreshes page → should gracefully handle missing organization and clear invalid context

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- The "Switch to Organization" button UI and interaction must continue to work exactly as before
- Success toast message "Switched organization context" must continue to display when switching
- Button state must continue to immediately update to show "Active" with checkmark icon when switching
- Organization membership validation must continue to prevent switching to organizations the user is not a member of
- Logout functionality must continue to clear all authentication and session data appropriately

**Scope:**
All inputs that do NOT involve page refresh or application reinitialization should be completely unaffected by this fix. This includes:
- Initial organization switching interaction (button click, API call, UI update)
- Navigation between pages within the same session
- Organization membership management (adding/removing members, role changes)
- Other authentication flows (login, logout, token refresh)

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Missing Database Persistence**: The `switchOrganization` function in `src/contexts/AuthContext.tsx` (line 524) only updates localStorage and does not call a backend API endpoint to persist the organization context to the database. There is no `active_organization_id` column in the users table.

2. **No Backend API Endpoint**: The `api/routes/organizations.ts` file does not contain a `POST /organizations/:id/switch` or similar endpoint to handle organization context switching on the backend.

3. **Incomplete Initialization**: The AuthContext's `useEffect` hook (lines 172-217) loads the user from localStorage but does not fetch fresh user data from the backend on initial load to restore the persisted organization context. The `refreshToken` call happens but may not properly update the organization context.

4. **Missing Database Column**: The users table in `migrations/001_initial_schema.sql` does not have an `active_organization_id` column to store the user's currently selected organization.

## Correctness Properties

Property 1: Bug Condition - Organization Context Persists Across Refresh

_For any_ user action where the user has switched to an organization and then refreshes the page (isBugCondition returns true), the fixed application SHALL restore the organization context from the database, maintain the "Active" button state for the selected organization, and automatically load that organization's resources (servers, tickets, billing, invoices, transactions, activity, notifications).

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Existing Switching Behavior Unchanged

_For any_ user interaction that does NOT involve page refresh or application reinitialization (isBugCondition returns false), the fixed code SHALL produce exactly the same behavior as the original code, preserving the immediate UI updates, success messages, button state changes, and membership validation.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File 1**: `migrations/XXX_add_active_organization_to_users.sql` (new file)

**Changes**:
1. **Add Database Column**: Create a new migration to add `active_organization_id` column to the users table
   - Column type: UUID, nullable, foreign key to organizations(id)
   - Add ON DELETE SET NULL constraint to handle organization deletion
   - Add index for performance on organization lookups

**File 2**: `api/routes/auth.ts`

**Function**: Add new endpoint `POST /auth/switch-organization`

**Specific Changes**:
1. **Create Switch Organization Endpoint**: Add a new authenticated endpoint that accepts an organization ID
   - Validate that the user is a member of the target organization
   - Update the user's `active_organization_id` in the database
   - Return updated user object with the new organization context
   - Handle edge case where organization doesn't exist or user is not a member

2. **Update Token Refresh**: Modify the `/auth/refresh` endpoint to include the user's `active_organization_id` in the returned user object

3. **Update Login Response**: Ensure the login endpoint returns the user's `active_organization_id` if they have one set

**File 3**: `src/contexts/AuthContext.tsx`

**Function**: `switchOrganization` (line 524)

**Specific Changes**:
1. **Add Backend API Call**: Update the function to call the new `POST /auth/switch-organization` endpoint
   - Send the organization ID to the backend
   - Wait for the response before updating local state
   - Handle errors gracefully with toast notifications

2. **Update Local State**: After successful backend call, update both the user state and localStorage with the returned user object

3. **Maintain Existing Behavior**: Ensure the function still updates immediately for UI responsiveness

**File 4**: `src/contexts/AuthContext.tsx`

**Function**: `useEffect` initialization hook (lines 172-217)

**Specific Changes**:
1. **Fetch Fresh User Data**: After validating the stored token, make an API call to fetch the current user data from the backend (including `active_organization_id`)
   - This ensures the organization context is loaded from the database, not just localStorage
   - Update both user state and localStorage with the fresh data

2. **Handle Missing Organization**: If the user's `active_organization_id` references a deleted organization or one they're no longer a member of, clear the context gracefully

**File 5**: `src/contexts/AuthContext.tsx`

**Interface**: `User` (line 4)

**Specific Changes**:
1. **Update Type Definition**: The `organizationId` property already exists in the User interface, so no changes needed here

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate switching to an organization, then simulate a page refresh by clearing React state and reinitializing the AuthContext. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Basic Persistence Test**: Switch to organization → simulate page refresh → verify organization context is lost (will fail on unfixed code)
2. **Button State Test**: Switch to organization → simulate page refresh → verify button shows "Switch to Organization" instead of "Active" (will fail on unfixed code)
3. **Resource Loading Test**: Switch to organization → simulate page refresh → verify dashboard loads personal resources instead of organization resources (will fail on unfixed code)
4. **Multiple Switch Test**: Switch to Org A → switch to Org B → simulate page refresh → verify context is lost (will fail on unfixed code)

**Expected Counterexamples**:
- Organization context is not restored after page refresh
- Possible causes: no database persistence, no backend API call, incomplete initialization logic

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := switchOrganization_fixed(orgId)
  refreshPage()
  ASSERT user.organizationId == orgId
  ASSERT buttonState == "Active"
  ASSERT dashboardResources == organizationResources
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT switchOrganization_original(input) = switchOrganization_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-refresh interactions

**Test Plan**: Observe behavior on UNFIXED code first for immediate switching interactions, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Immediate UI Update Preservation**: Observe that clicking "Switch to Organization" immediately updates the button to "Active" on unfixed code, then write test to verify this continues after fix
2. **Success Message Preservation**: Observe that success toast appears on unfixed code, then write test to verify this continues after fix
3. **Membership Validation Preservation**: Observe that switching to non-member organization is prevented on unfixed code, then write test to verify this continues after fix
4. **Logout Preservation**: Observe that logout clears all data on unfixed code, then write test to verify this continues after fix

### Unit Tests

- Test the new `POST /auth/switch-organization` endpoint with valid and invalid organization IDs
- Test that the endpoint validates organization membership before allowing switch
- Test that the endpoint updates the database correctly
- Test that AuthContext's `switchOrganization` function calls the backend API
- Test that page initialization loads organization context from the backend
- Test edge case where user's active organization is deleted

### Property-Based Tests

- Generate random organization switching sequences and verify context persists after simulated refresh
- Generate random user sessions and verify organization context is correctly restored on initialization
- Test that all non-refresh interactions continue to work across many scenarios

### Integration Tests

- Test full flow: login → switch to organization → refresh page → verify context persists
- Test full flow: switch to Org A → switch to Org B → refresh → verify Org B context persists
- Test full flow: switch to organization → logout → login → verify context is cleared (no persistence across sessions)
- Test that organization resources (VPS, tickets, billing) load correctly after refresh with persisted context
