# Bugfix Requirements Document

## Introduction

The support ticket system currently has inconsistent behavior regarding organization vs personal ticket creation. Organization members with `tickets_create` permission can only create tickets tied to their organization, but users without `tickets_view` permission are expected to see personal tickets (organization_id = NULL) that are never actually created. This creates a mismatch between the ticket creation logic and the ticket listing logic, preventing proper organization-based ticket management.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user has `tickets_create` permission but lacks `tickets_view` permission THEN the system creates organization tickets but shows them a personal ticket view that will always be empty

1.2 WHEN a user creates a ticket THEN the system always sets organization_id to the user's organization regardless of their permission level

1.3 WHEN the ticket listing logic runs for users without `tickets_view` permission THEN the system queries for personal tickets (organization_id IS NULL) that never exist

### Expected Behavior (Correct)

2.1 WHEN a user has `tickets_create` permission but lacks `tickets_view` permission THEN the system SHALL create personal tickets (organization_id = NULL) that only the creator can see

2.2 WHEN a user has both `tickets_create` and `tickets_view` permissions THEN the system SHALL create organization tickets that all organization members with `tickets_view` can see

2.3 WHEN the ticket listing logic runs THEN the system SHALL show the appropriate tickets based on the user's permission level and ticket ownership

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user has `tickets_view` permission THEN the system SHALL CONTINUE TO show all organization tickets

3.2 WHEN an admin user accesses tickets THEN the system SHALL CONTINUE TO see all tickets across all organizations

3.3 WHEN ticket replies are created THEN the system SHALL CONTINUE TO work with both personal and organization tickets

3.4 WHEN ticket notifications are sent THEN the system SHALL CONTINUE TO notify admins appropriately for both ticket types