/**
 * Egress Billing Component
 * Admin interface for managing egress billing - pricing, live usage, and billing history
 */
import React from 'react';
import {
  RefreshCw,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface RegionEgressPricing {
  id: string;
  provider_type: string;
  region_id: string;
  region_label?: string | null;
  pricing_scope: "global" | "region";
  pricing_category: "core" | "special" | "distributed";
  base_price_per_gb: number;
  upcharge_price_per_gb: number;
  final_price_per_gb: number;
  billing_enabled: boolean;
  source: string;
  sync_status: "pending" | "synced" | "manual" | "error";
  synced_at?: string | null;
}

interface EgressAllocationItem {
  organizationId: string;
  organizationName: string;
  vpsInstanceId: string;
  providerInstanceId: string;
  label: string;
  regionId: string;
  measuredUsageGb: number;
  usageShare: number;
  allocatedPoolQuotaGb: number;
  allocatedBillableGb: number;
  unitPricePerGb: number;
  amount: number;
}

interface EgressAllocationPool {
  poolId: string;
  poolScope: "global" | "region";
  regionId?: string | null;
  regionLabel?: string | null;
  pricingCategory: "core" | "special" | "distributed";
  billingEnabled: boolean;
  basePricePerGb: number;
  upchargePricePerGb: number;
  finalPricePerGb: number;
  accountUsageGb: number;
  accountQuotaGb: number;
  accountBillableGb: number;
  totalMeasuredUsageGb: number;
  totalAllocatedQuotaGb: number;
  totalAllocatedBillableGb: number;
  items: EgressAllocationItem[];
}

interface EgressBillingHistoryRecord {
  id: string;
  billingMonth: string;
  poolId: string;
  poolScope: "global" | "region";
  regionId?: string | null;
  organizationId: string;
  organizationName?: string | null;
  totalMeasuredUsageGb: number;
  allocatedPoolQuotaGb: number;
  allocatedBillableGb: number;
  unitPricePerGb: number;
  totalAmount: number;
  status: "projected" | "pending" | "billed" | "failed" | "void";
  billedTransactionId?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EgressBillingProps {
  filteredEgressPricing: RegionEgressPricing[];
  filteredLiveEgressUsage: EgressAllocationPool[];
  filteredEgressHistory: EgressBillingHistoryRecord[];
  egressPricingLoading: boolean;
  liveEgressUsageLoading: boolean;
  egressHistoryLoading: boolean;
  egressPricingSyncing: boolean;
  egressExecuting: boolean;
  savingEgressRegionId: string | null;
  egressHistoryMonth: string;
  onFetchLiveEgressUsage: () => void;
  onSyncEgressPricing: () => void;
  onExecuteEgressBilling: () => void;
  onUpdateEgressPricingRegion: (regionId: string, payload: Partial<Pick<RegionEgressPricing, "upcharge_price_per_gb" | "billing_enabled">>) => void;
  onFetchEgressHistory: () => void;
  onSetEgressHistoryMonth: (month: string) => void;
  formatCurrency: (amount: number | null | undefined) => string;
  formatDateTime: (value: string | null | undefined) => string;
}

export const EgressBilling: React.FC<EgressBillingProps> = ({
  filteredEgressPricing,
  filteredLiveEgressUsage,
  filteredEgressHistory,
  egressPricingLoading,
  liveEgressUsageLoading,
  egressHistoryLoading,
  egressPricingSyncing,
  egressExecuting,
  savingEgressRegionId,
  egressHistoryMonth,
  onFetchLiveEgressUsage,
  onSyncEgressPricing,
  onExecuteEgressBilling,
  onUpdateEgressPricingRegion,
  onFetchEgressHistory,
  onSetEgressHistoryMonth,
  formatCurrency,
  formatDateTime,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-foreground">
            Pool-aware Egress Billing
          </h3>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Sync Linode regional overage pricing, apply your upcharge,
            and view live current-month pooled transfer usage with
            projected allocation back to each organization and VPS/server.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onFetchLiveEgressUsage}
            disabled={liveEgressUsageLoading}
            className="gap-2"
          >
            <RefreshCw
              className={cn(
                "h-4 w-4",
                liveEgressUsageLoading && "animate-spin",
              )}
            />
            Refresh Live Usage
          </Button>
          <Button
            onClick={onSyncEgressPricing}
            disabled={egressPricingSyncing}
            className="gap-2"
          >
            <RefreshCw
              className={cn(
                "h-4 w-4",
                egressPricingSyncing && "animate-spin",
              )}
            />
            {egressPricingSyncing ? "Syncing…" : "Sync Linode Pricing"}
          </Button>
          <Button
            variant="secondary"
            onClick={onExecuteEgressBilling}
            disabled={egressExecuting}
            className="gap-2"
          >
            <Play
              className={cn("h-4 w-4", egressExecuting && "animate-pulse")}
            />
            {egressExecuting ? "Running Billing…" : "Run Billing"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Configured Regions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredEgressPricing.length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Regions with stored pricing records
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Billing Enabled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredEgressPricing.filter((item) => item.billing_enabled).length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Regions currently allowed to bill overage
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Active Pools
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredLiveEgressUsage.length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Global/region pools with current live usage
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Billable Overage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                filteredLiveEgressUsage.reduce(
                  (sum, pool) =>
                    sum +
                    pool.items.reduce(
                      (inner, item) => inner + item.amount,
                      0,
                    ),
                  0,
                ),
              ) || "$0.00"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Current projected total across all active pools
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Region Pricing Controls
          </CardTitle>
          <CardDescription>
            Base price comes from Linode pricing sync. Enter only your
            markup and enable billing for the regions you want to charge.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Region</TableHead>
                  <TableHead>Pool</TableHead>
                  <TableHead>Base / GB</TableHead>
                  <TableHead>Upcharge / GB</TableHead>
                  <TableHead>Final / GB</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead>Sync Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {egressPricingLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Loading egress pricing…
                    </TableCell>
                  </TableRow>
                ) : filteredEgressPricing.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No egress pricing has been synced yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEgressPricing.map((region) => (
                    <TableRow key={region.region_id}>
                      <TableCell>
                        <div className="font-medium">
                          {region.region_label || region.region_id}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {region.region_id}
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">
                        {region.pricing_scope}
                      </TableCell>
                      <TableCell>
                        ${(Number(region.base_price_per_gb) || 0).toFixed(6)}
                      </TableCell>
                      <TableCell className="w-[180px]">
                        <Input
                          type="number"
                          min={0}
                          step="0.000001"
                          defaultValue={region.upcharge_price_per_gb}
                          onBlur={(e) => {
                            const nextValue = Number(e.target.value || 0);
                            if (
                              Math.abs(nextValue - region.upcharge_price_per_gb) > 0.0000005
                            ) {
                              void onUpdateEgressPricingRegion(region.region_id, {
                                upcharge_price_per_gb: nextValue,
                              });
                            }
                          }}
                          disabled={savingEgressRegionId === region.region_id}
                        />
                      </TableCell>
                      <TableCell>
                        ${(Number(region.final_price_per_gb) || 0).toFixed(6)}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={region.billing_enabled}
                          onCheckedChange={(checked) => {
                            void onUpdateEgressPricingRegion(region.region_id, {
                              billing_enabled: checked,
                            });
                          }}
                          disabled={savingEgressRegionId === region.region_id}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant="secondary" className="w-fit">
                            {region.sync_status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(region.synced_at)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {liveEgressUsageLoading ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Loading live pooled egress usage…
            </CardContent>
          </Card>
        ) : filteredLiveEgressUsage.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No live pooled egress usage is available yet. Sync pricing and
              refresh once current transfer data is available.
            </CardContent>
          </Card>
        ) : (
          filteredLiveEgressUsage.map((pool) => (
            <Card key={pool.poolId}>
              <CardHeader>
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {pool.regionLabel || pool.poolId}
                    </CardTitle>
                    <CardDescription>
                      {pool.poolScope === "global"
                        ? "Global transfer pool"
                        : `Region pool for ${pool.regionId}`}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {pool.pricingCategory}
                    </Badge>
                    <Badge variant={pool.billingEnabled ? "default" : "secondary"}>
                      {pool.billingEnabled ? "Billing Enabled" : "Billing Disabled"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div className="rounded-lg border p-4">
                    <div className="text-xs uppercase text-muted-foreground">
                      Pool Usage
                    </div>
                    <div className="mt-1 text-xl font-semibold">
                      {pool.accountUsageGb.toFixed(2)} GB
                    </div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="text-xs uppercase text-muted-foreground">
                      Pool Quota
                    </div>
                    <div className="mt-1 text-xl font-semibold">
                      {pool.accountQuotaGb.toFixed(2)} GB
                    </div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="text-xs uppercase text-muted-foreground">
                      Billable Pool Overage
                    </div>
                    <div className="mt-1 text-xl font-semibold">
                      {pool.accountBillableGb.toFixed(2)} GB
                    </div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="text-xs uppercase text-muted-foreground">
                      Final Customer Price
                    </div>
                    <div className="mt-1 text-xl font-semibold">
                      ${(pool.finalPricePerGb || 0).toFixed(6)}/GB
                    </div>
                  </div>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Organization</TableHead>
                        <TableHead>Server</TableHead>
                        <TableHead>Usage</TableHead>
                        <TableHead>Pool Share</TableHead>
                        <TableHead>Allocated Quota</TableHead>
                        <TableHead>Billable GB</TableHead>
                        <TableHead>Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pool.items.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="py-8 text-center text-muted-foreground"
                          >
                            No VPS usage rows were available for this pool.
                          </TableCell>
                        </TableRow>
                      ) : (
                        pool.items.map((item) => (
                          <TableRow key={`${pool.poolId}-${item.vpsInstanceId}`}>
                            <TableCell>
                              <div className="font-medium">{item.organizationName}</div>
                              <div className="text-xs text-muted-foreground">
                                {item.organizationId}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{item.label}</div>
                              <div className="text-xs text-muted-foreground">
                                VPS: {item.providerInstanceId}
                              </div>
                            </TableCell>
                            <TableCell>{item.measuredUsageGb.toFixed(2)} GB</TableCell>
                            <TableCell>{(item.usageShare * 100).toFixed(2)}%</TableCell>
                            <TableCell>
                              {item.allocatedPoolQuotaGb.toFixed(2)} GB
                            </TableCell>
                            <TableCell>
                              {item.allocatedBillableGb.toFixed(2)} GB
                            </TableCell>
                            <TableCell>
                              {formatCurrency(item.amount) || "$0.00"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">
                Egress Billing History
              </CardTitle>
              <CardDescription>
                Review projected, billed, failed, and void egress cycles by
                organization and transfer pool.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="month"
                value={egressHistoryMonth}
                onChange={(e) => onSetEgressHistoryMonth(e.target.value)}
                className="w-40"
              />
              <Button
                variant="outline"
                onClick={onFetchEgressHistory}
                disabled={egressHistoryLoading}
                className="gap-2"
              >
                <RefreshCw
                  className={cn(
                    "h-4 w-4",
                    egressHistoryLoading && "animate-spin",
                  )}
                />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Pool</TableHead>
                  <TableHead>Billable GB</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {egressHistoryLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-muted-foreground"
                    >
                      Loading egress billing history…
                    </TableCell>
                  </TableRow>
                ) : filteredEgressHistory.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No egress billing cycles have been recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEgressHistory.map((cycle) => (
                    <TableRow key={cycle.id}>
                      <TableCell className="font-mono text-xs">
                        {cycle.billingMonth.slice(0, 7)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {cycle.organizationName || cycle.organizationId}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {cycle.organizationId}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {cycle.poolId}
                        </div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {cycle.poolScope}
                        </div>
                      </TableCell>
                      <TableCell>
                        {cycle.allocatedBillableGb.toFixed(2)} GB
                      </TableCell>
                      <TableCell>
                        {formatCurrency(cycle.totalAmount) || "$0.00"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            cycle.status === "billed"
                              ? "default"
                              : cycle.status === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {cycle.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(cycle.updatedAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};