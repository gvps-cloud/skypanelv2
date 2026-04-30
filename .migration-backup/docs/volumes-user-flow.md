# Block Storage Volumes User Flow

How the current volume billing and administration surface works in SkyPanelV2.

## Overview

Block Storage Volumes are additional persistent storage volumes that can be attached to VPS instances. The current shipped implementation includes admin-facing volume type management and volume billing visibility. User-facing `/api/volumes*` routes described in older planning docs are not mounted in `api/app.ts` yet.

## Volume Lifecycle

### 1. Volume Type Configuration (Admin)

Admins configure volume types at **Billing → Volume Pricing → Volume Types**:

- **Label**: Display name (e.g., "NVMe Block Storage")
- **Storage Type**: `ssd` or `nvme`
- **Size Range**: Min/max size in GB (e.g., 10–10000 GB)
- **Price per GB/hour**: Hourly billing rate (e.g., $0.000015/GB/hr)
- **Region pricing**: Optional region-specific overrides

### 2. Volume Creation (Planned User Flow)

Users with `vps_manage` permission are intended to create volumes via the VPS detail page or a dedicated volumes UI:

1. Select volume type and size
2. Choose region (must match the VPS region for attachment)
3. Volume is created in Linode API → record stored in `volumes` table
4. Volume status transitions: `creating` → `active`

### 3. Volume Attachment (Planned User Flow)

A volume can be attached to a VPS instance:

1. Volume must be in `active` status
2. Volume region must match VPS region
3. Call Linode API `POST /volumes/{volumeId}/attach` with `linode_id`
4. Update `vps_id` in `volumes` table

### 4. Volume Detachment (Planned User Flow)

1. Unmount the volume on the VPS (umount)
2. Call Linode API `POST /volumes/{volumeId}/detach`
3. Clear `vps_id` in `volumes` table → status returns to `active`

### 5. Volume Deletion (Planned User Flow)

1. Volume must be detached first (or VPS must be deleted)
2. Call Linode API `DELETE /volumes/{volumeId}`
3. Delete record from `volumes` table

## Billing

Volumes are billed hourly based on `size_gb × price_per_gb_hour`:

```
hourly_charge = volume.size_gb × volume_types.price_per_gb_hour
```

Billing records are stored in `volume_billing` table and included in the organization's wallet billing cycle.

## Database Schema

### `volume_types`
Stores pricing tier definitions. Seeded with default SSD and NVMe types on migration.

### `volumes`
Per-organization volume instances. Fields:
- `organization_id`: Owner organization
- `vps_id`: Attached VPS (NULL if detached)
- `provider_volume_id`: Linode API volume ID
- `size_gb`, `storage_type`, `region`, `status`
- `hourly_price`: Captured at creation time

### `volume_billing`
Hourly billing records linking `volumes` → `organizations` with size and rate info for billing reconciliation.

## Linode API Endpoints Used

| Action | Method | Endpoint |
|--------|--------|----------|
| List volumes | GET | `/v4/volumes` |
| Create volume | POST | `/v4/volumes` |
| Get volume | GET | `/v4/volumes/{volumeId}` |
| Update volume | PUT | `/v4/volumes/{volumeId}` |
| Delete volume | DELETE | `/v4/volumes/{volumeId}` |
| Attach volume | POST | `/v4/volumes/{volumeId}/attach` |
| Detach volume | POST | `/v4/volumes/{volumeId}/detach` |
| Resize volume | POST | `/v4/volumes/{volumeId}/resize` |
| Clone volume | POST | `/v4/volumes/{volumeId}/clone` |
| List volume types | GET | `/v4/volumes/types` |

## Route Structure

- `GET /api/admin/volume-billing/volume-types` — List volume types
- `POST /api/admin/volume-billing/volume-types` — Create volume type
- `PUT /api/admin/volume-billing/volume-types/:id` — Update volume type
- `DELETE /api/admin/volume-billing/volume-types/:id` — Delete volume type
- `GET /api/admin/volume-billing/volumes` — List all volumes (all orgs)
- `GET /api/admin/volume-billing/volumes/overview` — Volume billing overview
- `GET /api/admin/volume-billing/volumes/:id/billing` — Volume billing history

## Current Status

- Admin volume billing routes are mounted under `/api/admin/volume-billing`.
- The admin UI lives in `src/components/admin/billing/VolumePricing.tsx`.
- User-facing `/api/volumes*` routes are still planned work and are not mounted today.
- The security test file `tests/security/volume-isolation.test.ts` currently validates the intended isolation rules described by the roadmap, not a mounted production route group.

## Linode Coverage

See `docs/linode-coverage-matrix.md` for the Linode API coverage matrix.
See `docs/linode-feature-roadmap.md` for the feature roadmap including volume management.
