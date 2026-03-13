# Local Uncommitted Changes: Egress Billing System Implementation

This document summarizes the uncommitted local changes currently in the repository, which introduce a new and comprehensive server egress billing system.

## 1. New Egress Billing Services and Logic
- **`api/services/egressBillingService.ts`** (New File): Contains the core logic for the new egress billing system, replacing the old system that was removed. It handles getting live usage, executing monthly billing, syncing region pricing, and calculating egress quotas and overage charges.
- **`api/services/egressBillingService.test.ts`** (New File): Test suite for the new egress billing logic.

## 2. API Routes Additions
- **Admin Egress Routes (`api/routes/admin.ts`)**: Added comprehensive new endpoints for managing the egress billing subsystem:
  - `GET /egress/pricing` & `POST /egress/pricing/sync`: View and synchronize base egress pricing per region (e.g., from Linode).
  - `PUT /egress/pricing/:regionId`: Configure upcharge/markup for specific regions.
  - `GET /egress/live-usage`: View current, live pooled egress usage calculation per region across all active users.
  - `GET /egress/history`: View past egress billing execution cycles.
  - `POST /egress/execute`: Manually trigger or finalize a monthly egress billing cycle.
- **Organization Routes (`api/routes/organizations.ts`)**:
  - `GET /:id/egress`: Created to provide customers an overview of their own measured egress usage versus available quota pool.

## 3. Invoice Generation and Precision Improvements
- **`api/routes/invoices.ts`**: Modified invoice generator to collect egress invoice items using `EgressBillingService.listInvoiceItemsForPeriod` and merge them into standard VPS monthly billing invoices.
- **Database Precision (`api/services/invoiceService.ts`)**: Increased invoice table precision for currency (`DECIMAL(10,2)` to `DECIMAL(12,4)`) to account for sub-cent billing typical in gigabyte egress calculations.
- **`api/services/paypalService.ts` & `api/services/billingService.ts`**: Added deeper fractional number rounding (`amount.toFixed(4)`) for PayPal wallet deductions and balance logic.

## 4. Scheduled Background Jobs
- **`api/server.ts`**: Implemented `runMonthlyEgressBillingIfDue()`. Validates time constraints (1st of the month) and triggers egress billing finalization, acting as a background daemon alongside hourly active VPS billing.

## 5. UI Enhancements
- **Admin Panel (`src/pages/Admin.tsx`)**:
  - Integrated full billing tabs (`finance` vs `egress`).
  - Added new React state hooks and interfaces (`RegionEgressPricing`, `EgressAllocationPool`, `EgressBillingHistoryRecord`).
  - Introduced admin UI controls to toggle region billing configurations, manage upcharges, and monitor global bandwidth usage manually.
- **Additional Pages**: Modified `src/pages/InvoiceDetail.tsx` and `src/pages/Organizations.tsx` to display egress usage lines and invoice totals appropriately.

## 6. Database Migrations
Created migrations to establish the solid data layer for egress:
- `migrations/026_create_egress_billing_tables.sql`
- `migrations/027_reconcile_egress_pricing_schema.sql`
- `migrations/028_expand_billing_precision.sql`
