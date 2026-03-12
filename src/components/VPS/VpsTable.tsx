import { Fragment, useCallback, useMemo } from "react";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import { DataTable } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Status } from "@/components/ui/status";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { VPSInstance } from "@/types/vps";
import type { Dispatch, SetStateAction } from "react";
import { formatCurrency, formatGigabytes } from "@/lib/formatters";

interface RegionShape {
  id: string;
  label: string;
}

interface VpsInstancesTableProps {
  instances: VPSInstance[];
  isLoading?: boolean;
  allowedRegions: RegionShape[];
  onAction: (instanceId: string, action: "boot" | "shutdown" | "reboot" | "delete") => void;
  onCopy: (value: string) => void;
  onSelectionChange?: (selectedInstances: VPSInstance[]) => void;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: Dispatch<SetStateAction<RowSelectionState>>;
}

const statusLabel = (status: VPSInstance["status"]): string => {
  switch (status) {
    case "running":
      return "Running";
    case "stopped":
      return "Stopped";
    case "provisioning":
      return "Provisioning";
    case "rebooting":
      return "Rebooting";
    case "error":
      return "Error";
    case "restoring":
      return "Restoring";
    case "backing_up":
      return "Backing Up";
    default:
      return status;
  }
};

const formatInstanceSize = (bytes: number | null | undefined): string =>
  formatGigabytes(bytes, { fallback: "0 GB" });

const formatDate = (date: string): string =>
  new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// Add Active Hours helper
const _calculateActiveHours = (created: string | null | undefined): number => {
  if (!created) return NaN;
  const createdTime = new Date(created).getTime();
  if (!Number.isFinite(createdTime)) return NaN;
  const hours = (Date.now() - createdTime) / 36e5; // 36e5 = 60*60*1000
  return Math.max(0, hours);
};
const getStatusVariant = (status: VPSInstance["status"]) => {
  switch (status) {
    case "running":
      return "running";
    case "stopped":
      return "stopped";
    case "provisioning":
      return "provisioning";
    case "rebooting":
      return "rebooting";
    case "error":
      return "error";
    case "restoring":
      return "loading";
    case "backing_up":
      return "loading";
    default:
      return "offline";
  }
};

const clampPercent = (value: number | null | undefined): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
};

const getProgressValue = (instance: VPSInstance) => {
  const providerPercent = clampPercent(instance.progress?.percent ?? null);
  if (providerPercent !== null) {
    if (providerPercent >= 100 && (instance.status === "running" || instance.status === "stopped")) {
      return null;
    }
    return providerPercent;
  }

  if (instance.status === "provisioning") {
    if (instance.created) {
      const createdTime = new Date(instance.created).getTime();
      if (!Number.isNaN(createdTime)) {
        const now = Date.now();
        const elapsed = now - createdTime;
        const estimatedTotal = 5 * 60 * 1000; // 5 minutes fallback heuristic
        return Math.min(90, (elapsed / estimatedTotal) * 100);
      }
    }
    return 25;
  }
  if (instance.status === "rebooting") return 60;
  if (instance.status === "restoring") return 40;
  if (instance.status === "backing_up") return 70;
  return null;
};

export function VpsInstancesTable({
  instances,
  isLoading,
  allowedRegions,
  onAction,
  onCopy,
  onSelectionChange,
  rowSelection,
  onRowSelectionChange,
}: VpsInstancesTableProps) {
  const regionLookup = useMemo(() => {
    const map = new Map<string, string>();
    allowedRegions.forEach((region) => {
      map.set(region.id, region.label || region.id);
    });
    return map;
  }, [allowedRegions]);

  const columns = useMemo<ColumnDef<VPSInstance>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() 
                ? true 
                : table.getIsSomePageRowsSelected() 
                ? "indeterminate" 
                : false
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
            className="touch-manipulation"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="touch-manipulation"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 48,
        meta: {
          className: "w-12 min-w-[48px]"
        }
      },
      {
        accessorKey: "label",
        header: "Server",
        cell: ({ row }) => {
          const instance = row.original;
          const regionLabel =
            instance.regionLabel || regionLookup.get(instance.region) || instance.region;
          const progressValue = getProgressValue(instance);
          const providerMessage = typeof instance.progress?.message === "string" ? instance.progress.message.trim() : "";
          const progressLabel = providerMessage.length > 0 ? providerMessage : statusLabel(instance.status);
          const showPing = ["running", "provisioning", "rebooting", "restoring", "backing_up"].includes(instance.status);
          
          return (
            <div className="space-y-2 min-w-[200px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground text-sm sm:text-base truncate max-w-[150px] sm:max-w-none">
                  {instance.label}
                </span>
                <Status 
                  variant={getStatusVariant(instance.status)}
                  label={statusLabel(instance.status)}
                  showPing={showPing}
                  animated={instance.status === "provisioning"}
                />
              </div>
              {progressValue !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{progressLabel}</span>
                    <span>{Math.round(progressValue)}%</span>
                  </div>
                  <Progress value={progressValue} className="h-1.5" />
                </div>
              )}
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {instance.planName && <span className="font-medium text-foreground/80">{instance.planName}</span>}
                {instance.ipv4[0] && <span className="font-mono text-xs">{instance.ipv4[0]}</span>}
                <span className="text-xs">{regionLabel}</span>
              </div>
            </div>
          );
        },
        meta: {
          className: "sticky left-0 bg-card z-10 min-w-[200px] border-r border-border"
        }
      },
      {
        id: "specs",
        header: "Resources",
        cell: ({ row }) => {
          const instance = row.original;
          return (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs min-w-[160px]">
              <div>
                <div className="text-muted-foreground text-xs">CPU</div>
                <div className="font-medium text-foreground text-xs">{instance.specs.vcpus} vCPU</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Memory</div>
                <div className="font-medium text-foreground text-xs">{formatInstanceSize(instance.specs.memory)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Storage</div>
                <div className="font-medium text-foreground text-xs">{formatInstanceSize(instance.specs.disk)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Transfer</div>
                <div className="font-medium text-foreground text-xs">{formatInstanceSize(instance.specs.transfer)}</div>
              </div>
            </div>
          );
        },
        meta: {
          className: "min-w-[160px]"
        }
      },
      {
        id: "pricing",
        header: "Billing",
        cell: ({ row }) => {
          const { pricing, transferPricing } = row.original;
          return (
            <div className="space-y-1 text-xs min-w-[100px]">
              <div className="text-muted-foreground text-xs">Hourly</div>
              <div className="font-medium text-foreground text-xs">{formatCurrency(pricing.hourly)}</div>
              <div className="text-muted-foreground text-xs">Monthly</div>
              <div className="font-medium text-foreground text-xs">{formatCurrency(pricing.monthly)}</div>
              <div className="text-muted-foreground text-xs">Egress / GB</div>
              <div className="font-medium text-foreground text-xs">
                {formatCurrency(transferPricing?.customerRatePerGb ?? 0)}
              </div>
            </div>
          );
        },
        meta: {
          className: "min-w-[100px]"
        }
      },
      {
        accessorKey: "created",
        header: "Created",
        cell: ({ row }) => (
          <div className="text-xs text-muted-foreground min-w-[100px]">
            {formatDate(row.original.created)}
          </div>
        ),
        meta: {
          className: "min-w-[100px] hidden sm:table-cell"
        }
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const instance = row.original;
          const isRunning = instance.status === "running";
          const isStopped = instance.status === "stopped";
          const isTransitioning =
            instance.status === "provisioning" || instance.status === "rebooting";

          return (
            <div className="flex items-center justify-end gap-1 sm:gap-2 min-w-[180px]">
              {isRunning && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onAction(instance.id, "shutdown")}
                    className="touch-manipulation min-h-[36px] text-xs px-2 sm:px-3"
                  >
                    <span className="hidden sm:inline">Stop</span>
                    <span className="sm:hidden">⏹</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAction(instance.id, "reboot")}
                    className="touch-manipulation min-h-[36px] text-xs px-2 sm:px-3"
                  >
                    <span className="hidden sm:inline">Reboot</span>
                    <span className="sm:hidden">🔄</span>
                  </Button>
                </>
              )}
              {isStopped && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onAction(instance.id, "boot")}
                  disabled={isTransitioning}
                  className="touch-manipulation min-h-[36px] text-xs px-2 sm:px-3"
                >
                  <span className="hidden sm:inline">Start</span>
                  <span className="sm:hidden">▶</span>
                </Button>
              )}
              <Button variant="ghost" size="sm" asChild className="touch-manipulation min-h-[36px] text-xs px-2 sm:px-3">
                <Link to={`/vps/${instance.id}`}>
                  <span className="hidden sm:inline">Details</span>
                  <span className="sm:hidden">📋</span>
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 touch-manipulation min-h-[36px] min-w-[36px]">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Open actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Quick actions</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => onCopy(instance.ipv4[0] ?? "")}>
                    Copy IPv4
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onCopy(instance.id)}>
                    Copy instance ID
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to={`/vps/${instance.id}`}>View details</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onAction(instance.id, "delete")}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
        size: 220,
        meta: {
          className: "min-w-[180px]"
        }
      },
    ],
    [onAction, onCopy, regionLookup]
  );

  const handleMobileSelection = useCallback(
    (instanceId: string, checked: boolean) => {
      if (!onRowSelectionChange) return;
      onRowSelectionChange((prev) => {
        const next: RowSelectionState = { ...prev };
        if (checked) {
          next[instanceId] = true;
        } else {
          delete next[instanceId];
        }
        return next;
      });
    },
    [onRowSelectionChange]
  );

  const mobileCards = instances.map((instance) => {
    const progressValue = getProgressValue(instance);
    const providerMessage = typeof instance.progress?.message === "string" ? instance.progress.message.trim() : "";
    const progressLabel = providerMessage.length > 0 ? providerMessage : statusLabel(instance.status);
    const isTransitioning = ["provisioning", "rebooting", "restoring"].includes(instance.status);
    const isRunning = instance.status === "running";
    const isStopped = instance.status === "stopped";
    const regionLabel = instance.regionLabel || regionLookup.get(instance.region) || instance.region;

    return (
      <Fragment key={instance.id}>
        <Card className="border border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold text-foreground">
                  {instance.label}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Created {formatDate(instance.created)}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  aria-label="Select instance"
                  checked={Boolean(rowSelection?.[instance.id])}
                  onCheckedChange={(value) => handleMobileSelection(instance.id, Boolean(value))}
                  className="mt-1"
                />
                <Status
                  variant={getStatusVariant(instance.status)}
                  label={statusLabel(instance.status)}
                  showPing={instance.status !== "stopped"}
                  animated={instance.status === "provisioning"}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              {instance.ipv4[0] && (
                <Badge variant="secondary" className="font-mono text-[11px]">
                  {instance.ipv4[0]}
                </Badge>
              )}
              {regionLabel && (
                <Badge variant="outline" className="text-[11px]">
                  {regionLabel}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {progressValue !== null && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{progressLabel}</span>
                  <span>{Math.round(progressValue)}%</span>
                </div>
                <Progress value={progressValue} className="h-1.5" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <p className="text-muted-foreground">CPU</p>
                <p className="font-medium text-foreground">{instance.specs.vcpus} vCPU</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Memory</p>
                <p className="font-medium text-foreground">{formatInstanceSize(instance.specs.memory)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Storage</p>
                <p className="font-medium text-foreground">{formatInstanceSize(instance.specs.disk)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Transfer</p>
                <p className="font-medium text-foreground">{formatInstanceSize(instance.specs.transfer)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <p className="text-muted-foreground">Hourly</p>
                <p className="font-medium text-foreground">{formatCurrency(instance.pricing.hourly)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Monthly</p>
                <p className="font-medium text-foreground">{formatCurrency(instance.pricing.monthly)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Egress / GB</p>
                <p className="font-medium text-foreground">
                  {formatCurrency(instance.transferPricing?.customerRatePerGb ?? 0)}
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Button
              variant={isRunning ? "secondary" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => onAction(instance.id, isRunning ? "shutdown" : "boot")}
              disabled={isTransitioning}
            >
              {isRunning ? "Stop" : isStopped ? "Start" : "Action"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onAction(instance.id, "reboot")}
              disabled={isTransitioning}
            >
              Reboot
            </Button>
            <Button asChild variant="ghost" size="sm" className="flex-1">
              <Link to={`/vps/${instance.id}`}>Details</Link>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1"
              onClick={() => onAction(instance.id, "delete")}
            >
              Delete
            </Button>
          </CardFooter>
        </Card>
      </Fragment>
    );
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:hidden">
        {mobileCards.length > 0 ? (
          mobileCards
        ) : (
          <Card className="border border-dashed border-border/60 bg-card/60">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No VPS instances found.
            </CardContent>
          </Card>
        )}
      </div>
      <div className="hidden lg:block">
        <DataTable
          columns={columns}
          data={instances}
          isLoading={isLoading}
          onSelectionChange={onSelectionChange}
          rowSelection={rowSelection}
          onRowSelectionChange={onRowSelectionChange}
          getRowId={(row) => row.id}
          emptyState={
            <div className="py-10 text-center">
              <p className="text-base font-medium text-foreground">No VPS instances found</p>
              <p className="text-sm text-muted-foreground">
                Start by provisioning a server to see it appear in this list.
              </p>
            </div>
          }
        />
      </div>
    </div>
  );
}
