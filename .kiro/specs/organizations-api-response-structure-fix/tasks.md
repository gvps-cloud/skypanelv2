# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - API Response Structure Mismatch
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to authenticated requests to `GET /api/organizations/` endpoint
  - Test that the API endpoint returns a response with an `organizations` property (from Bug Condition in design)
  - Test that `response.body.organizations` is an array of organization objects with stats
  - Test that accessing `response.organizations` is NOT undefined
  - The test assertions should match the Expected Behavior Properties from design
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found: response is direct array instead of wrapped object
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Functionality Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (authentication, database queries, error handling, other endpoints)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Test authentication middleware continues to validate JWT tokens and reject unauthorized requests
  - Test database queries for vps_count, ticket_count, and member_count produce correct results
  - Test error handling returns 500 status with error message on failures
  - Test other organization endpoints continue to use their existing response structures
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix API response structure for GET /api/organizations/

  - [x] 3.1 Implement the fix
    - Open `api/routes/organizations.ts`
    - Locate line 270 with `res.json(enrichedOrgs)`
    - Change to `res.json({ organizations: enrichedOrgs })`
    - Verify no other changes are needed (authentication, queries, error handling remain unchanged)
    - _Bug_Condition: isBugCondition(response) where response.body IS Array AND NOT wrapped in object with 'organizations' property_
    - _Expected_Behavior: Response SHALL return { organizations: Array<OrganizationWithStats> } structure_
    - _Preservation: Authentication checks, database queries, error handling, and other endpoints remain unchanged_
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - API Response Structure Correct
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify response has `organizations` property
    - Verify `response.body.organizations` is an array with organization data
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Functionality Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm authentication logic unchanged
    - Confirm database queries produce same results
    - Confirm error handling unchanged
    - Confirm other endpoints unchanged
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
