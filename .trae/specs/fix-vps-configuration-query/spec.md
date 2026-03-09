# Fix VPS Configuration Query Spec

## Why
The frontend `Organizations` page crashes with `TypeError: Cannot read properties of undefined (reading 'type')` when trying to render VPS instances.
This is because the frontend code expects `vps.configuration` to exist (accessing `vps.configuration.type`), but the backend `GET /resources` endpoint does not select the `configuration` column from the `vps_instances` table.
This issue was exposed after fixing the resource visibility and response format, allowing the frontend to actually attempt rendering the VPS list.

## What Changes

### Backend (`api/routes/organizations.ts`)

-   **Modify `GET /resources` Endpoint**:
    -   Update the SQL query for fetching `vps_instances` to include the `configuration` column.

## Impact
-   **Affected Specs**: None.
-   **Affected Code**: `api/routes/organizations.ts`.
-   **User Experience**: The Organizations page will load correctly and display VPS details (type and region) without crashing.

## MODIFIED Requirements
### Requirement: VPS Resource Details
The system SHALL return the `configuration` field for VPS instances in the `GET /resources` endpoint to support frontend display requirements.

#### Scenario: View VPS List
-   **WHEN** the frontend renders the VPS list
-   **THEN** it can access `vps.configuration.type` and `vps.configuration.region` without errors.
