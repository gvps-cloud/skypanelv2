# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Owner-Only Ownership Transfer
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases: non-owner users (admin, member with permissions) attempting to update any member's role to "owner"
  - Test that non-owner users can escalate roles to "owner" via `PUT /api/organizations/:id/members/:userId` endpoint (from Bug Condition in design)
  - Test cases:
    - Admin user attempts to update their own role to owner
    - Admin user attempts to update another member's role to owner
    - User with custom role having members_manage permission attempts to escalate to owner
  - The test assertions should match the Expected Behavior Properties from design: expect 403 Forbidden with message "Only the organization owner can transfer ownership"
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause (e.g., "Admin successfully escalated to owner with 200 OK instead of 403 Forbidden")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.1, 2.2, 2.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Owner Role Management
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (role updates that do NOT target "owner" role)
  - Test cases to observe:
    - Owner updating member roles to admin, member, or custom roles
    - Admin updating member roles to non-owner roles
    - Last owner attempting to demote themselves (should be rejected)
    - Activity feed entries created for role updates
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.5, 3.6_

- [x] 3. Fix for organization owner privilege escalation vulnerability

  - [x] 3.1 Implement backend ownership verification in api/routes/organizations.ts
    - Add query to fetch requester's role name after line 467 (after memberCheck)
    - Modify roleId handling section (around line 475) to check if target role is "owner"
    - Add ownership transfer authorization check: if targetRoleName === 'owner' && requesterRoleName !== 'owner', return 403
    - Modify legacy role handling section (around line 495) to apply same ownership check for role === 'owner'
    - Return error message: "Only the organization owner can transfer ownership"
    - _Bug_Condition: isBugCondition(input) where requesterRole(input.requesterId, input.organizationId) != 'owner' AND targetRoleName(input.newRoleId, input.organizationId) == 'owner'_
    - _Expected_Behavior: For any role update request where target role is "owner" and requester is NOT owner, reject with 403 Forbidden_
    - _Preservation: Non-owner role updates (admin, member, custom roles) must continue to work exactly as before_
    - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.5, 3.6_

  - [x] 3.2 Implement frontend UI filter in src/components/settings/TeamSettings.tsx
    - Filter owner role from role selector dropdown for non-owner users (around line 1010)
    - Check current user's role before rendering role options
    - Hide owner role option if currentUserRole !== 'owner'
    - _Requirements: 2.3_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Owner-Only Ownership Transfer
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify non-owner users receive 403 Forbidden when attempting to escalate to owner
    - Verify owner users can still transfer ownership successfully
    - _Requirements: 2.1, 2.2, 2.4_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Owner Role Management
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - Verify owner can still update non-owner roles
    - Verify admin can still update non-owner roles
    - Verify last owner demotion prevention still works
    - Verify activity feed entries still created
    - _Requirements: 3.1, 3.2, 3.5, 3.6_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
