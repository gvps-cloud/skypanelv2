# Bug Condition Exploration Results

## Test Execution Date
2025-01-06 (Updated: 2026-03-08)

## Test Status
**BUG CONFIRMED** ✓

The bug has been confirmed through initial test execution. The test has been optimized to run faster with a single comprehensive test case instead of 6 separate tests.

## Test Optimization

Reduced from 6 separate test cases to 1 comprehensive test that validates:
1. role_id is populated in organization_members
2. role_id references the 'owner' role from organization_roles
3. RoleService.checkPermission returns true for key permissions
4. Protected endpoints return 200 OK (not 403)

This optimization significantly reduces test execution time while maintaining full bug coverage.

## Counterexamples Found (From Initial Test Run)

### Core Finding: role_id is NULL in organization_members
**Status**: CONFIRMED
**Error**: `expected null not to be null`
**Finding**: Newly registered users have `role_id = NULL` in the organization_members table, even though the legacy `role` column is correctly set to 'owner'.

### Permission Checks Fail
**Status**: CONFIRMED
**Error**: `expected false to be true`
**Findings**:
- `RoleService.checkPermission(userId, organizationId, 'billing_view')` returns `false`
- `RoleService.checkPermission(userId, organizationId, 'vps_view')` returns `false`
- All owner permissions fail due to NULL role_id

**Root Cause**: The RoleService.checkPermission method explicitly checks `if (!member.role_id) { return false; }` at line 193 of api/services/roles.ts, causing all permission checks to fail when role_id is NULL.

### Protected Endpoints Return 403 Forbidden
**Status**: CONFIRMED
**Error**: `expected 403 to be 200`
**Finding**: The wallet balance endpoint returns 403 Forbidden instead of 200 OK because the permission middleware checks for 'billing_view' permission, which fails due to NULL role_id.

## Root Cause Confirmation

The bug exploration confirms the hypothesized root cause in the design document:

1. **Missing role_id Assignment**: The `AuthService.register` method at line 68-72 of `api/services/authService.ts` inserts into organization_members with only `(organization_id, user_id, role, created_at)` but does NOT include `role_id`.

2. **Trigger Timing**: The database trigger `trigger_auto_seed_roles` (from migration 016) runs AFTER INSERT on organizations to seed default roles, but the registration code doesn't query for the owner role_id after the trigger completes.

3. **Permission Middleware Dependency**: The `RoleService.checkPermission` method at line 193 of `api/services/roles.ts` explicitly returns false when `role_id` is NULL, causing all permission checks to fail.

## Expected Behavior After Fix

Once the fix is implemented, the comprehensive test should PASS:

1. ✓ role_id should be populated with a valid UUID
2. ✓ role_id should reference the 'owner' role from organization_roles table
3. ✓ RoleService.checkPermission should return true for all owner permissions
4. ✓ /api/payments/wallet/balance should return 200 OK with wallet data

## Next Steps

1. Implement the fix in `AuthService.register` to query for owner role_id and assign it during registration
2. Run the exploration test again to verify the fix works
3. Implement preservation tests to ensure existing functionality is not broken
