# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - New Users Missing Owner Role ID
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate newly registered users have NULL role_id
  - **Scoped PBT Approach**: Scope the property to new user registration scenarios with various organization configurations
  - Test that newly registered users have role_id populated in organization_members table
  - Test that role_id references the 'owner' role from organization_roles table
  - Test that RoleService.checkPermission returns true for owner permissions (billing_view, vps_view)
  - Test that protected endpoints like `/api/payments/wallet/balance` and `/api/vps` return 200 OK (not 403)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (role_id is NULL, permission checks fail, endpoints return 403)
  - Document counterexamples found: specific cases where role_id is NULL and which permissions fail
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.1, 2.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Registration Flow Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy scenarios (admin users, existing users)
  - Write property-based tests capturing observed behavior patterns:
    - Organization creation produces same structure (name, slug, owner_id, settings)
    - Wallet is created with balance 0 and currency USD
    - Legacy `role` column is populated with 'owner'
    - Admin users continue to bypass permission checks
    - User creation, organization creation, and wallet initialization remain unchanged
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Fix for dashboard permission errors

  - [x] 3.1 Implement the fix in AuthService.register
    - After creating the organization, query organization_roles table for the 'owner' role
    - Handle timing with trigger_auto_seed_roles (may need to call seed function explicitly or query after trigger completes)
    - Update organization_members INSERT to include role_id column with the owner role ID
    - Add error handling for missing owner role with descriptive error message
    - Maintain backward compatibility by continuing to populate legacy `role` column with 'owner'
    - _Bug_Condition: isBugCondition(input) where userIsNewlyRegistered AND userCreatedOwnOrganization AND organizationMemberRoleIdIsNull_
    - _Expected_Behavior: organizationMemberHasRoleId AND roleIdIsOwnerRole AND userHasPermission for all owner permissions_
    - _Preservation: Admin users bypass checks, existing users unchanged, organization/wallet creation unchanged, legacy role column populated_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - New Users Have Owner Role ID
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms newly registered users have role_id assigned and full permissions
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (role_id is populated, permission checks succeed, endpoints return 200)
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Registration Flow Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (organization creation, wallet creation, legacy role column, admin users)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
