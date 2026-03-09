# Organization Owner Privilege Escalation Fix - Bugfix Design

## Overview

This design addresses a critical security vulnerability in the organization member role update functionality. Currently, any user with admin or higher permissions can escalate their own role or another member's role to "owner" through the `PUT /api/organizations/:id/members/:userId` endpoint. This violates the security principle that only the current organization owner should be able to transfer ownership.

The fix will add ownership verification checks at both the API and UI layers to prevent unauthorized privilege escalation while preserving all existing non-owner role management functionality.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when a non-owner user attempts to update any member's role to "owner"
- **Property (P)**: The desired behavior when ownership transfer is attempted - only current owners can transfer ownership, all others receive 403 Forbidden
- **Preservation**: Existing role management behavior for non-owner roles (admin, member, custom roles) that must remain unchanged
- **requireOrgAccess**: Middleware in `api/routes/organizations.ts` that checks if user has admin or owner role
- **organization_roles**: Database table storing role definitions with name field ('owner', 'admin', etc.)
- **organization_members**: Database table linking users to organizations with role_id foreign key
- **roleId**: UUID reference to organization_roles table used in role update requests
- **currentUserRole**: The role name of the authenticated user making the request

## Bug Details

### Bug Condition

The bug manifests when a non-owner user (with admin or higher permissions) attempts to update any member's role to "owner" via the role update API. The `PUT /api/organizations/:id/members/:userId` endpoint is not verifying that the requester is the current organization owner before allowing ownership transfer.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type RoleUpdateRequest {
    requesterId: UUID,
    targetUserId: UUID,
    organizationId: UUID,
    newRoleId: UUID
  }
  OUTPUT: boolean
  
  RETURN requesterRole(input.requesterId, input.organizationId) != 'owner'
         AND targetRoleName(input.newRoleId, input.organizationId) == 'owner'
         AND roleUpdateEndpointAllowsRequest(input)
END FUNCTION
```

### Examples

- **Admin escalates self to owner**: Admin user (Alice) sends `PUT /api/organizations/org-123/members/alice-id` with `roleId` pointing to owner role → Request succeeds (BUG)
- **Admin escalates another member to owner**: Admin user (Bob) sends `PUT /api/organizations/org-123/members/charlie-id` with `roleId` pointing to owner role → Request succeeds (BUG)
- **Member with custom role escalates to owner**: User with custom role having `members_manage` permission attempts to update their role to owner → Request succeeds if they have sufficient permissions (BUG)
- **Owner transfers ownership**: Owner user (David) sends `PUT /api/organizations/org-123/members/eve-id` with `roleId` pointing to owner role → Should succeed (EXPECTED BEHAVIOR)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Owner updating non-owner member roles (admin, member, custom roles) must continue to work
- Admin updating non-owner member roles must continue to work as per existing permissions
- Owner attempting to demote themselves when they are the last owner must continue to be rejected
- Member removal must continue to enforce the "cannot remove last owner" rule
- Activity feed entries must continue to be created for all role updates
- Custom role management features must continue to function without changes

**Scope:**
All inputs that do NOT involve updating a member's role to "owner" should be completely unaffected by this fix. This includes:
- Non-owner role updates (admin to member, member to admin, custom role assignments)
- Member additions and removals
- Invitation management
- Custom role creation and management
- All other team management features

## Hypothesized Root Cause

Based on the bug description and code analysis, the root cause is:

1. **Missing Ownership Verification**: The `PUT /api/organizations/:id/members/:userId` endpoint uses `requireOrgAccess` middleware which only checks if the requester has admin OR owner role, but does not verify ownership when the target role is "owner"
   - Line 456 in `api/routes/organizations.ts`: `router.put('/:id/members/:userId', requireOrgAccess, ...)`
   - The middleware allows both admins and owners to proceed

2. **No Target Role Validation**: The endpoint validates that the target role exists and belongs to the organization, but does not check if the target role is "owner" and require special authorization
   - Lines 471-478: Role existence check but no ownership transfer validation

3. **Frontend Displays Owner Option**: The Team Settings UI (`src/components/settings/TeamSettings.tsx`) displays all available roles including "owner" in the role selector dropdown for users with admin permissions
   - The UI does not filter out the "owner" role option for non-owner users

4. **Legacy Role System Compatibility**: The endpoint supports both legacy `role` field and new `roleId` system, but neither path includes ownership transfer validation
   - Lines 483-520: Both roleId and legacy role paths lack ownership checks

## Correctness Properties

Property 1: Bug Condition - Owner-Only Ownership Transfer

_For any_ role update request where the target role is "owner" and the requester is NOT the current organization owner, the fixed endpoint SHALL reject the request with a 403 Forbidden error and message "Only the organization owner can transfer ownership".

**Validates: Requirements 2.1, 2.2, 2.4**

Property 2: Preservation - Non-Owner Role Management

_For any_ role update request where the target role is NOT "owner" (e.g., admin, member, custom roles), the fixed endpoint SHALL produce exactly the same behavior as the original endpoint, preserving all existing role management functionality for admins and owners.

**Validates: Requirements 3.1, 3.2, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `api/routes/organizations.ts`

**Function**: `PUT /:id/members/:userId` route handler (starting at line 456)

**Specific Changes**:

1. **Add Ownership Verification Check**: After validating the target role exists, add a check to determine if the target role is "owner"
   - Query the `organization_roles` table to get the role name for the provided `roleId`
   - If the role name is "owner", verify the requester is the current organization owner
   - Reject with 403 if requester is not owner

2. **Query Requester's Role**: Before processing the role update, query the requester's current role in the organization
   - Use `req.user.id` and organization `id` to fetch the requester's role from `organization_members`
   - Join with `organization_roles` to get the role name

3. **Implement Ownership Transfer Guard**: Create a conditional block that executes when target role is "owner"
   ```typescript
   if (targetRoleName === 'owner' && requesterRoleName !== 'owner') {
     return res.status(403).json({ 
       error: 'Only the organization owner can transfer ownership' 
     });
   }
   ```

4. **Handle Legacy Role System**: Apply the same ownership verification for the legacy `role` field path
   - Check if `role === 'owner'` and apply the same ownership verification

5. **Frontend UI Filter** (Optional but Recommended): In `src/components/settings/TeamSettings.tsx`, filter the owner role from the role selector for non-owner users
   - Check the current user's role before rendering the role options
   - Hide or disable the "owner" role option if the user is not an owner

### Implementation Details

**Backend Changes** (`api/routes/organizations.ts`, lines 456-560):

```typescript
// After line 456: router.put('/:id/members/:userId', requireOrgAccess, async (req, res) => {
// Add after line 467 (after memberCheck):

// Get requester's role to check for ownership transfer authorization
const requesterRoleResult = await query(
  `SELECT om.role, r.name as role_name
   FROM organization_members om
   LEFT JOIN organization_roles r ON om.role_id = r.id
   WHERE om.organization_id = $1 AND om.user_id = $2`,
  [id, req.user!.id]
);

const requesterRoleName = requesterRoleResult.rows[0]?.role_name || 
                          requesterRoleResult.rows[0]?.role;

// Then modify the roleId handling section (around line 475):
if (roleId) {
  const roleCheck = await query(
    `SELECT name FROM organization_roles WHERE id = $1 AND organization_id = $2`,
    [roleId, id]
  );

  if (roleCheck.rows.length === 0) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const targetRoleName = roleCheck.rows[0].name;

  // NEW: Ownership transfer authorization check
  if (targetRoleName === 'owner' && requesterRoleName !== 'owner') {
    return res.status(403).json({ 
      error: 'Only the organization owner can transfer ownership' 
    });
  }

  // ... rest of existing logic
}

// And modify the legacy role handling section (around line 495):
else if (role) {
  const validRoles = ['admin', 'member', 'owner'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  // NEW: Ownership transfer authorization check for legacy system
  if (role === 'owner' && requesterRoleName !== 'owner') {
    return res.status(403).json({ 
      error: 'Only the organization owner can transfer ownership' 
    });
  }

  // ... rest of existing logic
}
```

**Frontend Changes** (`src/components/settings/TeamSettings.tsx`, around line 1010):

```typescript
// In the Update Member Role dialog, filter roles based on current user's role
<Select
  value={newMemberRoleId}
  onValueChange={setNewMemberRoleId}
>
  <SelectTrigger>
    <SelectValue placeholder="Select a role" />
  </SelectTrigger>
  <SelectContent>
    {roles
      .filter(role => {
        // Hide owner role from non-owners
        if (role.name === 'owner' && currentUserRole !== 'owner') {
          return false;
        }
        return true;
      })
      .map((role) => (
        <SelectItem key={role.id} value={role.id}>
          {role.name}
        </SelectItem>
      ))}
  </SelectContent>
</Select>
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate role update requests from non-owner users attempting to escalate to owner role. Run these tests on the UNFIXED code to observe that the requests succeed when they should fail.

**Test Cases**:
1. **Admin Self-Escalation Test**: Admin user attempts to update their own role to owner (will succeed on unfixed code, should fail)
2. **Admin Escalates Another Member Test**: Admin user attempts to update another member's role to owner (will succeed on unfixed code, should fail)
3. **Custom Role with members_manage Permission Test**: User with custom role having members_manage permission attempts to escalate to owner (may succeed on unfixed code, should fail)
4. **Owner Transfers Ownership Test**: Owner user attempts to transfer ownership to another member (should succeed on both unfixed and fixed code)

**Expected Counterexamples**:
- Non-owner users can successfully update roles to "owner" via API
- API returns 200 OK instead of 403 Forbidden for unauthorized ownership transfers
- Possible causes: missing ownership verification, insufficient authorization checks in requireOrgAccess middleware

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleRoleUpdate_fixed(input)
  ASSERT result.statusCode == 403
  ASSERT result.error == "Only the organization owner can transfer ownership"
END FOR
```

**Test Implementation**: Property-based tests that generate various combinations of:
- Non-owner requester roles (admin, member, custom roles)
- Target user IDs (self-escalation and escalating others)
- Organization contexts
- Both roleId and legacy role field inputs

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleRoleUpdate_original(input) = handleRoleUpdate_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for non-owner role updates, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Owner Updates Non-Owner Roles**: Observe that owner can update members to admin, member, custom roles on unfixed code, then verify this continues after fix
2. **Admin Updates Non-Owner Roles**: Observe that admin can update members to non-owner roles on unfixed code, then verify this continues after fix
3. **Last Owner Demotion Prevention**: Observe that last owner cannot demote themselves on unfixed code, then verify this continues after fix
4. **Activity Feed Creation**: Observe that activity feed entries are created for role updates on unfixed code, then verify this continues after fix

### Unit Tests

- Test ownership transfer authorization for roleId-based updates
- Test ownership transfer authorization for legacy role-based updates
- Test that owner can successfully transfer ownership
- Test that admin receives 403 when attempting to escalate to owner
- Test that member with custom role receives 403 when attempting to escalate to owner
- Test edge cases (invalid roleId, non-existent member, invalid organization)

### Property-Based Tests

- Generate random non-owner requester roles and verify all receive 403 when targeting owner role
- Generate random non-owner target roles and verify existing behavior is preserved
- Generate random organization states and verify ownership transfer only works for owners
- Test both roleId and legacy role field paths with generated inputs

### Integration Tests

- Test full role update flow from frontend UI through API for non-owner roles
- Test that owner role option is hidden/disabled for non-owner users in UI
- Test that ownership transfer works end-to-end for owner users
- Test that 403 errors are properly displayed in UI when non-owners attempt escalation
