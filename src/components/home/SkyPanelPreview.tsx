import { useState } from "react";
import {
  ArrowUpRight,
  Bell,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  Globe2,
  LayoutDashboard,
  Plus,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  Activity,
} from "lucide-react";

import { BRAND_NAME } from "@/lib/brand";

function SkyPanelPreview() {
  const [activeView, setActiveView] = useState("Dashboard");
  const [selectedVps, setSelectedVps] = useState("prod-api-01");
  const [walletBalance, setWalletBalance] = useState(128.4);
  const [activityFeed, setActivityFeed] = useState([
    { message: "VPS prod-api-01 deployed", type: "VPS event", time: "2m ago" },
    {
      message: "Wallet topped up $50.00",
      type: "Billing event",
      time: "1h ago",
    },
    {
      message: "Hosting renewed: atlas-site.io",
      type: "System event",
      time: "3h ago",
    },
  ]);

  const vpsFleet = [
    {
      id: "prod-api-01",
      status: "running",
      plan: "4C/8GB",
      region: "US-East",
      cpu: 34.2,
      cpuCount: 4,
      memory: 62,
    },
    {
      id: "staging-web",
      status: "running",
      plan: "2C/4GB",
      region: "EU-West",
      cpu: 12.8,
      cpuCount: 2,
      memory: 41,
    },
    {
      id: "db-primary",
      status: "running",
      plan: "8C/16GB",
      region: "US-East",
      cpu: 58.7,
      cpuCount: 8,
      memory: 76,
    },
  ];

  const hostingServices = [
    {
      domain: "atlas-site.io",
      status: "active",
      plan: "Business Hosting",
      nextBilling: "May 28",
    },
    {
      domain: "docs.gvps.cloud",
      status: "active",
      plan: "Starter Hosting",
      nextBilling: "Jun 02",
    },
  ];

  const selectedServer =
    vpsFleet.find((server) => server.id === selectedVps) ?? vpsFleet[0];

  const addActivity = (message: string, type = "System event") => {
    setActivityFeed((current) => [
      { message, type, time: "just now" },
      ...current.slice(0, 4),
    ]);
  };

  const quickActions = [
    {
      icon: Plus,
      title: "Launch a VPS",
      description: "Deploy a fresh instance in under a minute.",
      action: () => {
        setActiveView("Compute");
        addActivity("Deployment wizard opened for a new VPS", "VPS event");
      },
    },
    {
      icon: Globe2,
      title: "Create Hosting",
      description: "Launch an Enhance web hosting subscription.",
      action: () => {
        setActiveView("Web Hosting");
        addActivity("Hosting checkout preview opened");
      },
    },
    {
      icon: Wallet,
      title: "Top up wallet",
      description: "Add credits with secure checkout.",
      action: () => {
        setWalletBalance((balance) => Math.round((balance + 25) * 100) / 100);
        setActiveView("Billing");
        addActivity("Wallet preview topped up $25.00", "Billing event");
      },
    },
    {
      icon: ShieldCheck,
      title: "Create support ticket",
      description: "Reach the platform team 24/7.",
      action: () => {
        setActiveView("Activity");
        addActivity("Support ticket draft created", "Support update");
      },
    },
  ];

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard" },
    { icon: Server, label: "Compute" },
    { icon: Globe2, label: "Web Hosting" },
    { icon: Building2, label: "Organizations" },
    { icon: FileText, label: "Notes" },
    { icon: Activity, label: "Activity" },
    { icon: CreditCard, label: "Billing" },
  ];

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-background shadow-2xl shadow-primary/10">
      <div className="flex min-h-[620px]">
        <aside className="hidden w-56 shrink-0 border-r border-border/50 bg-card/90 sm:flex sm:flex-col">
          <div className="flex items-center gap-2.5 border-b border-border/50 px-4 py-3.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/25">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="grid flex-1 text-left leading-tight">
              <span className="truncate text-sm font-semibold">
                {BRAND_NAME}
              </span>
              <span className="truncate text-[10px] text-muted-foreground">
                Cloud Platform
              </span>
            </div>
          </div>

          <nav className="flex-1 space-y-0.5 px-2 py-3">
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setActiveView(item.label)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                  activeView === item.label
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="border-t border-border/50 p-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                MC
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">Storm Moran</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  Admin
                </p>
              </div>
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border/50 px-3 sm:px-4">
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground sm:flex">
                <Search className="h-3 w-3" />
                Search dashboard...
                <kbd className="ml-2 rounded border border-border/60 bg-muted/50 px-1 py-px font-mono text-[9px]">
                  Ctrl K
                </kbd>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => quickActions[0].action()}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/50 bg-muted/20 transition-colors hover:border-primary/40 hover:text-primary"
                aria-label="Launch a VPS"
              >
                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={() => addActivity("Notification center opened")}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/50 bg-muted/20 transition-colors hover:border-primary/40 hover:text-primary"
                aria-label="Open notifications"
              >
                <Bell className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </header>

          <div className="flex-1 space-y-4 overflow-hidden p-3 sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold leading-tight">
                  {activeView}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Dummy client console preview
                </p>
              </div>
              <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
                Interactive preview
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/50 px-2.5 py-1 text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />3 vps
                active
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/50 px-2.5 py-1 text-[11px]">
                <Globe2 className="h-3 w-3 text-muted-foreground" />2 hosting
                active
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/50 px-2.5 py-1 text-[11px]">
                <TrendingUp className="h-3 w-3 text-muted-foreground" />
                Avg CPU 24.3%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {quickActions.map((action) => (
                <button
                  key={action.title}
                  type="button"
                  onClick={action.action}
                  className="group flex min-h-[68px] items-center gap-2 rounded-lg border border-border/50 bg-card/60 p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <action.icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="block truncate text-[11px] font-medium">
                      {action.title}
                    </span>
                    <span className="hidden text-[10px] leading-snug text-muted-foreground md:line-clamp-2">
                      {action.description}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-border/50 bg-card/50">
              <div className="flex items-center justify-between border-b border-border/40 px-3 py-2.5">
                <div>
                  <h3 className="text-[13px] font-semibold">VPS Fleet</h3>
                  <p className="text-[10px] text-muted-foreground">
                    Live signal across your deployments
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] text-primary">
                  Manage all
                  <ArrowUpRight className="h-3 w-3" />
                </span>
              </div>

              <div className="divide-y divide-border/30">
                {vpsFleet.map((vps) => (
                  <button
                    key={vps.id}
                    type="button"
                    onClick={() => {
                      setSelectedVps(vps.id);
                      setActiveView("Compute");
                    }}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/35 ${
                      selectedVps === vps.id ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-semibold">
                          {vps.id}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                          {vps.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {vps.plan} · {vps.region}
                      </p>
                    </div>
                    <div className="w-28 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">
                          CPU ({vps.cpuCount})
                        </span>
                        <span className="font-medium">{vps.cpu}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${vps.cpu}%` }}
                        />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-border/50 bg-card/50 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Wallet className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Wallet Balance
                    </p>
                    <p className="text-lg font-bold">
                      ${walletBalance.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-primary" />
                  Ready to deploy infrastructure
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-card/50 p-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[12px] font-semibold">
                    {activeView === "Web Hosting"
                      ? "Hosting Services"
                      : activeView === "Compute"
                        ? "Selected VPS"
                        : "Recent Activity"}
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveView(
                        activeView === "Activity" ? "Dashboard" : "Activity",
                      )
                    }
                    className="inline-flex items-center gap-1 text-[10px] text-primary"
                  >
                    View all
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                </div>
                {activeView === "Web Hosting" ? (
                  <div className="mt-2 space-y-2">
                    {hostingServices.map((service) => (
                      <button
                        key={service.domain}
                        type="button"
                        onClick={() =>
                          addActivity(
                            `Opened hosting service ${service.domain}`,
                          )
                        }
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/40 bg-background/40 p-2 text-left text-[11px] transition-colors hover:border-primary/40"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {service.domain}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {service.plan} · bills {service.nextBilling}
                          </span>
                        </span>
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">
                          {service.status}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : activeView === "Compute" ? (
                  <div className="mt-2 space-y-2 text-[11px]">
                    <div className="rounded-lg border border-border/40 bg-background/40 p-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{selectedServer.id}</span>
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">
                          {selectedServer.status}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {selectedServer.plan} · {selectedServer.region}
                      </p>
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">Memory</span>
                          <span>{selectedServer.memory}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${selectedServer.memory}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    {activityFeed.slice(0, 3).map((event, i) => (
                      <div
                        key={`${event.message}-${i}`}
                        className="flex items-start gap-2.5 text-[11px]"
                      >
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <div className="min-w-0 flex-1">
                          <span className="text-foreground">
                            {event.message}
                          </span>
                          <span className="ml-1.5 text-[10px] text-muted-foreground">
                            {event.time}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">
                            {event.type}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-border/50" />
    </div>
  );
}

export default SkyPanelPreview;
