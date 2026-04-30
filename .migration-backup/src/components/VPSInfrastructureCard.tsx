import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Server, Cpu, HardDrive, MemoryStick, ChevronDown, ChevronUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Status } from "@/components/ui/status";
import { apiClient } from "@/lib/api";

interface VPSStats {
  vps: {
    total: number;
    byStatus: {
      running: number;
      stopped: number;
      provisioning: number;
      rebooting: number;
      error: number;
    };
    resources: {
      totalVCPUs: number;
      totalMemoryGB: number;
      totalDiskGB: number;
    };
  };
  lastUpdated: string;
}

/**
 * Expandable row component for VPS Infrastructure metrics.
 * Lives inside the "Service components" Card with divide-y layout.
 * - Collapsed: Summary row matching other service rows (icon, name, desc, status, chevron)
 * - Expanded: Detailed metrics (status breakdown grid, resource allocation)
 */
export function VPSInfrastructureCard() {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading, isError, error } = useQuery<VPSStats>({
    queryKey: ["vps-infrastructure-stats"],
    queryFn: async () => {
      const response = await apiClient.get("/health/stats");
      return response;
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const vps = data?.vps;
  const hasErrors = vps && vps.byStatus.error > 0;
  const allStopped = vps && vps.byStatus.stopped > 0 && vps.byStatus.running === 0;

  const getSummaryLabel = () => {
    if (isLoading) return "Loading...";
    if (isError) return "Error";
    if (!vps) return "Unknown";
    if (vps.total === 0) return "No instances";
    if (hasErrors && vps.byStatus.running === 0) return "All instances errored";
    if (hasErrors) return `${vps.byStatus.error} errored`;
    if (allStopped) return `${vps.byStatus.stopped} stopped`;
    return `${vps.byStatus.running} running`;
  };

  const getStatusVariant = (): "running" | "stopped" | "error" | "loading" => {
    if (isLoading) return "loading";
    if (isError) return "error";
    if (!vps || vps.total === 0) return "stopped";
    if (hasErrors) return "error";
    if (allStopped) return "stopped";
    return "running";
  };

  const hasResourceData =
    vps &&
    (vps.resources.totalVCPUs > 0 ||
      vps.resources.totalMemoryGB > 0 ||
      vps.resources.totalDiskGB > 0);

  const statusVariant = getStatusVariant();

  return (
    <>
      {/* Clickable row header — matches other service component rows */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between text-left cursor-pointer"
      >
        <div className="flex flex-1 items-start gap-4">
          <Server className="mt-1 h-8 w-8 text-muted-foreground" />
          <div className="space-y-1">
            <h3 className="font-semibold">VPS Infrastructure</h3>
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? "Loading infrastructure metrics..."
                : isError
                  ? error instanceof Error
                    ? error.message
                    : "Failed to load statistics"
                  : "Real-time virtual server metrics"}
            </p>
            {vps && vps.total > 0 && (
              <p className="text-xs text-muted-foreground">
                {vps.total} total instance{vps.total !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {vps && vps.total > 0 && (
            <div className="text-right hidden md:block">
              <div className="text-sm font-semibold">
                {vps.total} VPS
              </div>
              <div className="text-xs text-muted-foreground">
                {vps.byStatus.running} active
              </div>
            </div>
          )}
          <Status
            variant={statusVariant}
            label={getSummaryLabel()}
            size="sm"
            showPing={statusVariant === "running"}
            className="md:justify-end"
          />
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </div>
      </button>

      {/* Expanded detailed metrics */}
      {expanded && (
        <div className="pb-5 pl-12 md:pl-16 space-y-4 animate-in fade-in-0 slide-in-from-top-2 duration-200">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : isError ? (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <Status variant="error" label="Error loading data" />
            </div>
          ) : vps ? (
            <>
              {/* Status Breakdown */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Status Breakdown
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between rounded-lg border p-2">
                    <Status variant="running" label="Running" size="sm" showPing />
                    <span className="font-semibold">{vps.byStatus.running}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-2">
                    <Status variant="stopped" label="Stopped" size="sm" />
                    <span className="font-semibold">{vps.byStatus.stopped}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-2">
                    <Status variant="provisioning" label="Provisioning" size="sm" animated />
                    <span className="font-semibold">{vps.byStatus.provisioning}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-2">
                    <Status variant="error" label="Error" size="sm" />
                    <span className="font-semibold">{vps.byStatus.error}</span>
                  </div>
                </div>
              </div>

              {/* Total Allocated Resources */}
              {hasResourceData && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Total Allocated Resources
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col items-center rounded-lg border p-3">
                      <Cpu className="h-4 w-4 text-muted-foreground mb-1" />
                      <span className="text-lg font-bold">
                        {vps.resources.totalVCPUs}
                      </span>
                      <span className="text-xs text-muted-foreground">vCPUs</span>
                    </div>
                    <div className="flex flex-col items-center rounded-lg border p-3">
                      <MemoryStick className="h-4 w-4 text-muted-foreground mb-1" />
                      <span className="text-lg font-bold">
                        {vps.resources.totalMemoryGB}
                      </span>
                      <span className="text-xs text-muted-foreground">GB RAM</span>
                    </div>
                    <div className="flex flex-col items-center rounded-lg border p-3">
                      <HardDrive className="h-4 w-4 text-muted-foreground mb-1" />
                      <span className="text-lg font-bold">
                        {vps.resources.totalDiskGB}
                      </span>
                      <span className="text-xs text-muted-foreground">GB Disk</span>
                    </div>
                  </div>
                </div>
              )}

              {vps.total === 0 && (
                <p className="text-sm text-muted-foreground">
                  No VPS instances provisioned yet.
                </p>
              )}
            </>
          ) : null}
        </div>
      )}
    </>
  );
}
