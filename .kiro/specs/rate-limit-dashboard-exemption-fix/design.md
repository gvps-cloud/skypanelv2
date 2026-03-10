# Rate Limit Dashboard Exemption Fix - Bugfix Design

## Overview

The bug occurs when the global `smartRateLimit` middleware applies strict rate limiting to all `/api` routes without distinguishing between external API endpoints (which need protection) and internal dashboard endpoints (which need high availability). When users hit their rate limits (200/500/1000 requests per 15 minutes), the middleware returns HTTP 429 responses that disrupt dashboard functionality and can trigger authentication logout flows.

The fix will implement selective rate limiting by exempting critical dashboard endpoints from strict limits while maintaining protection on external API endpoints. This ensures uninterrupted dashboard operations while preserving security against API abuse.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when authenticated users make frequent requests to dashboard endpoints and hit rate limits, causing 429 responses that disrupt the UI
- **Property (P)**: The desired behavior - dashboard endpoints should have significantly higher rate limits or be exempt to prevent UI disruption
- **Preservation**: Existing rate limiting behavior on external API endpoints (VPS, payments, support) must remain unchanged
- **smartRateLimit**: The middleware function in `api/middleware/rateLimiting.ts` that applies rate limiting to all `/api` routes
- **Dashboard Endpoints**: Internal API routes that support UI functionality (auth checks, notifications, health checks, user search)
- **External API Endpoints**: Routes that perform resource-intensive operations (VPS provisioning, payment processing, support ticket creation)

## Bug Details

### Bug Condition

The bug manifests when authenticated users make frequent requests to dashboard endpoints (polling notifications, checking authentication status, searching users) and exceed their rate limits. The `smartRateLimit` middleware applies the same strict limits to all `/api` routes, causing HTTP 429 responses on critical dashboard endpoints that should have higher availability.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { request: Request, userType: UserType, endpoint: string }
  OUTPUT: boolean
  
  RETURN input.userType IN ['authenticated', 'admin']
         AND input.endpoint IN ['/api/auth/me', '/api/notifications/*', '/api/health', '/api/admin/users/search']
         AND requestCount(input.request) >= rateLimit(input.userType)
         AND httpStatus(response) == 429
END FUNCTION
```

### Examples

- **Auth Check Polling**: User's dashboard polls `/api/auth/me` every 30 seconds. After 500 requests (authenticated limit), the endpoint returns 429, causing the frontend to interpret this as authentication failure and log the user out.

- **Notification Polling**: Admin user's dashboard polls `/api/notifications/unread` every 10 seconds. After 1000 requests (admin limit), the endpoint returns 429, disrupting real-time notification updates.

- **User Search**: Admin performs rapid user searches in `/api/admin/users/search` while managing accounts. After hitting the rate limit, searches fail with 429, making the admin interface unusable.

- **Edge Case**: During high activity periods, multiple dashboard components make concurrent requests. The combined request count quickly exceeds limits, causing widespread 429 responses across the dashboard.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- External API endpoints (VPS provisioning, payment processing, support tickets) must continue to enforce existing rate limits (200/500/1000 per 15 minutes)
- Anonymous user rate limiting (200 requests per 15 minutes) must remain unchanged for all endpoints
- Rate limit logging and metrics collection must continue to function for monitoring
- Rate limit override functionality for specific users must continue to work

**Scope:**
All inputs that do NOT involve dashboard endpoints should be completely unaffected by this fix. This includes:
- VPS management endpoints (`/api/vps/*`, `/api/admin/vps/*`)
- Payment endpoints (`/api/payments/*`, `/api/admin/payments/*`)
- Support ticket endpoints (`/api/support/*`, `/api/admin/support/*`)
- Organization management endpoints (`/api/admin/organizations/*`)
- Any other resource-intensive API operations

## Hypothesized Root Cause

Based on the bug description and code analysis, the root cause is:

1. **Uniform Rate Limiting Application**: The `smartRateLimit` middleware is applied globally to all `/api` routes via `app.use("/api", smartRateLimit)` in `api/app.ts` line 83, without distinguishing between endpoint types.

2. **No Endpoint Classification**: The middleware does not categorize endpoints as "dashboard" vs "external API", treating all routes equally regardless of their resource intensity or criticality to UI functionality.

3. **Development Mode Exemption Insufficient**: While the code has a development mode exemption for certain endpoints (lines 372-395 in `rateLimiting.ts`), this only applies in `NODE_ENV=development` and doesn't help production users.

4. **Frontend 429 Handling**: When dashboard endpoints return 429, the frontend may interpret this as an authentication or authorization failure, triggering logout flows or UI disruption.

## Correctness Properties

Property 1: Bug Condition - Dashboard Endpoints Exempt from Strict Rate Limiting

_For any_ authenticated or admin user request to dashboard endpoints (`/api/auth/me`, `/api/notifications/*`, `/api/health`, `/api/admin/users/search`), the fixed rate limiting middleware SHALL apply significantly higher rate limits (10x base limits) or exempt these endpoints entirely, preventing HTTP 429 responses during normal dashboard usage.

**Validates: Requirements 2.1, 2.2, 2.4**

Property 2: Preservation - External API Rate Limiting Unchanged

_For any_ request to external API endpoints (VPS management, payments, support tickets, organizations) where the bug condition does NOT hold, the fixed rate limiting middleware SHALL apply the same rate limits as the original implementation (200/500/1000 requests per 15 minutes based on user type), preserving protection against API abuse.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `api/middleware/rateLimiting.ts`

**Function**: `smartRateLimit`

**Specific Changes**:

1. **Add Dashboard Endpoint Classification**: Create a function to identify dashboard endpoints that need exemption or higher limits:
   ```typescript
   function isDashboardEndpoint(path: string): boolean {
     const dashboardPatterns = [
       '/api/auth/me',
       '/api/auth/refresh',
       '/api/notifications/',
       '/api/health',
       '/api/admin/users/search',
     ];
     return dashboardPatterns.some(pattern => path.startsWith(pattern));
   }
   ```

2. **Implement Tiered Rate Limiting**: Modify the `smartRateLimit` middleware to apply different limits based on endpoint classification:
   - Dashboard endpoints: 10x higher limits (2000/5000/10000 per 15 minutes)
   - External API endpoints: Current limits (200/500/1000 per 15 minutes)

3. **Update Rate Limit Key Generation**: Ensure dashboard and external API requests use separate rate limit keys to prevent cross-contamination:
   ```typescript
   const endpointType = isDashboardEndpoint(requestPath) ? 'dashboard' : 'api';
   const rateLimitKey = `${endpointType}:${generateRateLimitKey(req, userType)}`;
   ```

4. **Apply Conditional Limiting**: In the `smartRateLimit` function (around line 360), add logic to select appropriate limits:
   ```typescript
   const requestPath = req.originalUrl.split('?')[0];
   const isDashboard = isDashboardEndpoint(requestPath);
   
   if (isDashboard) {
     effectiveLimit = baseConfig.limit * 10; // 10x higher for dashboard
     effectiveWindowMs = baseConfig.windowMs;
   }
   ```

5. **Update Metrics Recording**: Ensure rate limit metrics distinguish between dashboard and external API requests for monitoring visibility.

**File**: `api/app.ts`

**No changes required** - the middleware application point remains the same, but the middleware itself becomes context-aware.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code by simulating high-frequency dashboard requests, then verify the fix works correctly and preserves existing rate limiting behavior on external API endpoints.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm that dashboard endpoints return 429 when rate limits are exceeded, causing UI disruption.

**Test Plan**: Write tests that simulate rapid requests to dashboard endpoints (auth checks, notifications, user search) and verify that the UNFIXED code returns 429 responses after exceeding rate limits. Run these tests to observe failures and confirm the root cause.

**Test Cases**:
1. **Auth Polling Test**: Simulate 501 requests to `/api/auth/me` as authenticated user (will fail on unfixed code with 429 on request 501)
2. **Notification Polling Test**: Simulate 1001 requests to `/api/notifications/unread` as admin user (will fail on unfixed code with 429 on request 1001)
3. **User Search Test**: Simulate 501 rapid searches to `/api/admin/users/search` as authenticated admin (will fail on unfixed code with 429)
4. **Concurrent Dashboard Requests**: Simulate multiple dashboard components making concurrent requests totaling 501 (will fail on unfixed code)

**Expected Counterexamples**:
- Dashboard endpoints return HTTP 429 after exceeding user-type rate limits
- Rate limit headers show `X-RateLimit-Remaining: 0` on dashboard endpoints
- Possible causes: uniform rate limiting applied to all `/api` routes, no endpoint classification

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (dashboard endpoint requests), the fixed function applies higher rate limits and prevents 429 responses during normal usage.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := smartRateLimit_fixed(input.request)
  ASSERT result.status != 429 OR input.requestCount > (baseLimit * 10)
  ASSERT result.effectiveLimit == baseLimit * 10
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (external API endpoints), the fixed function produces the same rate limiting behavior as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  result_original := smartRateLimit_original(input.request)
  result_fixed := smartRateLimit_fixed(input.request)
  ASSERT result_original.status == result_fixed.status
  ASSERT result_original.effectiveLimit == result_fixed.effectiveLimit
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across different endpoint types
- It catches edge cases where rate limiting might be incorrectly applied or exempted
- It provides strong guarantees that external API protection is unchanged

**Test Plan**: Observe behavior on UNFIXED code first for external API endpoints (VPS, payments, support), then write property-based tests capturing that exact rate limiting behavior.

**Test Cases**:
1. **VPS Endpoint Preservation**: Verify `/api/vps/create` still enforces 500 requests per 15 minutes for authenticated users after fix
2. **Payment Endpoint Preservation**: Verify `/api/payments/process` still enforces rate limits after fix
3. **Support Ticket Preservation**: Verify `/api/support/tickets` still enforces rate limits after fix
4. **Anonymous User Preservation**: Verify anonymous users still get 200 requests per 15 minutes on all endpoints

### Unit Tests

- Test `isDashboardEndpoint()` function correctly identifies dashboard vs external API endpoints
- Test rate limit key generation includes endpoint type prefix
- Test that dashboard endpoints receive 10x higher limits for each user type
- Test that external API endpoints receive unchanged limits
- Test edge cases (malformed paths, query parameters, trailing slashes)

### Property-Based Tests

- Generate random dashboard endpoint paths and verify they receive higher limits
- Generate random external API endpoint paths and verify they receive standard limits
- Generate random user types and verify correct limit multipliers are applied
- Test that rate limit metrics correctly categorize dashboard vs external API requests

### Integration Tests

- Test full request flow: authenticated user makes 501 requests to `/api/auth/me` without hitting 429
- Test full request flow: authenticated user makes 501 requests to `/api/vps/create` and hits 429 on request 501
- Test that admin users can make 1001+ requests to `/api/notifications/unread` without disruption
- Test that rate limit headers correctly reflect dashboard vs external API limits
- Test that existing rate limit override functionality still works for both endpoint types
