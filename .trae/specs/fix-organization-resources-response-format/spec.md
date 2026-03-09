# Fix Organization Resources Response Format Spec

## Why
The `/organizations` page is showing "No resources found" in the "Cross-Organization Resources" section, even when the user is a member of organizations with resources.
This is caused by a mismatch between the backend API response format and what the frontend expects.
-   **Frontend (`src/pages/Organizations.tsx`)**: Expects `GET /organizations/resources` to return an object `{ resources: [...] }`.
-   **Backend (`api/routes/organizations.ts`)**: Currently returns a raw array `[...]`.
As a result, `data.resources` is `undefined` on the frontend, falling back to `[]`.

## What Changes

### Backend (`api/routes/organizations.ts`)

-   **Modify `GET /resources` Endpoint**:
    -   Change the response format from `res.json(resources)` to `res.json({ resources })`.

## Impact
-   **Affected Specs**: None.
-   **Affected Code**: `api/routes/organizations.ts`.
-   **User Experience**: Users will now correctly see the list of resources (VPSs, Tickets) for their organizations.

## MODIFIED Requirements
### Requirement: Resources API Response
The `GET /organizations/resources` endpoint SHALL return a JSON object containing a `resources` property which holds the array of organization resources.

#### Scenario: Fetch Resources
-   **WHEN** the frontend requests `/organizations/resources`
-   **THEN** the backend returns `{ "resources": [...] }`
-   **AND** the frontend correctly parses and displays the resources.
