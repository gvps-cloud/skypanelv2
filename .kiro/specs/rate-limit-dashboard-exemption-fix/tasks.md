# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Dashboard Endpoints Return 429 Under Normal Usage
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate dashboard endpoints hit rate limits during normal usage
  - **Scoped PBT Approach**: Scope the property to concrete failing cases - authenticated user making 501 requests to `/api/auth/me`, admin making 1001 requests to `/api/notifications/unread`
  - Test that authenticated users hitting 501 requests to `/api/auth/me` receive HTTP 429 (from Bug Condition in design)
  - Test that admin users hitting 1001 requests to `/api/notifications/unread` receive HTTP 429
  - Test that rapid user searches to `/api/admin/users/search` hit rate limits
  - The test assertions should match the Expected Behavior Properties: dashboard endpoints should NOT return 429 during normal usage
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found: which dashboard endpoints return 429, at what request counts, for which user types
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.1, 2.2, 2.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - External API Rate Limiting Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for external API endpoints (VPS, payments, support tickets)
  - Observe: authenticated user making 501 requests to `/api/vps/create` receives 429 on request 501
  - Observe: authenticated user making 501 requests to `/api/payments/process` receives 429 on request 501
  - Observe: anonymous user making 201 requests to any endpoint receives 429 on request 201
  - Write property-based tests capturing observed rate limiting behavior from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees that external API protection is unchanged
  - Test that VPS endpoints (`/api/vps/*`, `/api/admin/vps/*`) enforce standard limits (200/500/1000)
  - Test that payment endpoints (`/api/payments/*`) enforce standard limits
  - Test that support ticket endpoints (`/api/support/*`) enforce standard limits
  - Test that organization endpoints (`/api/admin/organizations/*`) enforce standard limits
  - Test that anonymous users still get 200 requests per 15 minutes on all endpoints
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for dashboard endpoint rate limit exemption

  - [x] 3.1 Add dashboard endpoint classification function
    - Create `isDashboardEndpoint(path: string): boolean` function in `api/middleware/rateLimiting.ts`
    - Identify dashboard patterns: `/api/auth/me`, `/api/auth/refresh`, `/api/notifications/`, `/api/health`, `/api/admin/users/search`
    - Return true if path matches any dashboard pattern, false otherwise
    - _Bug_Condition: isBugCondition(input) where input.endpoint IN dashboard patterns AND requestCount >= rateLimit_
    - _Expected_Behavior: Dashboard endpoints receive 10x higher rate limits (2000/5000/10000 per 15 minutes)_
    - _Preservation: External API endpoints continue to enforce existing rate limits (200/500/1000 per 15 minutes)_
    - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Update rate limit key generation to separate dashboard and API requests
    - Modify key generation in `smartRateLimit` to include endpoint type prefix
    - Use format: `${endpointType}:${generateRateLimitKey(req, userType)}`
    - Ensure dashboard and external API requests use separate rate limit buckets
    - Prevent cross-contamination between dashboard and API request counts
    - _Bug_Condition: isBugCondition(input) where dashboard requests share rate limit keys with API requests_
    - _Expected_Behavior: Dashboard and external API requests tracked separately_
    - _Preservation: External API rate limit keys remain unchanged in format and behavior_
    - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.3 Implement tiered rate limiting based on endpoint classification
    - In `smartRateLimit` function (around line 360), add conditional logic to select appropriate limits
    - Extract request path: `const requestPath = req.originalUrl.split('?')[0]`
    - Check if dashboard: `const isDashboard = isDashboardEndpoint(requestPath)`
    - Apply 10x multiplier for dashboard endpoints: `effectiveLimit = baseConfig.limit * 10`
    - Apply standard limits for external API endpoints: `effectiveLimit = baseConfig.limit`
    - Ensure windowMs remains consistent (15 minutes) for both endpoint types
    - _Bug_Condition: isBugCondition(input) where uniform rate limiting applied to all endpoints_
    - _Expected_Behavior: Dashboard endpoints get 10x higher limits, preventing 429 during normal usage_
    - _Preservation: External API endpoints receive unchanged limits (200/500/1000)_
    - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.4 Update metrics recording to distinguish endpoint types
    - Ensure rate limit metrics include endpoint type (dashboard vs api) for monitoring
    - Update logging to show which endpoint type triggered rate limit events
    - Maintain existing metrics collection functionality
    - _Bug_Condition: isBugCondition(input) where metrics don't distinguish endpoint types_
    - _Expected_Behavior: Metrics clearly show dashboard vs external API rate limit usage_
    - _Preservation: Existing metrics collection and logging continue to function_
    - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Dashboard Endpoints Exempt from Strict Rate Limiting
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (dashboard endpoints should not return 429 during normal usage)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - Verify authenticated users can make 2000+ requests to `/api/auth/me` without 429
    - Verify admin users can make 10000+ requests to `/api/notifications/unread` without 429
    - Verify rapid user searches to `/api/admin/users/search` don't hit rate limits during normal usage
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.4_

  - [x] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - External API Rate Limiting Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - Verify VPS endpoints still enforce standard limits (500 for authenticated users)
    - Verify payment endpoints still enforce standard limits
    - Verify support ticket endpoints still enforce standard limits
    - Verify anonymous users still get 200 requests per 15 minutes on all endpoints
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions to external API protection)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run complete test suite to verify bug is fixed and no regressions introduced
  - Verify rate limit metrics correctly distinguish between dashboard and external API requests
  - Verify rate limit headers reflect correct limits for each endpoint type
  - Ensure all tests pass, ask the user if questions arise
