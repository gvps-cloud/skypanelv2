import React, { useState, useEffect } from "react";
import { motion, type Variants } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Server,
  Clock,
  Activity,
  ChevronDown,
  ChevronUp,
  Wrench,
  Shield,
  Sparkles,
  ActivitySquare,
  ServerCog,
  Network,
  Headphones,
  Zap,
} from "lucide-react";

import "@/styles/home.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Status as StatusDot } from "@/components/ui/status";
import MarketingNavbar from "@/components/MarketingNavbar";
import MarketingFooter from "@/components/MarketingFooter";
import { BRAND_NAME } from "@/lib/brand";
import { VPSInfrastructureCard } from "@/components/VPSInfrastructureCard";

/* ─── Animation Variants ─────────────────────────────────────────── */

const revealContainer: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const revealItem: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

/* ─── Trust Items ────────────────────────────────────────────────── */

const trustItems = [
  { icon: Zap, label: "99.9% Uptime SLA" },
  { icon: Network, label: "Multi-Region Monitoring" },
  { icon: ActivitySquare, label: "Real-time Alerts" },
  { icon: ServerCog, label: "60s Polling" },
  { icon: Shield, label: "DDoS Protection" },
  { icon: Server, label: "Global Backbone" },
  { icon: Headphones, label: "Incident Response" },
  { icon: CheckCircle2, label: "SLA Guarantees" },
];

/* ─── Types ──────────────────────────────────────────────────────── */

type ServiceStatus = "operational" | "degraded" | "outage" | "maintenance";

interface ServiceComponent {
  name: string;
  status: ServiceStatus;
  icon: React.ComponentType<{ className?: string }>;
  instances?: number;
  description: string;
  availability?: number;
  statusHistory?: Array<{
    day: string;
    status: string;
    downtimeDuration: number;
  }>;
}

interface IncidentUpdate {
  time: string;
  message: string;
  status: ServiceStatus;
}

interface Incident {
  id: string;
  title: string;
  status: ServiceStatus;
  startTime: string;
  updates: IncidentUpdate[];
}

interface BetterStackMonitor {
  id: string;
  name: string;
  status: "operational" | "degraded" | "downtime" | "maintenance";
  availability: number;
  statusHistory: Array<{
    day: string;
    status: string;
    downtimeDuration: number;
  }>;
}

interface BetterStackIncident {
  id: string;
  name: string;
  url: string;
  cause: string | null;
  startedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  status: "started" | "acknowledged" | "resolved";
  regions: string[];
}

interface BetterStackStatusUpdate {
  id: string;
  author: string | null;
  status: string;
  message: string;
  createdAt: string;
}

interface BetterStackStatusReport {
  id: string;
  title: string;
  reportType: "manual" | "automatic" | "maintenance";
  startsAt: string;
  endsAt: string | null;
  aggregateState: "operational" | "degraded" | "downtime" | "maintenance";
  affectedResources: Array<{
    statusPageResourceId: string;
    status: string;
  }>;
  statusUpdates: BetterStackStatusUpdate[];
}

/* ─── Component ──────────────────────────────────────────────────── */

export default function Status() {
  const [services, setServices] = useState<ServiceComponent[]>([]);
  const [activeIncidents, setActiveIncidents] = useState<Incident[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>(() => new Date().toLocaleTimeString());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Better Stack state
  const [bsMonitors, setBsMonitors] = useState<BetterStackMonitor[]>([]);
  const [bsActiveIncidents, setBsActiveIncidents] = useState<BetterStackIncident[]>([]);
  const [bsIncidentsHistory, setBsIncidentsHistory] = useState<BetterStackIncident[]>([]);
  const [bsStatusReports, setBsStatusReports] = useState<BetterStackStatusReport[]>([]);
  const [bsConfigured, setBsConfigured] = useState(false);
  const [bsCachedAt, setBsCachedAt] = useState<string | null>(null);
  const [bsStale, setBsStale] = useState(false);
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const fetchLiveData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      let vpsCount = 0;
      let vpsRunning = 0;
      let vpsStopped = 0;

      try {
        const statusResponse = await fetch("/api/health/status");
        const statusData = await statusResponse.json();

        if (statusData.success && statusData.services) {
          vpsCount = statusData.services.vps?.total || 0;
          vpsRunning = statusData.services.vps?.running || 0;
          vpsStopped = statusData.services.vps?.stopped || 0;
        }
      } catch (err) {
        console.warn("Failed to fetch status data:", err);
      }

      const liveServices: ServiceComponent[] = [
        {
          name: "VPS Infrastructure",
          status: "operational",
          icon: Server,
          instances: vpsCount,
          description: `Virtual Private Server provisioning and management${vpsCount > 0 ? ` (${vpsRunning} running, ${vpsStopped} stopped)` : ""}`,
        },
      ];

      setServices(liveServices);
      setActiveIncidents([]);
      setLastUpdated(new Date().toLocaleTimeString());

      try {
        const uptimeResponse = await fetch("/api/health/uptime");
        const uptimeData = await uptimeResponse.json();

        if (uptimeData.success && uptimeData.configured) {
          setBsConfigured(true);
          setBsMonitors(uptimeData.monitors ?? []);
          setBsActiveIncidents(uptimeData.activeIncidents ?? []);
          setBsIncidentsHistory(uptimeData.incidentsHistory ?? []);
          setBsStatusReports(uptimeData.statusReports ?? []);
          setBsCachedAt(uptimeData.cachedAt);
          setBsStale(uptimeData.stale ?? false);

          const monitors = uptimeData.monitors ?? [];
          if (monitors.length > 0) {
            const monitorServices: ServiceComponent[] = monitors.map(
              (monitor: BetterStackMonitor) => ({
                name: monitor.name,
                status: monitor.status as ServiceStatus,
                icon: Shield,
                description: `${getAvailabilityLabel(monitor.availability)} availability`,
                availability: monitor.availability,
                statusHistory: monitor.statusHistory,
              })
            );
            setServices([...liveServices, ...monitorServices]);
          }
        } else {
          setBsConfigured(false);
        }
      } catch (err) {
        console.warn("Failed to fetch Better Stack data:", err);
        setBsConfigured(false);
      }
    } catch (err) {
      console.error("Failed to fetch live data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch live data");

      const fallbackServices: ServiceComponent[] = [
        {
          name: "VPS Infrastructure",
          status: "degraded",
          icon: Server,
          instances: 0,
          description: "Virtual Private Server provisioning and management",
        },
      ];
      setServices(fallbackServices);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchLiveData();
    setIsRefreshing(false);
  };

  const getStatusLabel = (status: ServiceStatus) => {
    switch (status) {
      case "operational":
        return "Operational";
      case "degraded":
        return "Degraded Performance";
      case "outage":
        return "Major Outage";
      case "maintenance":
        return "Scheduled Maintenance";
      default:
        return "Unknown";
    }
  };

  const getStatusBadge = (status: ServiceStatus) => {
    const variants = {
      operational: "default",
      degraded: "secondary",
      outage: "destructive",
      maintenance: "outline",
    };

    return (
      <Badge variant={variants[status] as any}>
        {getStatusLabel(status)}
      </Badge>
    );
  };

  const allOperational =
    services.every((s) => s.status === "operational") &&
    (!bsConfigured || bsMonitors.every((m) => m.status === "operational"));

  const getAvailabilityLabel = (avail: number) => {
    return (avail * 100).toFixed(2) + "%";
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
    return `${Math.round(seconds / 86400)}d`;
  };

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case "maintenance":
        return <Wrench className="h-4 w-4 text-blue-500" />;
      case "automatic":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getReportTypeLabel = (type: string) => {
    switch (type) {
      case "maintenance":
        return "Scheduled Maintenance";
      case "automatic":
        return "Auto-detected Incident";
      default:
        return "Reported Incident";
    }
  };

  const getServiceIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("api") || n.includes("rest") || n.includes("http")) return Network;
    if (n.includes("database") || n.includes("db") || n.includes("sql")) return ServerCog;
    if (n.includes("dns")) return ActivitySquare;
    if (n.includes("email") || n.includes("mail") || n.includes("smtp")) return Headphones;
    return Shield;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingNavbar />

      <main className="pt-[72px]">
        {/* ═══════════════════════════ HERO ═══════════════════════════ */}
        <section className="relative overflow-hidden border-b border-border/40">
          {/* Floating orbs */}
          <div className="home-orb home-orb--1" aria-hidden="true" />
          <div className="home-orb home-orb--2" aria-hidden="true" />
          <div className="home-orb home-orb--3" aria-hidden="true" />
          <div className="home-grid-mask absolute inset-0" aria-hidden="true" />

          <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-24 sm:px-6 lg:px-8 lg:pb-24 lg:pt-28">
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65 }}
              className="space-y-8"
            >
              <div className="space-y-5">
                <Badge
                  variant="outline"
                  className="home-shimmer-badge w-fit rounded-full px-4 py-1.5 border-primary/30 bg-primary/5 text-primary"
                >
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  Live Platform Health
                </Badge>

                <h1 className="text-balance text-4xl font-medium leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl 2xl:text-7xl">
                  <span className="block font-bold bg-gradient-to-r from-primary via-primary to-primary/50 bg-clip-text text-transparent">
                    {BRAND_NAME} Status
                  </span>
                </h1>

                <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                  Real-time availability for VPS, networking, and supporting
                  systems. Data refreshes automatically every few minutes and
                  whenever you request an update.
                </p>
              </div>

              {/* Status pill */}
              <div className="flex flex-wrap items-center gap-4">
                <div
                  className={`inline-flex items-center gap-2.5 rounded-full border px-5 py-2.5 text-sm font-medium ${
                    allOperational
                      ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                      : "border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                  }`}
                >
                  {allOperational ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      All Systems Operational
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4" />
                      Some Services Degraded
                    </>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="h-9"
                >
                  <RefreshCw
                    className={`mr-2 h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
              </div>

              {/* Last updated */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs uppercase tracking-wide text-muted-foreground">
                <span>Last updated {lastUpdated}</span>
                {bsConfigured && bsCachedAt && (
                  <>
                    <Separator orientation="vertical" className="h-4" />
                    <span className="text-muted-foreground">
                      Uptime data{" "}
                      {bsStale
                        ? "(refreshing...)"
                        : `cached ${new Date(bsCachedAt).toLocaleTimeString()}`}
                    </span>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════ TRUST MARQUEE ═══════════════════════ */}
        <section className="border-b border-border/40 bg-muted/20 py-5">
          <div className="home-marquee">
            <div className="home-marquee__track">
              {[...trustItems, ...trustItems].map((item, i) => (
                <div
                  key={i}
                  className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground"
                >
                  <item.icon className="h-4 w-4 text-primary/60" />
                  <span className="whitespace-nowrap font-medium">
                    {item.label}
                  </span>
                  <span className="ml-4 h-1 w-1 rounded-full bg-border" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════ MAIN CONTENT ═════════════════════════ */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="space-y-16">
              {/* Error Banner */}
              {error && (
                <motion.div variants={revealItem}>
                  <Card className="border-orange-500/50 bg-orange-50 dark:bg-orange-950/20 home-gradient-border-top">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                        <div>
                          <h3 className="font-medium text-orange-800 dark:text-orange-200">
                            Data Loading Issue
                          </h3>
                          <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                            {error}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Active Incidents */}
              {activeIncidents.length > 0 && (
                <motion.div variants={revealItem}>
                  <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">Active incidents</h2>
                    <div className="space-y-4">
                      {activeIncidents.map((incident) => (
                        <Card
                          key={incident.id}
                          className="home-feature-card border-orange-500/30"
                        >
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle>{incident.title}</CardTitle>
                                <CardDescription className="mt-2">
                                  Started:{" "}
                                  {new Date(incident.startTime).toLocaleString()}
                                </CardDescription>
                              </div>
                              {getStatusBadge(incident.status)}
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {incident.updates.map((update, idx) => (
                                <div key={idx} className="flex gap-3 text-sm">
                                  <div className="flex-shrink-0 text-muted-foreground">
                                    {update.time}
                                  </div>
                                  <div className="flex-grow">
                                    {update.message}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>
                </motion.div>
              )}

              {/* Better Stack — Active Incidents & Status Reports */}
              {bsConfigured &&
                (bsActiveIncidents.length > 0 ||
                  bsStatusReports.filter(
                    (r) => r.aggregateState !== "operational"
                  ).length > 0) && (
                  <motion.div variants={revealItem}>
                    <section className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Activity className="h-5 w-5 text-orange-500" />
                        <h2 className="text-2xl font-semibold">
                          Active Incidents
                        </h2>
                        <Badge variant="destructive" className="ml-auto">
                          {bsActiveIncidents.length +
                            bsStatusReports.filter(
                              (r) => r.aggregateState !== "operational"
                            ).length}{" "}
                          active
                        </Badge>
                      </div>
                      <div className="space-y-4">
                        {bsActiveIncidents.map((incident) => (
                          <Card
                            key={incident.id}
                            className="home-feature-card border-orange-500/30"
                          >
                            <CardHeader>
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                                    <span className="truncate">{incident.name}</span>
                                  </CardTitle>
                                  <CardDescription className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                                    <span>
                                      Started:{" "}
                                      {new Date(incident.startedAt).toLocaleString()}
                                    </span>
                                    {incident.cause && (
                                      <span className="text-orange-600 dark:text-orange-400">
                                        Cause: {incident.cause}
                                      </span>
                                    )}
                                    {incident.regions.length > 0 && (
                                      <span>
                                        Regions:{" "}
                                        {incident.regions
                                          .join(", ")
                                          .toUpperCase()}
                                      </span>
                                    )}
                                  </CardDescription>
                                </div>
                                <Badge
                                  variant={
                                    incident.status === "acknowledged"
                                      ? "secondary"
                                      : "destructive"
                                  }
                                >
                                  {incident.status === "acknowledged"
                                    ? "Acknowledged"
                                    : "Investigating"}
                                </Badge>
                              </div>
                            </CardHeader>
                          </Card>
                        ))}

                        {bsStatusReports
                          .filter((r) => r.aggregateState !== "operational")
                          .map((report) => (
                            <Card
                              key={report.id}
                              className={`home-feature-card ${
                                report.reportType === "maintenance"
                                  ? "border-blue-500/30"
                                  : "border-orange-500/30"
                              }`}
                            >
                              <CardHeader>
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <CardTitle className="flex items-center gap-2">
                                      {getReportTypeIcon(report.reportType)}
                                      <span className="truncate">
                                        {report.title}
                                      </span>
                                    </CardTitle>
                                    <CardDescription className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                                      <span>
                                        {report.endsAt
                                          ? `${new Date(
                                              report.startsAt
                                            ).toLocaleString()} — ${new Date(
                                              report.endsAt
                                            ).toLocaleString()}`
                                          : `Started: ${new Date(
                                              report.startsAt
                                            ).toLocaleString()}`}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {getReportTypeLabel(report.reportType)}
                                      </Badge>
                                    </CardDescription>
                                  </div>
                                  <Badge
                                    variant={
                                      report.aggregateState === "downtime"
                                        ? "destructive"
                                        : report.aggregateState === "maintenance"
                                        ? "outline"
                                        : "secondary"
                                    }
                                  >
                                    {report.aggregateState === "downtime"
                                      ? "Downtime"
                                      : report.aggregateState === "degraded"
                                      ? "Degraded"
                                      : report.aggregateState === "maintenance"
                                      ? "Maintenance"
                                      : "Operational"}
                                  </Badge>
                                </div>
                              </CardHeader>
                              {report.statusUpdates.length > 0 && (
                                <CardContent>
                                  <div
                                    className="cursor-pointer flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                                    onClick={() =>
                                      setExpandedIncident(
                                        expandedIncident === report.id
                                          ? null
                                          : report.id
                                      )
                                    }
                                  >
                                    {expandedIncident === report.id ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                    {report.statusUpdates.length} update
                                    {report.statusUpdates.length !== 1 ? "s" : ""}
                                  </div>
                                  {expandedIncident === report.id && (
                                    <div className="mt-3 space-y-3 border-l-2 border-muted pl-4">
                                      {report.statusUpdates.map((update) => (
                                        <div
                                          key={update.id}
                                          className="relative"
                                        >
                                          <div className="absolute -left-[1.35rem] top-1.5 h-2 w-2 rounded-full bg-muted-foreground" />
                                          <div className="text-xs text-muted-foreground mb-1">
                                            {new Date(
                                              update.createdAt
                                            ).toLocaleString()}
                                            {update.author &&
                                              ` · ${update.author}`}
                                          </div>
                                          <div className="text-sm">
                                            {update.message || update.status}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </CardContent>
                              )}
                            </Card>
                          ))}
                      </div>
                    </section>
                  </motion.div>
                )}

              {/* Better Stack — Incident History */}
              {bsConfigured && bsIncidentsHistory.length > 0 && (
                <motion.div variants={revealItem}>
                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        <h2 className="text-2xl font-semibold">
                          Incident History
                        </h2>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowHistory(!showHistory)}
                        className="h-8"
                      >
                        {showHistory ? (
                          <>
                            <ChevronUp className="mr-2 h-3.5 w-3.5" />
                            Hide History
                          </>
                        ) : (
                          <>
                            <ChevronDown className="mr-2 h-3.5 w-3.5" />
                            Show{" "}
                            {
                              bsIncidentsHistory.filter((i) => i.resolvedAt)
                                .length
                            }{" "}
                            Past Incidents
                          </>
                        )}
                      </Button>
                    </div>
                    {showHistory && (
                      <Card className="home-feature-card shadow-sm">
                        <CardContent className="divide-y">
                          {bsIncidentsHistory
                            .filter((i) => i.resolvedAt)
                            .sort(
                              (a, b) =>
                                new Date(b.startedAt).getTime() -
                                new Date(a.startedAt).getTime()
                            )
                            .slice(0, 20)
                            .map((incident) => {
                              const start = new Date(incident.startedAt);
                              const end = new Date(incident.resolvedAt!);
                              const durationMs = end.getTime() - start.getTime();
                              return (
                                <div
                                  key={incident.id}
                                  className="flex flex-col gap-2 py-4 md:flex-row md:items-center md:justify-between"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div
                                      className="h-3 w-3 rounded-full flex-shrink-0 bg-green-500"
                                      title="Resolved"
                                    />
                                    <div className="min-w-0">
                                      <h3 className="font-medium truncate text-sm">
                                        {incident.name}
                                      </h3>
                                      <p className="text-xs text-muted-foreground">
                                        {start.toLocaleDateString()} ·{" "}
                                        {start.toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}{" "}
                                        –{" "}
                                        {end.toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 text-sm">
                                    {incident.cause && (
                                      <span
                                        className="text-muted-foreground truncate max-w-[200px]"
                                        title={incident.cause}
                                      >
                                        {incident.cause}
                                      </span>
                                    )}
                                    <Badge
                                      variant="secondary"
                                      className="text-xs whitespace-nowrap"
                                    >
                                      {formatDuration(durationMs / 1000)}
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })}
                        </CardContent>
                      </Card>
                    )}
                  </section>
                </motion.div>
              )}

              {/* Service Components */}
              <motion.div variants={revealItem}>
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-semibold">Service components</h2>
                    <Badge variant="secondary">
                      Monitoring every 60 seconds
                    </Badge>
                  </div>

                  <Card className="home-feature-card shadow-sm">
                    <CardContent className="divide-y">
                      {/* VPS Infrastructure */}
                      <VPSInfrastructureCard />

                      {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="flex items-center gap-3">
                            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                            <span className="text-muted-foreground">
                              Loading service status...
                            </span>
                          </div>
                        </div>
                      ) : (
                        services.map((service, idx) => (
                          <div
                            key={`${service.name}-${idx}`}
                            className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between"
                          >
                            <div className="flex flex-1 items-start gap-4">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/20">
                                <service.icon className="h-6 w-6 text-primary" />
                              </div>
                              <div className="space-y-1">
                                <h3 className="font-semibold">{service.name}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {service.description}
                                </p>
                                {service.instances !== undefined && (
                                  <p className="text-xs text-muted-foreground">
                                    {service.instances} active nodes
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              {/* 90-day availability bar */}
                              {service.statusHistory &&
                                service.statusHistory.length > 0 && (
                                  <div
                                    className="hidden md:flex items-center gap-1.5"
                                    title="90-day availability"
                                  >
                                    <div className="flex gap-px">
                                      {service.statusHistory
                                        .slice(-90)
                                        .map((day, idx) => (
                                          <div
                                            key={idx}
                                            className={`w-1.5 h-5 rounded-sm ${
                                              day.status === "operational"
                                                ? "bg-green-500"
                                                : day.status === "degraded"
                                                ? "bg-yellow-500"
                                                : "bg-red-500"
                                            }`}
                                            title={`${day.day}: ${day.status}${
                                              day.downtimeDuration > 0
                                                ? ` (${formatDuration(day.downtimeDuration)} downtime)`
                                                : ""
                                            }`}
                                          />
                                        ))}
                                    </div>
                                  </div>
                                )}
                              {/* Availability percentage badge */}
                              {service.availability !== undefined && (
                                <div className="text-right">
                                  <div className="text-sm font-semibold">
                                    {getAvailabilityLabel(service.availability)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    availability
                                  </div>
                                </div>
                              )}
                              <StatusDot
                                variant={
                                  service.status === "operational"
                                    ? "running"
                                    : service.status === "degraded"
                                    ? "warning"
                                    : service.status === "maintenance"
                                    ? "loading"
                                    : "error"
                                }
                                label={getStatusLabel(service.status)}
                                showPing={service.status === "operational"}
                                className="md:justify-end"
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </section>
              </motion.div>

              {/* SLA Commitments */}
              <motion.div variants={revealItem}>
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-semibold">SLA Commitments</h2>
                    <Badge variant="outline">Target uptime guarantees</Badge>
                  </div>
                  <div className="grid gap-6 md:grid-cols-3">
                    <Card className="home-feature-card">
                      <CardHeader>
                        <CardTitle className="text-base">VPS Infrastructure</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="text-3xl font-semibold text-green-600 dark:text-green-400">99.9%</div>
                        <p className="text-xs text-muted-foreground">Target uptime for compute resources</p>
                      </CardContent>
                    </Card>
                    <Card className="home-feature-card">
                      <CardHeader>
                        <CardTitle className="text-base">Network Availability</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="text-3xl font-semibold text-green-600 dark:text-green-400">99.95%</div>
                        <p className="text-xs text-muted-foreground">Global network backbone guarantee</p>
                      </CardContent>
                    </Card>
                    <Card className="home-feature-card">
                      <CardHeader>
                        <CardTitle className="text-base">Support Response</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="text-3xl font-semibold text-primary">&lt; 1hr</div>
                        <p className="text-xs text-muted-foreground">Average initial response time</p>
                      </CardContent>
                    </Card>
                  </div>
                </section>
              </motion.div>

              {/* About this page */}
              <motion.div variants={revealItem}>
                <Card className="home-gradient-border-top home-glass-panel">
                  <CardContent className="space-y-4 px-6 py-8">
                    <h3 className="text-lg font-semibold text-foreground">About this page</h3>
                    <p className="text-sm text-muted-foreground leading-6">
                      {bsConfigured
                        ? "Service availability is monitored every 60 seconds via Better Stack probes from multiple global regions. Incidents are reported automatically and supplemented with manual updates from our operations team."
                        : "Monitoring updates every 60 seconds using probes from multiple regions. Major incidents trigger real-time notifications for customers subscribed to alerts."}
                      {" "}For historical reports or compliance requests, contact our support team.
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs uppercase tracking-wide text-muted-foreground/80">
                      <Badge variant="secondary">Real-time metrics</Badge>
                      <Badge variant="secondary">Multi-region checks</Badge>
                      <Badge variant="secondary">Transparent history</Badge>
                      {bsConfigured && <Badge variant="secondary">Better Stack</Badge>}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
