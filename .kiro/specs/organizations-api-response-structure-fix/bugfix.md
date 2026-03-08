# Bugfix Requirements Document

## Introduction

The Organizations page at `/organizations` displays all zeros (0 organizations, 0 VPS instances, 0 support tickets, 0 team members) despite the database containing actual organization data. This occurs because of a response structure mismatch between the API endpoint and the frontend consumer.

The API endpoint `GET /api/organizations/` returns organization data as a direct array at the root level, while the frontend code expects the response to be wrapped in an object with an `organizations` property. This causes the frontend to receive `undefined` when accessing `data.organizations`, which falls back to an empty array, resulting in the page displaying zeros for all statistics.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the API endpoint `GET /api/organizations/` returns organization data THEN the system returns a direct array `[{ id, name, stats: {...} }, ...]` at the root level

1.2 WHEN the frontend Organizations page calls `apiClient.get<{ organizations: OrganizationWithStats[] }>("/organizations")` THEN the system attempts to access `data.organizations` which is undefined

1.3 WHEN `data.organizations` is undefined THEN the system falls back to an empty array `[]` causing the page to display zeros for all statistics

### Expected Behavior (Correct)

2.1 WHEN the API endpoint `GET /api/organizations/` returns organization data THEN the system SHALL return a wrapped object structure `{ organizations: [{ id, name, stats: {...} }, ...] }`

2.2 WHEN the frontend Organizations page calls `apiClient.get<{ organizations: OrganizationWithStats[] }>("/organizations")` THEN the system SHALL successfully access `data.organizations` as a populated array

2.3 WHEN `data.organizations` contains organization data THEN the system SHALL display the actual organization statistics on the page

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the API endpoint receives an authenticated request with valid token THEN the system SHALL CONTINUE TO enforce authentication and authorization checks

3.2 WHEN the API endpoint queries the database for organization statistics THEN the system SHALL CONTINUE TO calculate vps_count, ticket_count, and member_count correctly

3.3 WHEN the API endpoint encounters an error during data fetching THEN the system SHALL CONTINUE TO return a 500 status with error message

3.4 WHEN the frontend receives an error response from the API THEN the system SHALL CONTINUE TO display error toast notifications

3.5 WHEN other API endpoints return organization data in different contexts THEN the system SHALL CONTINUE TO use their existing response structures
