# Bugfix Requirements Document

## Introduction

The SkyPanelV2 application has a critical rate limiting bug where the global rate limiting middleware (`smartRateLimit`) is applied to all `/api` routes without distinction between external API abuse and internal dashboard usage. When any user hits their rate limit (200 req/15min for anonymous, 500 req/15min for authenticated, 1000 req/15min for admin), the rate limiting middleware returns a 429 status code that causes the dashboard to log users out or stop functioning entirely. This affects all users of the platform, not just the user who triggered the rate limit.

The rate limiting was designed to protect against external API abuse, but it's currently interfering with normal dashboard operations. Dashboard endpoints that support the UI (authentication checks, notifications, real-time updates) should not be subject to the same strict rate limiting as external API endpoints.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN an authenticated user makes frequent dashboard requests (e.g., polling notifications, checking auth status) and hits the rate limit THEN the system returns HTTP 429 responses that cause the dashboard to log the user out

1.2 WHEN any user exceeds their rate limit on any `/api` endpoint THEN the system applies rate limiting globally across all API routes including critical dashboard endpoints like `/api/auth/me` and `/api/notifications`

1.3 WHEN the rate limit middleware returns a 429 status THEN the frontend authentication logic interprets this as an authentication failure and logs the user out

1.4 WHEN one user hits their rate limit THEN other users may experience dashboard disruptions due to shared rate limiting keys or authentication flow interruptions

### Expected Behavior (Correct)

2.1 WHEN an authenticated user makes frequent dashboard requests to internal endpoints (auth checks, notifications, health checks) THEN the system SHALL exempt these requests from strict rate limiting to prevent dashboard disruption

2.2 WHEN a user exceeds rate limits on external API endpoints THEN the system SHALL apply rate limiting only to those specific endpoints without affecting critical dashboard functionality

2.3 WHEN the rate limit is exceeded on non-critical endpoints THEN the system SHALL return HTTP 429 without triggering authentication logout flows in the dashboard

2.4 WHEN dashboard endpoints are accessed for normal UI operations THEN the system SHALL apply significantly higher rate limits or exempt them entirely to ensure uninterrupted dashboard functionality

### Unchanged Behavior (Regression Prevention)

3.1 WHEN external API endpoints (VPS provisioning, payment processing, support ticket creation) receive requests THEN the system SHALL CONTINUE TO apply the existing rate limits (200/500/1000 requests per 15 minutes)

3.2 WHEN anonymous users access public API endpoints THEN the system SHALL CONTINUE TO enforce the 200 requests per 15 minutes limit

3.3 WHEN rate limiting is triggered on non-exempt endpoints THEN the system SHALL CONTINUE TO log rate limit events and record metrics for monitoring

3.4 WHEN authenticated users access non-dashboard API endpoints THEN the system SHALL CONTINUE TO apply user-specific rate limiting based on their authentication status and role
