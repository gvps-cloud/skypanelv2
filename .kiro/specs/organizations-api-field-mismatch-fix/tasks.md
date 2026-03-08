# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - API Field Name Mismatch
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the field name mismatch exists
  - **Scoped PBT Approach**: Scope the property to the concrete failing case - API response contains `tickets_count` and `members_count` (plural) instead of singular forms
  - Test that GET /api/organizations/ returns statistics with singular field names (`ticket_count`, `member_count`)
  - The test assertions should verify the API response structure matches the TypeScript `OrganizationStats` interface
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found (e.g., "API returns `tickets_count` but interface expects `ticket_count`")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Statistics Fields Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy fields (vps_count, id, name, slug, member_role, role_permissions)
  - Write property-based tests capturing that these fields are returned correctly and unchanged
  - Verify that `vps_count` field name remains unchanged (already correct)
  - Verify that organization fields (id, name, slug, member_role, role_permissions) are returned correctly
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Fix API field name mismatch

  - [x] 3.1 Update API response field names
    - Modify `api/routes/organizations.ts` GET / endpoint (around line 260-290)
    - Change `tickets_count` to `ticket_count` in the SQL query or response mapping
    - Change `members_count` to `member_count` in the SQL query or response mapping
    - Keep `vps_count` unchanged (already correct)
    - Ensure all other organization fields remain unchanged
    - _Bug_Condition: API response contains `tickets_count` and `members_count` (plural) when TypeScript interface expects singular forms_
    - _Expected_Behavior: API returns `ticket_count` and `member_count` (singular) matching the TypeScript interface_
    - _Preservation: vps_count and other organization fields (id, name, slug, member_role, role_permissions) remain unchanged_
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - API Field Names Match Interface
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Statistics Fields Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
