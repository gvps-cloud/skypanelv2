# Design Spec: Hourly Egress Billing with Pre-Paid Credits

**Date:** 2025-03-06
**Status:** Draft
**Author:** Claude (with user input)

---

## Context

### Problem

The current monthly egress billing system has a critical abuse vulnerability:

1. Users can create VPS instances, consume network transfer overage (e.g., 500GB+), and delete the VPS before the monthly billing cycle runs (1st of each month)
2. When billing runs, if the user's wallet is empty, the billing fails
3. The user has "walked away" but the reseller still owes Linode for the consumed transfer
4. There is no real-time enforcement to prevent accumulation of unpayable debt

### Requirements

- **Real-time enforcement**: Deduct egress charges as they occur, not monthly
- **Auto-shutoff**: When user runs out of funds, immediately shut down affected VPS instances
- **Pre-payment**: Users must purchase egress credits upfront (no post-pay billing)
- **Self-service**: Users can purchase credit packs via the billing interface
- **Admin override**: Admins can manually add credits to organizations

### Success Criteria

- Users cannot consume egress overage without having pre-paid credits
- VPS instances are automatically shut down when credits are exhausted
- Credit balance is visible to users in real-time
- Credit purchases integrate with existing PayPal payment flow

---

## Architecture

### Data Model

#### New Table: `organization_egress_credits`

Tracks egress credit balance per organization.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| organization_id | UUID | FK → organizations(id), ON DELETE CASCADE | Organization |
| credits_gb | DECIMAL(18,6) | NOT NULL DEFAULT 0 | Available credits in GB |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | First credit added |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Last update |

**Index:** `organization_id` (unique)

#### New Table: `egress_credit_packs`

Records credit pack purchases.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| organization_id | UUID | FK → organizations(id), ON DELETE CASCADE | Purchaser |
| pack_id | VARCHAR(50) | NOT NULL | Pack identifier (e.g., '1TB') |
| credits_gb | DECIMAL(18,6) | NOT NULL | GB of credits purchased |
| amount_paid | DECIMAL(12,6) | NOT NULL | USD amount |
| payment_transaction_id | UUID | FK → payment_transactions(id) | Payment record |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Purchase time |

**Indexes:** `organization_id`, `payment_transaction_id`

#### New Table: `vps_egress_hourly_readings`

Tracks hourly transfer readings for delta calculation.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| vps_instance_id | UUID | FK → vps_instances(id), ON DELETE CASCADE | VPS |
| organization_id | UUID | FK → organizations(id) | Owner |
| provider_instance_id | INT | NOT NULL | Linode instance ID |
| transfer_used_gb | DECIMAL(18,6) | NOT NULL | Cumulative transfer (GB) |
| delta_gb | DECIMAL(18,6) | NOT NULL | GB since last reading |
| credits_deducted_gb | DECIMAL(18,6) | NOT NULL | Credits deducted |
| reading_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Reading timestamp |

**Indexes:** `vps_instance_id`, `organization_id`, `reading_at`

#### New Platform Setting: `egress_credit_packs`

Configurable credit pack offerings stored in `platform_settings` table.

```json
{
  "egress_credit_packs": [
    { "id": "100GB", "gb": 100, "price": 0.50 },
    { "id": "1TB", "gb": 1000, "price": 5.00 },
    { "id": "5TB", "gb": 5000, "price": 25.00 },
    { "id": "10TB", "gb": 10000, "price": 50.00 }
  ]
}
```

---

## Data Flow

### Hourly Billing Loop

```
┌─────────────────────────────────────────────────────────────────────┐
│                    HOURLY BILLING LOOP                              │
│                   (runs every 60 minutes)                           │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
         ┌──────────────────────────────────────────────┐
         │  1. Get all active VPS instances             │
         │     - status = 'active' or 'running'         │
         │     - provider_type = 'linode'               │
         └──────────────────────────────────────────────┘
                              │
                              ▼
         ┌──────────────────────────────────────────────┐
         │  2. For each VPS:                            │
         │     a. Fetch transfer from Linode API        │
         │     b. Get last hourly reading               │
         │     c. Calculate delta = current - last      │
         │     d. Deduct delta from org credits         │
         │     e. Record hourly reading                 │
         └──────────────────────────────────────────────┘
                              │
                              ▼
         ┌──────────────────────────────────────────────┐
         │  3. If credits <= 0 (deduction fails):       │
         │     a. Log warning                           │
         │     b. Call linodeService.shutdownInstance() │
         │     c. Update VPS status to 'suspended'      │
         │     d. Send notification to user             │
         │     e. Record activity log                   │
         └──────────────────────────────────────────────┘
```

### Credit Purchase Flow

```
User → Clicks "Purchase Credits"
       ↓
   Select Pack (100GB, 1TB, 5TB, 10TB)
       ↓
   POST /api/egress/credits/purchase
       ↓
   PayPalService.createOrder()
       ↓
   User approves payment
       ↓
   PayPalService.captureOrder()
       ↓
   EgressCreditService.purchaseCredits()
       ↓
   Credits added to organization_egress_credits
       ↓
   Record in egress_credit_packs
       ↓
   Send confirmation notification
```

---

## Components

### 1. EgressCreditService (New File)

**Location:** `api/services/egressCreditService.ts`

**Methods:**

| Method | Description |
|--------|-------------|
| `getBalance(organizationId: string)` | Get current credit balance in GB |
| `purchaseCredits(organizationId: string, packId: string, paymentTransactionId: string)` | Add credits from purchased pack |
| `deductCredits(organizationId: string, gb: number)` | Deduct credits, throws if insufficient |
| `addCredits(organizationId: string, gb: number, reason?: string)` | Admin function to manually add credits |
| `getPurchaseHistory(organizationId: string)` | Get list of credit pack purchases |
| `suspendVPSForInsufficientCredits(vpsInstanceId: string)` | Shut down VPS and update status |
| `reactivateVPSAfterRefill(vpsInstanceId: string)` | Restart VPS after credits added |

### 2. Hourly Billing Scheduler (Add to server.ts)

**Location:** `api/server.ts`

**Function:** `runHourlyEgressBilling()`

```typescript
async function runHourlyEgressBilling(runType: 'initial' | 'scheduled') {
  console.log(`🌐 Starting ${runType} hourly egress billing...`);

  const activeVPS = await getActiveVPSInstances();
  let suspendedCount = 0;
  let billedCount = 0;

  for (const vps of activeVPS) {
    const transfer = await linodeService.getLinodeInstanceTransfer(vps.provider_instance_id);
    const lastReading = await getLastHourlyReading(vps.id);

    const currentGb = bytesToGb(transfer.used);
    const deltaGb = lastReading ? currentGb - lastReading.transfer_used_gb : currentGb;

    if (deltaGb <= 0) continue; // No usage or negative (Linode reset)

    try {
      await EgressCreditService.deductCredits(vps.organization_id, deltaGb);
      await recordHourlyReading(vps.id, currentGb, deltaGb);
      billedCount++;
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        await EgressCreditService.suspendVPSForInsufficientCredits(vps.id);
        suspendedCount++;
      }
    }
  }

  console.log(`✅ Egress billing: ${billedCount} billed, ${suspendedCount} suspended`);
}
```

### 3. API Routes (New Routes)

**Location:** `api/routes/egress.ts` (new file)

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/egress/credits` | GET | User | Get current credit balance |
| `/api/egress/credits/purchase` | POST | User | Initiate credit pack purchase |
| `/api/egress/credits/history` | GET | User | Get purchase history |
| `/api/egress/usage/:vpsId` | GET | User | Get hourly usage for specific VPS |
| `/api/admin/egress/credits/:orgId` | POST | Admin | Manually add credits to org |
| `/api/admin/egress/credits/:orgId/balance` | GET | Admin | View org credit balance |
| `/api/admin/egress/settings/packs` | GET/POST | Admin | Manage credit pack configs |

### 4. Frontend Components

#### New Page: EgressCredits.tsx

**Location:** `src/pages/EgressCredits.tsx`

**Features:**
- Large credit balance display
- Progress bar (credits / total purchased)
- "Purchase Credits" button → pack selection modal
- Credit pack cards (100GB, 1TB, 5TB, 10TB) with pricing
- Purchase history table (date, pack, amount, transaction ID)
- Warning banner when credits < 20%

#### Modify: VPSDetail.tsx

Add "Egress Usage" section showing:
- Credits used by this VPS (current month)
- Organization's remaining credits
- Warning if balance low

#### Modify: Billing.tsx

Add "Egress Credits" tab/section with link to dedicated page.

#### New Admin Component: EgressCreditManager.tsx

**Location:** `src/components/admin/EgressCreditManager.tsx`

**Features:**
- Search organization by ID/name
- View credit balance
- Add credits (admin override)
- View credit history

---

## API Endpoints

### GET /api/egress/credits

Get organization's egress credit balance.

**Response:**
```json
{
  "credits_gb": 450.5,
  "credits_remaining_percent": 45,
  "warning": true
}
```

### POST /api/egress/credits/purchase

Purchase a credit pack.

**Request:**
```json
{
  "pack_id": "1TB"
}
```

**Response:**
```json
{
  "success": true,
  "paypal_order_id": "XXX",
  "redirect_url": "https://www.paypal.com/checkout/..."
}
```

### POST /api/admin/egress/credits/:orgId

Admin: Add credits to an organization.

**Request:**
```json
{
  "credits_gb": 100,
  "reason": "Support refund"
}
```

---

## Error Handling

| Error | Handling |
|-------|----------|
| Insufficient credits | Throw `InsufficientCreditsError`, trigger VPS shutdown |
| Linode API failure | Retry 3x with exponential backoff, don't fail entire cycle |
| PayPal failure | Don't deduct credits; return error to user |
| Database failure | Transaction rollback; log for manual reconciliation |
| Missing credit balance | Auto-create with 0 balance (idempotent) |

---

## Testing Strategy

### Unit Tests

1. `EgressCreditService` methods
2. Delta calculation logic
3. Credit deduction with insufficient funds
4. VPS suspension logic

### Integration Tests

1. PayPal purchase flow → credits added
2. Hourly billing → credits deducted
3. Credits exhausted → VPS shut down
4. Credits added → VPS can restart

### End-to-End Test

1. User creates VPS with 0 credits
2. User purchases 1TB credit pack
3. VPS runs, uses 100GB over 2 hours
4. Credits deducted hourly
5. User depletes credits
6. VPS automatically shuts down
7. User purchases more credits
8. User manually restarts VPS

---

## Migration Strategy

### Phase 1: Database Schema

**New migration:** `migrations/029_add_egress_credits_system.sql`

### Phase 2: Service Layer

1. Create `EgressCreditService.ts`
2. Add `runHourlyEgressBilling()` to `server.ts`
3. Integrate with hourly scheduler

### Phase 3: API Routes

1. Create `api/routes/egress.ts`
2. Add admin routes to `api/routes/admin.ts`

### Phase 4: Frontend

1. Create `EgressCredits.tsx` page
2. Update `VPSDetail.tsx`
3. Update `Billing.tsx`
4. Create `EgressCreditManager.tsx` admin component

### Phase 5: Cutover

1. Deploy with hourly billing enabled but using sandbox mode (no real deductions)
2. Test with pilot organization
3. Enable for all organizations
4. Deprecate old monthly egress billing (set `billing_enabled = false` in `region_egress_pricing`)

---

## Rollback Plan

If critical issues arise:

1. Set `billing_enabled = false` in `region_egress_pricing` table
2. Comment out `runHourlyEgressBilling()` call in `server.ts`
3. Restart server
4. Old monthly billing system remains intact
5. New data preserved for future migration

---

## Security Considerations

1. **Race conditions**: Use database transactions for credit operations
2. **Negative balance**: CHECK constraint prevents `credits_gb < 0`
3. **Admin override**: All admin credit additions logged with reason
4. **API rate limiting**: Apply to credit purchase endpoints
5. **Paypal webhook verification**: Validate all PayPal callbacks

---

## Future Enhancements

1. Credit auto-refill when below threshold
2. Credit sharing between organizations (parent/child)
3. Credit expiration (unused credits expire after N months)
4. Usage predictions based on current rate
5. Regional pricing variations for credit packs

---

## Files to Create/Modify

### Create
- `api/services/egressCreditService.ts`
- `api/routes/egress.ts`
- `src/pages/EgressCredits.tsx`
- `src/components/admin/EgressCreditManager.tsx`
- `migrations/029_add_egress_credits_system.sql`

### Modify
- `api/server.ts` - Add hourly egress billing function
- `api/app.ts` - Register egress routes
- `src/pages/VPSDetail.tsx` - Add egress usage display
- `src/pages/Billing.tsx` - Add egress credits section
- `src/App.tsx` - Add /egress-credits route

### Deprecate (eventually)
- `api/services/egressBillingService.ts` - Monthly billing logic
- `migrations/026_create_egress_billing_tables.sql` - Old schema (keep for data)
