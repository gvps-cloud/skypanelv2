# Bugfix Requirements Document

## Introduction

The organizations page at `/organizations` is not displaying organization statistics correctly due to a field name mismatch between the API response and the frontend TypeScript interface. The API endpoint `GET /api/organizations/` returns statistics with plural field names (`tickets_count`, `members_count`) while the frontend `OrganizationStats` interface expects singular field names (`ticket_count`, `member_count`). This causes the frontend to be unable to access and display the statistics properly.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the API endpoint `GET /api/organizations/` returns organization statistics THEN the system returns field names `tickets_count` and `members_count` (plural)

1.2 WHEN the frontend TypeScript interface `OrganizationStats` expects statistics fields THEN the system expects field names `ticket_count` and `member_count` (singular)

1.3 WHEN the organizations page attempts to display statistics THEN the system cannot access the statistics correctly due to the field name mismatch

### Expected Behavior (Correct)

2.1 WHEN the API endpoint `GET /api/organizations/` returns organization statistics THEN the system SHALL return field names `ticket_count` and `member_count` (singular) to match the TypeScript interface

2.2 WHEN the frontend TypeScript interface receives statistics from the API THEN the system SHALL successfully access all statistics fields without type mismatches

2.3 WHEN the organizations page displays statistics THEN the system SHALL correctly display VPS count, ticket count, and member count for each organization

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the API endpoint returns the `vps_count` field THEN the system SHALL CONTINUE TO return it with the same field name (already correctly named)

3.2 WHEN the API endpoint returns other organization fields (id, name, slug, member_role, role_permissions) THEN the system SHALL CONTINUE TO return them unchanged

3.3 WHEN the frontend displays organization information other than statistics THEN the system SHALL CONTINUE TO display it correctly
