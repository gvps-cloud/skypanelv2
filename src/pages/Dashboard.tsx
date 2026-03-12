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
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { getMonthlySpendWithFallback } from "../lib/billingUtils";
import { MonthlyResetIndicator } from "@/components/Dashboard/MonthlyResetIndicator";
import { formatCurrency } from "@/lib/formatters";
import { apiClient } from "@/lib/api";

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

interface BillingStats {
  walletBalance: number;
  monthlySpend: number;
  lastPayment: {
    amount: number;
    date: string;
  };
}

interface ActivityItem {
  id: string;
  type: "vps" | "billing" | "support" | "activity";
  message: string;
  timestamp: string;
  status: "success" | "warning" | "error" | "info";
}

const Dashboard: React.FC = () => {
  const [vpsInstances, setVpsInstances] = useState<VPSStats[]>([]);
  const [billing, setBilling] = useState<BillingStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const loadDashboardData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [vpsData, walletData, paymentsData] = await Promise.all([
        apiClient.get("/vps"),
        apiClient.get("/payments/wallet/balance"),
        apiClient.get("/payments/history?limit=1&status=completed"),
      ]);

      const instances: VPSStats[] = await Promise.all(
        (vpsData.instances || []).map(async (instance: any) => {
          let metrics: VpsMetrics | undefined;
          let cpu = 0;
          let cpuCount = 0;

          try {
            const detailData = await apiClient.get(`/vps/${instance.id}`);
            
            // Metrics are nested under instance
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
            
            cpu = metricsData?.cpu?.summary?.last || 0;
            cpuCount = detailData.instance?.plan?.specs?.vcpus || 0;
          } catch (error) {
            console.warn(
              `Failed to fetch metrics for VPS ${instance.id}:`,
              error,
            );
          }

          return {
            id: instance.id,
            name: instance.label || "instance",
            status: instance.status || "provisioning",
            plan: instance.plan_name || instance.configuration?.type || "",
            location: instance.configuration?.region || "",
            cpu: Math.round(cpu * 100) / 100,
            cpuCount,
            memory: null,
            storage: 0,
            ip: instance.ip_address || "",
            metrics,
          } satisfies VPSStats;
        }),
      );

      setVpsInstances(instances);

      const lastPaymentItem = (paymentsData.payments || [])[0];
      const monthlySpend = await getMonthlySpendWithFallback();

      setBilling({
        walletBalance: walletData.balance ?? 0,
        monthlySpend,
        lastPayment: {
          amount: lastPaymentItem?.amount ?? 0,
          date: lastPaymentItem?.created_at ?? "",
        },
      });

      try {
        const actData = await apiClient.get("/activity/recent?limit=10");
        const mapped: ActivityItem[] = (actData.activities || []).map(
          (activity: any) => ({
            id: activity.id,
            type: activity.type || activity.entity_type || "activity",
            message: activity.message || `${activity.event_type}`,
            timestamp: activity.timestamp || activity.created_at,
            status: activity.status || "info",
          }),
        );
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
  }, [token]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const quickActions = useMemo(() => {
    const actions = [
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

    return actions;
  }, []);

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

  
  if (loading) {
    return (
      <div className="space-y-6">
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Content Area */}
      <div className="space-y-6">
        {/* Status Overview */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-2 px-3 py-1.5">
              <div className="h-2 w-2 rounded-full bg-primary" />
              {heroStats.running} vps active
            </Badge>
            {heroStats.flagged > 0 && (
              <Badge variant="secondary" className="gap-2 px-3 py-1.5">
                <AlertTriangle className="h-3 w-3" />
                {heroStats.flagged} attention
              </Badge>
            )}
            {heroStats.averageCpu !== null && (
              <Badge variant="outline" className="gap-2 px-3 py-1.5">
                <TrendingUp className="h-3 w-3" />
                Avg CPU {heroStats.averageCpu.toFixed(1)}%
              </Badge>
            )}
          </div>

          <MonthlyResetIndicator
            monthlySpend={monthlySpend}
            showAnimation={false}
            className="ml-auto sm:ml-auto sm:items-center sm:text-left"
          />
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent
            className={`grid gap-4 md:grid-cols-2 ${quickActions.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}
          >
            {quickActions.map((action) => (
              <Link
                key={action.title}
                to={action.to}
                className="group flex items-center gap-3 rounded-lg border bg-card p-3 transition-all hover:border-primary/50 hover:bg-accent"
              >
                <div className="rounded-md bg-primary/10 p-2 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
                  {action.icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium group-hover:text-primary">
                    {action.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {action.description}
                  </p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Services & VPS Fleet */}
        <div className="grid gap-6 lg:grid-cols-1">
          {/* VPS Fleet */}
          <Card className="h-full">
            <CardHeader className="flex flex-col gap-1 pb-4 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
              <div className="space-y-1">
                <CardTitle>VPS Fleet</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Live signal across your deployments
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/vps">
                  Manage all
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-0">
                  <div className="flex flex-1 items-center gap-3 px-1 py-1 md:px-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Wallet className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Wallet Balance
                      </p>
                      <p className="text-lg font-semibold leading-tight">
                        {formatCurrency(walletBalance)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Ready to deploy infrastructure
                      </p>
                    </div>
                  </div>

                  <div className="hidden h-12 border-l border-border md:block" aria-hidden="true" />

                  <div className="flex flex-1 items-center gap-3 px-1 py-1 md:px-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/30 text-primary">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Monthly Spend
                      </p>
                      <p className="text-lg font-semibold leading-tight">
                        {formatCurrency(monthlySpend)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Current month to date
                      </p>
                    </div>
                  </div>

                  <div className="hidden h-12 border-l border-border md:block" aria-hidden="true" />

                  <div className="flex flex-1 items-center gap-3 px-1 py-1 md:px-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/30 text-primary">
                      <ActivityIcon className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Last Payment
                      </p>
                      <p className="text-lg font-semibold leading-tight">
                        {lastPayment?.amount
                          ? formatCurrency(lastPayment.amount)
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
                  <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-16 text-center min-h-[250px]">
                    <div className="rounded-full bg-muted p-4">
                      <Server className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="mt-6 text-base font-semibold">
                      No instances yet
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground max-w-md">
                      Deploy your first VPS to see live metrics
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
                        className="group w-full rounded-lg border bg-card p-4 text-left transition-all hover:border-primary/50 hover:shadow-md"
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
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Recent Activity</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Track your platform events
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/activity">
              View all
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
              <div className="rounded-full bg-muted p-4">
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
                    className={`absolute left-0 top-2 flex h-4 w-4 items-center justify-center rounded-full border-2 ${
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
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
