# Egress Billing System Documentation

## Overview

The SkyPanelV2 egress billing system implements a **pre-paid credit model with hourly enforcement** to prevent abuse and ensure the reseller never incurs unpayable debt for consumed network transfer.

**IMPORTANT: Egress credits are organization-scoped, not user-scoped. All members of an organization share the same credit pool.**

### Problem Statement

Previous monthly-only billing had a critical vulnerability:
- Users could create VPS instances, consume excess transfer (e.g., 500GB+ overage), and delete the VPS before the monthly billing cycle (1st of month)
- When billing ran, if the user's wallet was empty, billing failed
- The reseller remained liable to Linode for the consumed transfer
- No real-time enforcement prevented accumulation of unpayable debt

### Solution

**Hourly polling with pre-paid credits**:
- Poll Linode transfer API every 60 minutes
- Calculate delta from previous reading
- Deduct credits **immediately** when transfer is consumed
- Auto-shutdown VPS when organization's credit balance is insufficient
- Pre-payment model prevents debt accumulation

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HOURLY BILLING LOOP                             │
│                    (runs every 60 minutes in server.ts)                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  EgressHourlyBillingService.runHourlyBilling()              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. Get all active VPS instances (status IN ('running', 'provisioning',  │ │
│  │    'rebooting', 'migrating'))                                          │ │
│  │ 2. For each VPS:                                                       │ │
│  │    a. Fetch current transfer from Linode API                           │ │
│  │    b. Get last hourly reading from database                            │ │
│  │    c. Calculate delta = current - last                                 │ │
│  │    d. If delta > included quota, deduct credits                        │ │
│  │    e. If insufficient credits, suspend VPS                             │ │
│  │    f. Record hourly reading                                            │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Migration 030: `migrations/030_add_egress_credits_system.sql`

#### Table: `organization_egress_credits`
Stores pre-paid egress credit balance per organization.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | FK to organizations (unique) |
| `credits_gb` | DECIMAL(18,6) | Available credits (CHECK >= 0) |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

#### Table: `egress_credit_packs`
Records credit pack purchases.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | FK to organizations |
| `pack_id` | VARCHAR(50) | Pack identifier (100GB, 1TB, 5TB, 10TB) |
| `credits_gb` | DECIMAL(18,6) | Credits purchased |
| `amount_paid` | DECIMAL(12,6) | Price paid (USD) |
| `payment_transaction_id` | UUID | FK to payment_transactions |
| `created_at` | TIMESTAMPTZ | Purchase timestamp |

#### Table: `vps_egress_hourly_readings`
Stores hourly transfer readings for delta calculation.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `vps_instance_id` | UUID | FK to vps_instances |
| `organization_id` | UUID | FK to organizations |
| `provider_instance_id` | INT | Linode instance ID |
| `transfer_used_gb` | DECIMAL(18,6) | Total transfer used (from provider) |
| `delta_gb` | DECIMAL(18,6) | New transfer since last reading |
| `credits_deducted_gb` | DECIMAL(18,6) | Credits deducted for delta |
| `reading_at` | TIMESTAMPTZ | When reading was taken |

---

## Credit Pack Configuration

Credit packs are stored in `platform_settings` under key `egress_credit_packs`:

```json
[
  {"id": "100GB", "gb": 100, "price": 0.50},
  {"id": "1TB", "gb": 1000, "price": 5.00},
  {"id": "5TB", "gb": 5000, "price": 25.00},
  {"id": "10TB", "gb": 10000, "price": 50.00}
]
```

**Pricing Formula**: $0.005 per GB (5 GB per cent)

### Configurable Settings

| Setting Key | Type | Default | Description |
|-------------|------|---------|-------------|
| `egress_credit_packs` | JSON array | `[...]` | Available credit packs with pricing |
| `egress_warning_threshold_gb` | Number | `200` | Warning threshold in GB - shows warning when balance below this |

---

## Organization-Scoped Architecture

**Egress credits are organization-scoped, not user-scoped.**

### Key Points

1. **Shared Pool**: All members of an organization share the same credit balance
2. **Organization Context**: All credit operations use `organization_id` as the primary key
3. **Permission-Based Access**: Fine-grained permissions control who can view and manage credits
4. **Multi-Org Support**: Users can belong to multiple organizations with separate credit pools

### Role Permissions

| Permission | Description | Owner | Admin | Member |
|------------|-------------|:-------:|:-----:|:------|
| `egress_view` | View egress credits and usage | ✓ | ✓ | - |
| `egress_manage` | Purchase/add egress credits | ✓ | - | - |

---

## API Routes

### Egress Routes (`/api/egress/*`)

| Method | Route | Permission | Description |
|--------|-------|-----------|-------------|
| `GET` | `/credits` | `egress_view` | Get organization's credit balance |
| `GET` | `/credits/history` | `egress_view` | Get organization's credit purchase history |
| `GET` | `/credits/packs` | `egress_view` | Get available credit packs |
| `POST` | `/credits/purchase` | `egress_manage` | Initialize PayPal purchase |
| `POST` | `/credits/purchase/complete` | `egress_manage` | Complete purchase after PayPal |

### VPS Usage Routes (`/api/egress/usage/:vpsId`)

| Method | Route | Permission | Description |
|--------|-------|-----------|-------------|
| `GET` | `/usage/:vpsId` | `egress_view` | Get hourly usage readings for specific VPS |
| `GET` | `/usage/:vpsId/summary` | `egress_view` | Get VPS monthly usage summary |

### Admin Routes (`/api/egress/admin/*`)

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/admin/credits/:orgId` | Admin: Manually add credits to organization |
| `GET` | `/admin/credits/:orgId/balance` | Admin: View organization's balance and history |
| `POST` | `/admin/billing/run` | Admin: Manually trigger hourly billing |
| `GET` | `/admin/settings/packs` | Admin: Get credit pack configuration |
| `PUT` | `/admin/settings/packs` | Admin: Update credit pack pricing |

---

## Backend Services

### `api/services/egressCreditService.ts`

Core service for credit management operations.

#### Key Functions

| Function | Description |
|----------|-------------|
| `getEgressCreditBalance(organizationId)` | Get current balance in GB |
| `getEgressCreditBalanceDetails(organizationId)` | Get balance with warning flag (<200GB) |
| `purchaseEgressCredits(orgId, packId, paymentTxnId, userId)` | Add credits from payment |
| `deductEgressCredits(orgId, gb, vpsInstanceId?)` | Deduct credits, throws InsufficientCreditsError if low |
| `addEgressCredits(orgId, gb, adminUserId, reason?)` | Admin manual credit addition |
| `suspendVPSForInsufficientCredits(vpsId, orgId)` | Shutdown VPS and mark as suspended |

### `api/services/egressHourlyBillingService.ts`

Hourly billing orchestrator.

#### Exported Service

```typescript
export const EgressHourlyBillingService = {
  runHourlyBilling,        // Run billing for all organizations
  runForOrg,               // Run billing for a specific organization
};
```

#### Main Functions

```typescript
export async function runHourlyBilling(): Promise<{
  success: boolean;
  billedCount: number;
  suspendedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: string[];
}>

export async function runHourlyBillingForOrg(organizationId: string): Promise<{
  success: boolean;
  billedCount: number;
  suspendedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: string[];
}>
```

---

## Frontend Components

### Organization Egress Tab (`src/pages/Organizations.tsx`)

**Primary location for egress credit management.**

**Route**: `/organizations/:id` → "Egress" tab

**Features**:
- **Egress Billing Overview** - Monthly egress usage and overage charges
- **Egress Credits Section** - Shows organization's credit balance
- **"Shared Pool" Banner** - Clearly indicates credits are shared across all org members
- **Purchase Credits Button** - Only shown if user has `egress_manage` permission
- **Purchase History** - Recent credit pack purchases
- **Permission-Based Access** - Members can view but not purchase (without permission)

### VPS Detail Page (`src/pages/VPSDetail.tsx`)

Enhanced with egress usage section in Networking tab.

**Features**:
- Display organization's remaining credit balance
- Show current month's credits used by this VPS
- Warning when balance is low
- Link to purchase credits (redirects to organization's Egress tab)

### Admin Component

#### `src/components/admin/EgressCreditManager.tsx`

Admin interface for managing organization credits.

**Features**:
- Search organizations by name or ID
- View organization's credit balance and purchase history
- Manually add credits with optional reason
- View detailed purchase history in dialog

**Access**: Admin Dashboard → Egress Credits section

---

## Purchase Flow

### Organization Credit Purchase Flow

```
1. User navigates to /organizations/:id and clicks "Egress" tab
2. User clicks "Purchase Credits" button (requires egress_manage permission)
3. System checks if viewing active organization:
   - If yes: Proceed with purchase
   - If no: Switch organization context first, then redirect
4. POST /api/egress/credits/purchase
   → Creates PayPal order
   → Returns approval URL
5. User approves payment on PayPal
6. PayPal redirects back with success
7. POST /api/egress/credits/purchase/complete
   → Verifies payment completed
   → Checks not already applied
   → Calls purchaseEgressCredits()
   → Adds credits to organization
8. Balance updates, purchase recorded, activity logged
```

---

## Abuse Prevention Mechanism

### How Abuse Is Prevented

1. **Pre-payment Required**
   - Organizations must purchase credits before consuming overage
   - No credit = no overage usage possible

2. **Hourly Enforcement**
   - Billing runs every 60 minutes, not monthly
   - Maximum exposure window: 1 hour of usage

3. **Auto-Shutoff**
   - VPS instances automatically suspended when credits exhausted
   - Prevents continued consumption without payment

4. **No Debt Accumulation**
   - System throws InsufficientCreditsError if balance insufficient
   - Database CHECK constraint prevents negative balances
   - Transaction safety with row-level locking (`FOR UPDATE`)

---

## Activity Logging

All credit operations are logged to `activity_logs`:

| Event Type | Description |
|------------|-------------|
| `egress.credits.purchased` | Organization purchased credit pack |
| `egress.credits.admin_added` | Admin manually added credits to organization |
| `egress.credits.purchase_initiated` | Credit purchase initiated (before PayPal) |
| `egress.settings.packs_updated` | Admin updated credit pack configuration |
| `vps.suspended` | VPS suspended due to insufficient credits |
| `egress.billing.admin_run` | Admin manually triggered billing |

---

## Migration Notes

### Database Migration

```bash
# Apply the egress credits system migration
node scripts/apply-single-migration.js 030_add_egress_credits_system.sql

# Or reset and run all migrations
npm run db:fresh
```

### Default Configuration

After migration, credit packs are automatically seeded into `platform_settings`.

### Role Permissions Migration

Existing organizations will need to have their roles updated to include the new egress permissions. The `RoleService.initializeDefaultRoles()` function handles this automatically when first accessed.

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| VPS suspended despite credits | Credits exhausted during hourly billing | Admin adds credits, user restarts VPS |
| Can't see egress credits | Missing `egress_view` permission | Admin updates organization role |
| Can't purchase credits | Missing `egress_manage` permission | Admin updates organization role |
| Credits not showing for org | No credit row exists | Admin adds credits or user purchases pack |
| "Not a member of this organization" | Trying to access other org's credits | Navigate to correct organization |

### Log Locations

- Server logs: Console output from `server.ts`
- Activity logs: `activity_logs` table
- Billing results: Check console for `EgressHourlyBillingService` output

---

## Testing Checklist

### Manual Testing

- [ ] Organization owner purchases 100GB credit pack via Organizations → Egress tab
- [ ] Credits appear in balance after purchase
- [ ] Hourly billing deducts credits when overage consumed
- [ ] VPS suspends when credits exhausted
- [ ] Admin can add credits manually via admin interface
- [ ] Suspended VPS can be restarted after adding credits
- [ ] Purchase history displays correctly in organization Egress tab
- [ ] Warning banner shows when balance < 200GB
- [ ] Organization members with `egress_view` can see credits but not purchase
- [ ] Organization members with `egress_manage` can purchase credits
- [ ] Different organizations have separate credit pools

### Permission Testing

- [ ] Create user with no egress permissions - should not see credits section
- [ ] Grant `egress_view` only - can see balance, no purchase button
- [ ] Grant `egress_manage` - can see balance and purchase button
- [ ] Owner has both permissions by default
