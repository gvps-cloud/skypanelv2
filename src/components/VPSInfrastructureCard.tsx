import { useQuery } from "@tanstack/react-query";
import { Server, Cpu, HardDrive, MemoryStick } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export function VPSInfrastructureCard() {
  const { data, isLoading, isError, error } = useQuery<VPSStats>({
    queryKey: ["vps-infrastructure-stats"],
    queryFn: async () => {
      const response = await apiClient.get("/health/stats");
      return response;
    },
    refetchInterval: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-muted-foreground" />
            <CardTitle>VPS Infrastructure</CardTitle>
          </div>
          <CardDescription>Real-time virtual server metrics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-red-500/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-muted-foreground" />
            <CardTitle>VPS Infrastructure</CardTitle>
          </div>
          <CardDescription>Real-time virtual server metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <Status variant="error" label="Error loading data" />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {error instanceof Error ? error.message : "Failed to load VPS statistics"}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { vps } = data;
  
  // Check if resource data is available
  const hasResourceData = vps.resources.totalVCPUs > 0 || vps.resources.totalMemoryGB > 0 || vps.resources.totalDiskGB > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-muted-foreground" />
          <CardTitle>VPS Infrastructure</CardTitle>
        </div>
        <CardDescription>Real-time virtual server metrics</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total VPS Count */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Total VPS Instances</span>
          <span className="text-2xl font-bold">{vps.total}</span>
        </div>

        {/* Status Breakdown */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Status Breakdown</h4>
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

        {/* Total Resources - Show if data is available */}
        {hasResourceData && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Total Allocated Resources</h4>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center rounded-lg border p-3">
                <Cpu className="h-4 w-4 text-muted-foreground mb-1" />
                <span className="text-lg font-bold">{vps.resources.totalVCPUs}</span>
                <span className="text-xs text-muted-foreground">vCPUs</span>
              </div>
              <div className="flex flex-col items-center rounded-lg border p-3">
                <MemoryStick className="h-4 w-4 text-muted-foreground mb-1" />
                <span className="text-lg font-bold">{vps.resources.totalMemoryGB}</span>
                <span className="text-xs text-muted-foreground">GB RAM</span>
              </div>
              <div className="flex flex-col items-center rounded-lg border p-3">
                <HardDrive className="h-4 w-4 text-muted-foreground mb-1" />
                <span className="text-lg font-bold">{vps.resources.totalDiskGB}</span>
                <span className="text-xs text-muted-foreground">GB Disk</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
