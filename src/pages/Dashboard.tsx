/**
 * Dashboard Component
 * Presents a refreshed command center view for VPS, billing, and activity.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Server,
  Wallet,
  Activity as ActivityIcon,
  TrendingUp,
  AlertTriangle,
  Plus,
  ArrowUpRight,
  Globe,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMonthlySpendWithFallback } from "../lib/billingUtils";
import { MonthlyResetIndicator } from "@/components/Dashboard/MonthlyResetIndicator";
import { formatBillingAmount } from "@/lib/formatters";
import { apiClient } from "@/lib/api";
import { useHostingStatus } from "@/hooks/useHosting";
import { MatrixRain } from "@/components/fx/MatrixRain";
import { StatusHeartbeat } from "@/components/fx/StatusHeartbeat";
import { TerminalPageHeader, TerminalPanel } from "@/components/terminal";
import { cn } from "@/lib/utils";

interface MetricSummary {
  average: number;
  peak: number;
  last: number;
}

interface MetricSeriesPayload {
  series?: Array<[number, number]>;
  summary?: MetricSummary | null;
  unit?: string;
}

interface VpsMetrics {
  cpu?: MetricSeriesPayload | null;
  network?: {
    inbound?: MetricSeriesPayload | null;
    outbound?: MetricSeriesPayload | null;
  };
  io?: {
    read?: MetricSeriesPayload | null;
    swap?: MetricSeriesPayload | null;
  };
}

interface VPSStats {
  id: string;
  name: string;
  status: "running" | "stopped" | "provisioning" | "rebooting" | "restoring" | "backing_up" | "error";
  plan: string;
  location: string;
  cpu: number;
  cpuCount: number; // Number of vCPUs
  memory: number | null;
  storage: number;
  ip: string;
  metrics?: VpsMetrics;
}


interface VpsListResponse {
  instances?: Array<{
    id: string;
    label?: string | null;
    status?: VPSStats["status"] | null;
    plan_name?: string | null;
    configuration?: {
      type?: string | null;
      region?: string | null;
    } | null;
    ip_address?: string | null;
  }>;
}

interface VpsDetailResponse {
  instance?: {
    metrics?: VpsMetrics | null;
    plan?: {
      specs?: {
        vcpus?: number | null;
      } | null;
    } | null;
  } | null;
}

interface WalletBalanceResponse {
  balance?: number | null;
}

interface PaymentsHistoryResponse {
  payments?: Array<{
    amount?: number | null;
    created_at?: string | null;
  }>;
}

interface HostingServicesResponse {
  services?: Array<{
    id: string;
    domain?: string | null;
    status?: string | null;
    plan_name?: string | null;
    plan?: {
      name?: string | null;
    } | null;
    next_billing_at?: string | null;
  }>;
}

interface ActivityResponse {
  activities?: Array<{
    id: string;
    type?: ActivityItem["type"] | null;
    entity_type?: ActivityItem["type"] | null;
    message?: string | null;
    event_type?: string | null;
    timestamp?: string | null;
    created_at?: string | null;
    status?: ActivityItem["status"] | null;
  }>;
}

interface BillingStats {
  walletBalance: number;
  hostingWalletBalance: number;
  monthlySpend: number;
  lastPayment: {
    amount: number;
    date: string;
  };
}

interface HostingServiceSummary {
  id: string;
  domain: string | null;
  status: string;
  planName: string | null;
  nextBillingAt: string | null;
}

interface ActivityItem {
  id: string;
  type: "vps" | "billing" | "support" | "activity";
  message: string;
  timestamp: string;
  status: "success" | "warning" | "error" | "info";
}


const mapVpsInstance = async (instance: NonNullable<VpsListResponse["instances"]>[number]): Promise<VPSStats> => {
  let metrics: VpsMetrics | undefined;
  let cpu = 0;
  let cpuCount = 0;

  try {
    const detailData = await apiClient.get<VpsDetailResponse>(`/vps/${instance.id}`);
    const metricsData = detailData.instance?.metrics;

    metrics = metricsData ? {
      cpu: metricsData.cpu ?? null,
      network: {
        inbound: metricsData.network?.inbound ?? null,
        outbound: metricsData.network?.outbound ?? null,
      },
      io: {
        read: metricsData.io?.read ?? null,
        swap: metricsData.io?.swap ?? null,
      },
    } : undefined;

    cpu = metricsData?.cpu?.summary?.last ?? 0;
    cpuCount = detailData.instance?.plan?.specs?.vcpus ?? 0;
  } catch (error) {
    console.warn('Failed to fetch metrics for VPS', { instanceId: instance.id }, error);
  }

  return {
    id: instance.id,
    name: instance.label ?? "instance",
    status: instance.status ?? "provisioning",
    plan: instance.plan_name ?? instance.configuration?.type ?? "",
    location: instance.configuration?.region ?? "",
    cpu: Math.round(cpu * 100) / 100,
    cpuCount,
    memory: null,
    storage: 0,
    ip: instance.ip_address ?? "",
    metrics,
  } satisfies VPSStats;
};

const mapHostingService = (service: NonNullable<HostingServicesResponse["services"]>[number]): HostingServiceSummary => ({
  id: service.id,
  domain: service.domain ?? null,
  status: service.status ?? "unknown",
  planName: service.plan_name ?? service.plan?.name ?? null,
  nextBillingAt: service.next_billing_at ?? null,
});

const mapActivity = (activity: NonNullable<ActivityResponse["activities"]>[number]): ActivityItem => ({
  id: activity.id,
  type: activity.type ?? activity.entity_type ?? "activity",
  message: activity.message ?? `${activity.event_type}`,
  timestamp: activity.timestamp ?? activity.created_at ?? "",
  status: activity.status ?? "info",
});

const Dashboard: React.FC = () => {
  const [vpsInstances, setVpsInstances] = useState<VPSStats[]>([]);
  const [billing, setBilling] = useState<BillingStats | null>(null);
  const { data: hostingStatus } = useHostingStatus();
  const hostingEnabled = hostingStatus?.enabled === true;
  const [hostingServices, setHostingServices] = useState<HostingServiceSummary[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDashboardTab, setActiveDashboardTab] = useState<"vps" | "hosting">("vps");
  const { token } = useAuth();
  const navigate = useNavigate();

  const loadDashboardData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const basePromises: Promise<any>[] = [
        apiClient.get<VpsListResponse>("/vps"),
        apiClient.get<WalletBalanceResponse>("/payments/wallet/balance"),
        apiClient.get<PaymentsHistoryResponse>("/payments/history?limit=1&status=completed"),
      ];

      if (hostingEnabled) {
        basePromises.push(
          apiClient.get<WalletBalanceResponse>("/payments/wallet/hosting/balance").catch(() => ({ balance: 0 }))
        );
      }

      const results = await Promise.all(basePromises);
      const vpsData = results[0] as VpsListResponse;
      const walletData = results[1] as WalletBalanceResponse;
      const paymentsData = results[2] as PaymentsHistoryResponse;
      const hostingWalletData = hostingEnabled
        ? (results[3] as WalletBalanceResponse)
        : { balance: 0 };

      const instances: VPSStats[] = await Promise.all((vpsData.instances ?? []).map(mapVpsInstance));

      setVpsInstances(instances);

      const lastPaymentItem = (paymentsData.payments ?? [])[0];
      const monthlySpend = await getMonthlySpendWithFallback();

      setBilling({
        walletBalance: walletData.balance ?? 0,
        hostingWalletBalance: hostingWalletData.balance ?? 0,
        monthlySpend,
        lastPayment: {
          amount: lastPaymentItem?.amount ?? 0,
          date: lastPaymentItem?.created_at ?? "",
        },
      });

      if (hostingEnabled) {
        try {
          const hostingData = await apiClient.get<HostingServicesResponse>("/hosting/services");
          const services = hostingData.services ?? [];
          setHostingServices(services.map(mapHostingService));
        } catch (error) {
          console.warn("Failed to load hosting services", error);
          setHostingServices([]);
        }
      } else {
        setHostingServices([]);
      }

      try {
        const actData = await apiClient.get<ActivityResponse>("/activity/recent?limit=10");
        const activities = actData.activities ?? [];
        const mapped: ActivityItem[] = activities.map(mapActivity);
        setRecentActivity(mapped);
      } catch (error) {
        console.warn("Failed to load recent activity", error);
      }
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [token, hostingEnabled]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const quickActions = useMemo(() => {
    const actions = [
      {
        title: "Create Hosting",
        description: "Launch an Enhance web hosting subscription.",
        to: "/hosting/store",
        icon: <Globe className="h-4 w-4" />,
        hidden: !hostingEnabled,
      },
      {
        title: "Launch a VPS",
        description: "Deploy a fresh instance in under a minute.",
        to: "/vps",
        icon: <Plus className="h-4 w-4" />,
      },
      {
        title: "Top up wallet",
        description: "Add credits with secure PayPal checkout.",
        to: "/billing",
        icon: <Wallet className="h-4 w-4" />,
      },
      {
        title: "Create support ticket",
        description: "Reach the platform team 24/7.",
        to: "/support",
        icon: <ShieldCheck className="h-4 w-4" />,
      },
    ];

    return actions.filter((action) => !action.hidden);
  }, [hostingEnabled]);

  const heroStats = useMemo(() => {
    if (!vpsInstances.length) {
      return {
        running: 0,
        flagged: 0,
        averageCpu: null as number | null,
        topInstance: null as VPSStats | null,
      };
    }

    const running = vpsInstances.filter((v) => v.status === "running").length;
    const flagged = vpsInstances.length - running;
    const cpuSamples = vpsInstances
      .map((v) => v.metrics?.cpu?.summary?.last ?? v.metrics?.cpu?.summary?.average ?? v.cpu ?? null)
      .filter((value): value is number => typeof value === "number");

    const averageCpu = cpuSamples.length
      ? Math.round(
          (cpuSamples.reduce((sum, value) => sum + value, 0) /
            cpuSamples.length) *
            10,
        ) / 10
      : null;

    const topInstance = vpsInstances.reduce<VPSStats | null>(
      (top, instance) => {
        const topCpu = top?.metrics?.cpu?.summary?.last ?? top?.cpu ?? -1;
        const currentCpu = instance.metrics?.cpu?.summary?.last ?? instance.cpu ?? -1;
        return currentCpu > topCpu ? instance : top;
      },
      null,
    );

    return { running, flagged, averageCpu, topInstance };
  }, [vpsInstances]);

  const formatTimestamp = useCallback((timestamp: string | undefined) => {
    if (!timestamp) return "—";
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return timestamp;
    }
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }, []);

  const handleVpsClick = useCallback(
    (vpsId: string) => {
      navigate(`/vps/${vpsId}`);
    },
    [navigate],
  );

  const walletBalance = billing?.walletBalance ?? 0;
  const monthlySpend = billing?.monthlySpend ?? 0;
  const lastPayment = billing?.lastPayment;
  const hostingWalletBalance = billing?.hostingWalletBalance ?? 0;
  const activeHostingServices = hostingServices.filter((service) => service.status === "active").length;

  
  if (loading) {
    return (
      <div className="space-y-6 font-mono">
        {/* Status overview badges skeleton */}
        <div className="flex flex-wrap items-center gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-6 w-28 rounded-sm" />
          ))}
          <Skeleton className="h-6 w-36 rounded-sm ml-auto" />
        </div>

        {/* Quick actions skeleton */}
        <TerminalPanel title="QUICK ACTIONS" bodyClassName="p-4">
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-sm border border-border bg-card p-3">
                <Skeleton className="h-4 w-5 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        </TerminalPanel>

        {/* Billing summary skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-9 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* VPS / content skeleton */}
        <TerminalPanel title="VPS FLEET" bodyClassName="p-4">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between rounded-sm border border-border bg-card p-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-2 w-16" />
                  <Skeleton className="h-6 w-16 rounded-sm" />
                </div>
              </div>
            ))}
          </div>
        </TerminalPanel>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-mono">
      <TerminalPageHeader command="dashboard --watch" />
      <div className="relative hidden md:block h-24 rounded-sm border border-border overflow-hidden">
        <MatrixRain density="subdued" className="h-full min-h-[6rem]" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/92 via-background/35 to-transparent pointer-events-none" />
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-[2] max-w-[60%]">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">workspace</p>
          <p className="text-sm font-semibold text-foreground">command center · live</p>
        </div>
      </div>
      {/* Main Content Area */}
      <div className="space-y-6">
        {/* Status Overview — log line */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="hidden select-none text-xs text-primary sm:inline"
              aria-hidden="true"
            >
              &gt;
            </span>
            <Badge
              variant="outline"
              className="gap-2 rounded-sm border-border px-2.5 py-1 text-xs shadow-none"
            >
              <div className="h-1.5 w-1.5 shrink-0 bg-primary" aria-hidden="true" />
              {heroStats.running} vps active
            </Badge>
            {hostingEnabled && (
              <Badge
                variant="outline"
                className="gap-2 rounded-sm border-border px-2.5 py-1 text-xs shadow-none"
              >
                <Globe className="h-3 w-3" />
                {activeHostingServices} hosting active
              </Badge>
            )}
            {heroStats.flagged > 0 && (
              <Badge
                variant="secondary"
                className="gap-2 rounded-sm px-2.5 py-1 text-xs shadow-none"
              >
                <AlertTriangle className="h-3 w-3" />
                {heroStats.flagged} attention
              </Badge>
            )}
            {heroStats.averageCpu !== null && (
              <Badge
                variant="outline"
                className="gap-2 rounded-sm border-border px-2.5 py-1 text-xs shadow-none"
              >
                <TrendingUp className="h-3 w-3" />
                Avg CPU {heroStats.averageCpu.toFixed(1)}%
              </Badge>
            )}
          </div>

          <div className="ml-auto flex flex-col items-end gap-2 sm:flex-row sm:items-center">
            <div className="hidden sm:block w-[140px] shrink-0 border border-border/50 rounded-sm bg-card/30 p-1">
              <StatusHeartbeat height={32} />
            </div>
            <MonthlyResetIndicator
              monthlySpend={monthlySpend}
              showAnimation={false}
              className="sm:items-center sm:text-left"
            />
          </div>
        </div>

        {/* Quick Actions — command list */}
        <TerminalPanel title="QUICK ACTIONS" bodyClassName="p-4">
          <div
            className={cn(
              "grid gap-2 md:grid-cols-2",
              quickActions.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4",
            )}
          >
            {quickActions.map((action, idx) => (
              <Link
                key={action.title}
                to={action.to}
                onClick={
                  action.title === "Create Hosting"
                    ? () => setActiveDashboardTab("hosting")
                    : undefined
                }
                className="group flex items-center gap-3 rounded-sm border border-border bg-card p-3 text-left ring-2 ring-inset ring-transparent transition-[background-color,box-shadow] hover:bg-muted/40 hover:ring-primary/40"
              >
                <span
                  className="w-5 shrink-0 text-[10px] text-muted-foreground tabular-nums"
                  aria-hidden="true"
                >
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <div className="rounded-sm border border-border/60 bg-primary/10 p-2 text-primary transition-[background-color,color] group-hover:bg-primary group-hover:text-primary-foreground">
                  {action.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium group-hover:text-primary">
                    {action.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </TerminalPanel>

        {hostingEnabled ? (
          <Tabs
            value={activeDashboardTab}
            onValueChange={(v) => setActiveDashboardTab(v as "vps" | "hosting")}
            className="space-y-6"
          >
            <div className="flex items-center justify-between gap-4">
              <TabsList className="inline-flex h-10 gap-0 rounded-sm border border-border bg-muted/30 p-0 shadow-none">
                <TabsTrigger
                  value="vps"
                  className="rounded-none border-r border-border px-5 py-2 text-xs font-semibold uppercase tracking-wide last:border-r-0 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-transparent"
                >
                  <Server className="mr-2 h-4 w-4" />
                  VPS
                </TabsTrigger>
                <TabsTrigger
                  value="hosting"
                  className="rounded-none px-5 py-2 text-xs font-semibold uppercase tracking-wide data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-transparent"
                >
                  <Globe className="mr-2 h-4 w-4" />
                  Hosting
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="vps" className="mt-0">
              <TerminalPanel title="VPS FLEET" bodyClassName="p-4 md:p-6">
                <div className="mb-6 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    Live signal across your deployments —{" "}
                    <span className="text-foreground/80">tty metrics</span>
                  </p>
                  <Button variant="outline" size="sm" className="rounded-sm shadow-none" asChild>
                    <Link to="/vps">
                      Manage all
                      <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                  <div className="space-y-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-0">
                      <div className="flex flex-1 items-center gap-3 px-1 py-1 md:px-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-border bg-primary/10 text-primary">
                          <Wallet className="h-4 w-4" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Wallet Balance
                          </p>
                          <p className="text-lg font-semibold tabular-nums leading-tight">
                            {formatBillingAmount(walletBalance)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Ready to deploy infrastructure
                          </p>
                        </div>
                      </div>

                      <div className="hidden h-12 border-l border-border md:block" aria-hidden="true" />

                      <div className="flex flex-1 items-center gap-3 px-1 py-1 md:px-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-border bg-accent/30 text-primary">
                          <TrendingUp className="h-4 w-4" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Monthly Spend
                          </p>
                          <p className="text-lg font-semibold tabular-nums leading-tight">
                            {formatBillingAmount(monthlySpend)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Current month to date
                          </p>
                        </div>
                      </div>

                      <div className="hidden h-12 border-l border-border md:block" aria-hidden="true" />

                      <div className="flex flex-1 items-center gap-3 px-1 py-1 md:px-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-border bg-accent/30 text-primary">
                          <ActivityIcon className="h-4 w-4" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Last Payment
                          </p>
                          <p className="text-lg font-semibold tabular-nums leading-tight">
                            {lastPayment?.amount
                              ? formatBillingAmount(lastPayment.amount)
                              : "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {lastPayment?.date
                              ? formatTimestamp(lastPayment.date)
                              : "No payments yet"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                    {vpsInstances.length === 0 ? (
                      <div className="flex min-h-[250px] flex-col items-center justify-center rounded-sm border border-dashed border-border p-16 text-center">
                        <div className="rounded-sm border border-border bg-muted p-4">
                          <Server className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="mt-6 text-base font-semibold">
                          No instances yet
                        </h3>
                        <p className="mt-2 max-w-md text-sm text-muted-foreground">
                          Deploy your first VPS to attach live metrics to this pane.
                        </p>
                        <div className="mt-6 flex flex-wrap gap-3">
                          <Button size="lg" onClick={() => navigate('/vps')}>
                            <Plus className="mr-2 h-4 w-4" />
                            Deploy VPS
                          </Button>
                        </div>
                      </div>
                    ) : (
                      vpsInstances.slice(0, 5).map((vps) => {
                        // Use the cpu value that was already extracted during data loading
                        const hasMetrics = vps.cpu > 0;
                        const cpuLoad = Math.min(100, Math.max(0, vps.cpu));

                        return (
                          <button
                            key={vps.id}
                            type="button"
                            onClick={() => handleVpsClick(vps.id)}
                            className="group w-full rounded-sm border border-border bg-card p-4 text-left ring-2 ring-inset ring-transparent transition-[background-color,box-shadow] hover:bg-muted/30 hover:ring-primary/40"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold group-hover:text-primary">
                                    {vps.name}
                                  </h4>
                                  <Badge
                                    variant={
                                      vps.status === "running"
                                        ? "default"
                                        : vps.status === "stopped"
                                          ? "secondary"
                                          : "outline"
                                    }
                                  >
                                    {vps.status}
                                  </Badge>
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                  <span>{vps.plan || "Unassigned"}</span>
                                  <span>•</span>
                                  <span>{vps.location || "Unknown region"}</span>
                                </div>
                              </div>
                              <div className="w-40 space-y-2 text-right">
                                <div>
                                  <div className="mb-1 flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">
                                      CPU {vps.cpuCount > 0 ? `(${vps.cpuCount})` : ''}
                                    </span>
                                    {hasMetrics ? (
                                      <span className="font-semibold">
                                        {cpuLoad.toFixed(1)}%
                                      </span>
                                    ) : (
                                      <span className="text-xs text-muted-foreground italic">
                                        Pending
                                      </span>
                                    )}
                                  </div>
                                  {hasMetrics ? (
                                    <Progress value={cpuLoad} className="h-1.5" />
                                  ) : (
                                    <div className="h-1.5 w-full rounded-full bg-muted" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                    </div>
                  </div>
              </TerminalPanel>
            </TabsContent>

            <TabsContent value="hosting" className="mt-0">
              <TerminalPanel title="WEB HOSTING" bodyClassName="p-4 md:p-6">
                <div className="mb-6 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <p className="max-w-xl text-xs text-muted-foreground">
                    Website subscriptions, hosting wallet, and billing readiness.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="rounded-sm shadow-none" asChild>
                      <Link to="/billing">Fund wallet</Link>
                    </Button>
                    <Button size="sm" className="rounded-sm shadow-none" asChild>
                      <Link to="/hosting/store">
                        Create Hosting
                        <ArrowUpRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-sm border border-border bg-card p-4">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-sm border border-border/60 bg-primary/10 text-primary">
                          <Globe className="h-4 w-4" />
                        </div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Active Hosting
                        </p>
                        <p className="mt-1 text-2xl font-semibold tabular-nums">{activeHostingServices}</p>
                        <p className="text-xs text-muted-foreground">
                          {hostingServices.length} total subscription{hostingServices.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="rounded-sm border border-border bg-card p-4">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-sm border border-border/60 bg-primary/10 text-primary">
                          <Wallet className="h-4 w-4" />
                        </div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Hosting Wallet
                        </p>
                        <p className="mt-1 text-2xl font-semibold tabular-nums">
                          {formatBillingAmount(hostingWalletBalance)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Reserved for monthly hosting charges
                        </p>
                      </div>
                      <div className="rounded-sm border border-border bg-card p-4">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-sm border border-border/60 bg-primary/10 text-primary">
                          <ShieldCheck className="h-4 w-4" />
                        </div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Enhance Status
                        </p>
                        <p className="mt-1 text-2xl font-semibold tabular-nums">Enabled</p>
                        <p className="text-xs text-muted-foreground">
                          Hosting routes and checkout are available
                        </p>
                      </div>
                    </div>

                    {hostingServices.length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border p-12 text-center">
                        <div className="rounded-sm border border-border bg-muted p-4">
                          <Globe className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="mt-6 text-base font-semibold">
                          No hosting subscriptions yet
                        </h3>
                        <p className="mt-2 max-w-md text-sm text-muted-foreground">
                          Create your first Enhance hosting subscription to manage websites from the dashboard.
                        </p>
                        <Button className="mt-6 rounded-sm shadow-none" asChild>
                          <Link to="/hosting/store">
                            <Plus className="mr-2 h-4 w-4" />
                            Create Hosting
                          </Link>
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {hostingServices.slice(0, 4).map((service) => (
                          <Link
                            key={service.id}
                            to={`/hosting/${service.id}`}
                            className="group flex items-center justify-between gap-4 rounded-sm border border-border bg-card p-4 ring-2 ring-inset ring-transparent transition-[background-color,box-shadow] hover:bg-muted/30 hover:ring-primary/40"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold group-hover:text-primary">
                                  {service.domain ?? "Hosting service"}
                                </h4>
                                <Badge variant={service.status === "active" ? "default" : "secondary"}>
                                  {service.status}
                                </Badge>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {service.planName ?? "Hosting plan"} · next billing {formatTimestamp(service.nextBillingAt ?? undefined)}
                              </p>
                            </div>
                            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
              </TerminalPanel>
            </TabsContent>
          </Tabs>
        ) : (
          <TerminalPanel title="VPS FLEET" bodyClassName="p-4 md:p-6">
            <div className="mb-6 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Live signal across your deployments.
              </p>
              <Button variant="outline" size="sm" className="rounded-sm shadow-none" asChild>
                <Link to="/vps">
                  Manage all
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
              <div className="space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-0">
                  <div className="flex flex-1 items-center gap-3 px-1 py-1 md:px-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-border bg-primary/10 text-primary">
                      <Wallet className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Wallet Balance
                      </p>
                      <p className="text-lg font-semibold tabular-nums leading-tight">
                        {formatBillingAmount(walletBalance)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Ready to deploy infrastructure
                      </p>
                    </div>
                  </div>

                  <div className="hidden h-12 border-l border-border md:block" aria-hidden="true" />

                  <div className="flex flex-1 items-center gap-3 px-1 py-1 md:px-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-border bg-accent/30 text-primary">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Monthly Spend
                      </p>
                      <p className="text-lg font-semibold tabular-nums leading-tight">
                        {formatBillingAmount(monthlySpend)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Current month to date
                      </p>
                    </div>
                  </div>

                  <div className="hidden h-12 border-l border-border md:block" aria-hidden="true" />

                  <div className="flex flex-1 items-center gap-3 px-1 py-1 md:px-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-border bg-accent/30 text-primary">
                      <ActivityIcon className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Last Payment
                      </p>
                      <p className="text-lg font-semibold tabular-nums leading-tight">
                        {lastPayment?.amount
                          ? formatBillingAmount(lastPayment.amount)
                          : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lastPayment?.date
                          ? formatTimestamp(lastPayment.date)
                          : "No payments yet"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                {vpsInstances.length === 0 ? (
                  <div className="flex min-h-[250px] flex-col items-center justify-center rounded-sm border border-dashed border-border p-16 text-center">
                    <div className="rounded-sm border border-border bg-muted p-4">
                      <Server className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="mt-6 text-base font-semibold">
                      No instances yet
                    </h3>
                    <p className="mt-2 max-w-md text-sm text-muted-foreground">
                      Deploy your first VPS to attach live metrics to this pane.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <Button size="lg" className="rounded-sm shadow-none" onClick={() => navigate('/vps')}>
                        <Plus className="mr-2 h-4 w-4" />
                        Deploy VPS
                      </Button>
                    </div>
                  </div>
                ) : (
                  vpsInstances.slice(0, 5).map((vps) => {
                    // Use the cpu value that was already extracted during data loading
                    const hasMetrics = vps.cpu > 0;
                    const cpuLoad = Math.min(100, Math.max(0, vps.cpu));

                    return (
                      <button
                        key={vps.id}
                        type="button"
                        onClick={() => handleVpsClick(vps.id)}
                        className="group w-full rounded-sm border border-border bg-card p-4 text-left ring-2 ring-inset ring-transparent transition-[background-color,box-shadow] hover:bg-muted/30 hover:ring-primary/40"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold group-hover:text-primary">
                                {vps.name}
                              </h4>
                              <Badge
                                variant={
                                  vps.status === "running"
                                    ? "default"
                                    : vps.status === "stopped"
                                      ? "secondary"
                                      : "outline"
                                }
                              >
                                {vps.status}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <span>{vps.plan || "Unassigned"}</span>
                              <span>•</span>
                              <span>{vps.location || "Unknown region"}</span>
                            </div>
                          </div>
                          <div className="w-40 space-y-2 text-right">
                            <div>
                              <div className="mb-1 flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">
                                  CPU {vps.cpuCount > 0 ? `(${vps.cpuCount})` : ''}
                                </span>
                                {hasMetrics ? (
                                  <span className="font-semibold">
                                    {cpuLoad.toFixed(1)}%
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">
                                    Pending
                                  </span>
                                )}
                              </div>
                              {hasMetrics ? (
                                <Progress value={cpuLoad} className="h-1.5" />
                              ) : (
                                <div className="h-1.5 w-full rounded-full bg-muted" />
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
                </div>
              </div>
          </TerminalPanel>
        )}
      </div>

      {/* Recent Activity */}
      <TerminalPanel title="RECENT ACTIVITY" bodyClassName="p-4 md:p-6">
        <div className="mb-4 flex flex-row items-center justify-between gap-3 border-b border-border pb-4">
          <p className="text-xs text-muted-foreground">Track your platform events</p>
          <Button variant="outline" size="sm" className="rounded-sm shadow-none" asChild>
            <Link to="/activity">
              View all
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
          {recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border p-12 text-center">
              <div className="rounded-sm border border-border bg-muted p-4">
                <ActivityIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Activity will appear here after your next deployment or billing
                event
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivity.slice(0, 8).map((activity, index) => (
                <div key={activity.id} className="relative flex gap-4 pl-6">
                  {index !== recentActivity.length - 1 && (
                    <span className="absolute left-2 top-6 h-full w-px bg-border" />
                  )}
                  <div
                    className={`absolute left-0 top-2 flex h-4 w-4 items-center justify-center rounded-sm border-2 ${
                      activity.status === "success"
                        ? "border-primary bg-primary/10"
                        : activity.status === "warning"
                          ? "border-muted-foreground bg-muted"
                          : activity.status === "error"
                            ? "border-destructive bg-destructive/10"
                            : "border-primary bg-primary/10"
                    }`}
                  />
                  <div className="flex flex-1 flex-col gap-1 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.type === "billing" && "Billing event"}
                        {activity.type === "vps" && "VPS event"}
                        {activity.type === "support" && "Support update"}
                        {!["billing", "vps", "support"].includes(
                          activity.type,
                        ) && "System event"}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(activity.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
      </TerminalPanel>
    </div>
  );
};

export default Dashboard;
