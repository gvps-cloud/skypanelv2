# Dashboard Permission Errors Fix - Bugfix Design

## Overview

When a new user registers and creates their own organization, they are not being assigned the "owner" role in the organization_members table. The registration flow creates an organization_members record with only the legacy `role` column set to 'owner', but leaves the `role_id` column NULL. This causes the permission middleware to fail when checking permissions, resulting in 403 Forbidden errors on dashboard endpoints like `/api/payments/wallet/balance` and `/api/vps`.

The fix requires updating the AuthService.register method to properly assign the owner role_id when creating organization_members records, ensuring new users have the necessary permissions to access their own organization's resources.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when a newly registered user attempts to access organization resources
- **Property (P)**: The desired behavior - newly registered users should have owner role_id assigned and full permissions to their organization
- **Preservation**: Existing user registration flow, organization creation, and admin user functionality must remain unchanged
- **AuthService.register**: The function in `api/services/authService.ts` that handles user registration and organization creation
- **organization_members**: The table that links users to organizations with their roles
- **organization_roles**: The table that defines roles with granular permissions
- **role_id**: The UUID foreign key in organization_members that references organization_roles(id)
- **RoleService.checkPermission**: The function that validates if a user has a specific permission for an organization

## Bug Details

### Bug Condition

The bug manifests when a newly registered user attempts to access any organization resource that requires permissions. The AuthService.register function creates an organization_members record with the legacy `role` column set to 'owner', but does not populate the `role_id` column. When RoleService.checkPermission is called, it queries for the role_id and finds NULL, causing permission checks to fail.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { userId: UUID, organizationId: UUID, permission: Permission }
  OUTPUT: boolean
  
  RETURN userIsNewlyRegistered(input.userId)
         AND userCreatedOwnOrganization(input.userId, input.organizationId)
         AND organizationMemberRoleIdIsNull(input.userId, input.organizationId)
         AND permissionCheckRequired(input.permission)
END FUNCTION
```

### Examples

- **New user registers** → Creates organization → Tries to access `/api/payments/wallet/balance` → Gets 403 Forbidden (expected: 200 OK with wallet data)
- **New user registers** → Creates organization → Tries to access `/api/vps` → Gets 403 Forbidden (expected: 200 OK with VPS list)
- **Admin user logs in** → Accesses any endpoint → Works correctly (admin bypass in middleware)
- **User invited to organization** → Accepts invite → May also have NULL role_id depending on invite flow (edge case to verify)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Admin users must continue to bypass permission checks and access all resources
- Existing users with properly assigned role_id must continue to work without any changes
- Organization creation flow for admin users must remain unchanged
- The legacy `role` column must continue to be populated for backward compatibility
- Database triggers that auto-seed roles for new organizations must continue to work

**Scope:**
All inputs that do NOT involve newly registered users creating their own organizations should be completely unaffected by this fix. This includes:
- Admin user operations
- Existing user operations with valid role_id
- User invitation and acceptance flows
- Organization role management operations

## Hypothesized Root Cause

Based on the bug description and code analysis, the root cause is:

1. **Missing role_id Assignment in Registration**: The AuthService.register method creates organization_members with only the legacy `role` column populated, not the `role_id` column
   - The code inserts into organization_members with: `(organization_id, user_id, role, created_at)`
   - It does not query for the owner role_id from organization_roles table
   - The migration 016 creates a trigger to auto-seed roles, but the registration happens in a transaction before roles are seeded

2. **Timing Issue with Role Seeding**: The trigger `trigger_auto_seed_roles` runs AFTER INSERT on organizations, but the organization_members insert happens in the same transaction
   - The registration transaction creates the organization
   - The trigger seeds default roles (owner, admin, viewer, etc.)
   - But the organization_members insert doesn't wait for or query these seeded roles

3. **Permission Middleware Dependency**: RoleService.checkPermission explicitly checks for role_id and returns false if NULL
   - Line in roles.ts: `if (!member.role_id) { return false; }`
   - This causes all permission checks to fail for users without role_id

4. **Legacy Column Fallback Not Implemented**: The permission system was migrated to use role_id but doesn't fall back to the legacy `role` column when role_id is NULL

## Correctness Properties

Property 1: Bug Condition - New Users Have Owner Role ID

_For any_ newly registered user who creates their own organization, the fixed AuthService.register function SHALL query the organization_roles table for the 'owner' role and assign its ID to the organization_members.role_id column, ensuring the user has full permissions to access all organization resources.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - Existing Registration Flow

_For any_ registration that does NOT involve the role_id assignment (admin users, existing users, legacy systems), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing functionality for user creation, organization creation, and wallet initialization.

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `api/services/authService.ts`

**Function**: `AuthService.register`

**Specific Changes**:
1. **Query for Owner Role ID**: After creating the organization and before inserting into organization_members, query the organization_roles table for the 'owner' role
   - The trigger `trigger_auto_seed_roles` runs AFTER INSERT on organizations
   - We need to ensure roles are seeded before querying
   - Query: `SELECT id FROM organization_roles WHERE organization_id = $1 AND name = 'owner'`

2. **Handle Race Condition**: If the trigger hasn't completed yet, we may need to explicitly call the seed function or wait
   - Option A: Call `seed_default_roles_for_organization(org_id)` explicitly in the transaction
   - Option B: Query with retry logic
   - Option C: Rely on trigger and query after commit (not ideal for transaction consistency)

3. **Update organization_members Insert**: Include role_id in the INSERT statement
   - Change from: `INSERT INTO organization_members (organization_id, user_id, role, created_at)`
   - Change to: `INSERT INTO organization_members (organization_id, user_id, role, role_id, created_at)`
   - Add the owner_role_id to the VALUES clause

4. **Error Handling**: Add proper error handling if owner role is not found
   - Throw descriptive error: "Failed to assign owner role: role not found"
   - This helps diagnose if the trigger or seeding fails

5. **Maintain Legacy Column**: Continue to populate the `role` column with 'owner' for backward compatibility
   - Keep existing: `role = 'owner'`
   - This ensures any code still using the legacy column continues to work

### Alternative Approach (if trigger timing is unreliable)

If the trigger approach proves unreliable, we could:
1. Explicitly call `seed_default_roles_for_organization` in the transaction before querying
2. Or inline the role creation logic directly in the registration transaction
3. Or use a stored procedure that handles both organization and role creation atomically

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate new user registration and then attempt to access protected endpoints. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **New User Registration Test**: Register a new user, then query organization_members to verify role_id is NULL (will fail on unfixed code - role_id will be NULL)
2. **Permission Check Test**: Register a new user, then call RoleService.checkPermission for 'billing_view' (will fail on unfixed code - returns false)
3. **Wallet Balance Endpoint Test**: Register a new user, then GET `/api/payments/wallet/balance` (will fail on unfixed code - 403 Forbidden)
4. **VPS List Endpoint Test**: Register a new user, then GET `/api/vps` (will fail on unfixed code - 403 Forbidden)

**Expected Counterexamples**:
- organization_members.role_id is NULL for newly registered users
- RoleService.checkPermission returns false for all permissions
- Protected endpoints return 403 Forbidden instead of 200 OK
- Possible causes: missing role_id assignment, trigger timing issue, role seeding failure

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := AuthService.register_fixed(input)
  ASSERT organizationMemberHasRoleId(result.user.id, result.organizationId)
  ASSERT roleIdIsOwnerRole(result.user.id, result.organizationId)
  ASSERT userHasPermission(result.user.id, result.organizationId, 'billing_view')
  ASSERT userHasPermission(result.user.id, result.organizationId, 'vps_view')
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT AuthService.register_original(input) = AuthService.register_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for admin users and existing users, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Admin User Registration Preservation**: Verify admin users continue to work correctly after fix (if admin registration exists)
2. **Organization Creation Preservation**: Verify organization creation produces same organization structure (name, slug, owner_id, settings)
3. **Wallet Creation Preservation**: Verify wallet is still created with balance 0 and currency USD
4. **Legacy Role Column Preservation**: Verify the legacy `role` column is still populated with 'owner'

### Unit Tests

- Test AuthService.register creates organization_members with role_id populated
- Test AuthService.register queries for owner role after organization creation
- Test AuthService.register handles missing owner role gracefully with error
- Test RoleService.checkPermission returns true for newly registered users with owner role_id
- Test edge case: registration when organization_roles table is empty (should fail gracefully)

### Property-Based Tests

- Generate random user registration data and verify role_id is always assigned for new users
- Generate random organization configurations and verify role seeding works correctly
- Test that all permissions defined in PREDEFINED_ROLES['owner'] are granted to newly registered users
- Test across many scenarios that legacy `role` column continues to be populated

### Integration Tests

- Test full registration flow: register → login → access wallet balance → verify 200 OK
- Test full registration flow: register → login → access VPS list → verify 200 OK
- Test full registration flow: register → login → create VPS → verify owner permissions work
- Test that newly registered users can invite other users to their organization
- Test that newly registered users can manage organization settings
