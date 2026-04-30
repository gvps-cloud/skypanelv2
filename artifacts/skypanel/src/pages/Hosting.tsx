import { useMemo, useState, type AriaAttributes } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  hostingKeys,
  useHostingServices,
  useHostingStatus,
} from "@/hooks/useHosting";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Eye,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

type ServiceStatus =
  | "provisioning"
  | "active"
  | "suspended"
  | "cancelled"
  | "error";

type SortKey = "plan_name" | "domain" | "region" | "status" | "created_at" | "price_monthly";
type SortDir = "asc" | "desc";
type SortState = { key: SortKey; dir: SortDir };

interface HostingServiceRow {
  id: string;
  domain: string | null;
  status: ServiceStatus;
  primary_ip: string | null;
  next_billing_at: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  server_group_id: string | null;
  region_name: string | null;
  plan_id: string;
  plan_name: string;
  service_type: string | null;
  price_monthly: string | number | null;
  is_auto_domain: boolean;
}

type FilterKey = "active" | "suspended" | "cancelled" | "all";

const FILTERS: { key: FilterKey; label: string; matches: (s: ServiceStatus) => boolean }[] = [
  {
    key: "active",
    label: "Active",
    // Customers think "active" includes anything currently running or being set up
    matches: (s) => s === "active" || s === "provisioning" || s === "error",
  },
  { key: "suspended", label: "Suspended", matches: (s) => s === "suspended" },
  { key: "cancelled", label: "Cancelled", matches: (s) => s === "cancelled" },
  { key: "all", label: "All", matches: () => true },
];

function isFilterKey(value: string | null): value is FilterKey {
  return value === "active" || value === "suspended" || value === "cancelled" || value === "all";
}

function formatPrice(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (!isFinite(n)) return "—";
  return `$${n.toFixed(2)}/mo`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ status, cancelledAt }: { status: ServiceStatus; cancelledAt: string | null }) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
  let label: string = status;
  let className = "";

  switch (status) {
    case "active":
      variant = "default";
      label = "Active";
      className = "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30";
      break;
    case "provisioning":
      variant = "outline";
      label = "Provisioning";
      className = "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30";
      break;
    case "suspended":
      variant = "outline";
      label = "Suspended";
      className = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
      break;
    case "cancelled":
      variant = "secondary";
      label = "Cancelled";
      className = "bg-muted text-muted-foreground border border-border";
      break;
    case "error":
      variant = "destructive";
      label = "Error";
      break;
  }

  const badge = (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );

  if (status === "cancelled" && cancelledAt) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help">{badge}</span>
          </TooltipTrigger>
          <TooltipContent>Cancelled on {formatDate(cancelledAt)}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}

function DomainCell({ service }: { service: HostingServiceRow }) {
  if (service.is_auto_domain) {
    // Hide the auto-allocated staging slug entirely on the list page; the
    // actual hostname is still available on the detail page.
    return (
      <div className="flex items-center gap-1.5 font-medium text-muted-foreground italic">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Auto-assigned subdomain</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <span className="font-medium text-foreground truncate max-w-[260px]" title={service.domain ?? ""}>
        {service.domain ?? "—"}
      </span>
      {service.primary_ip ? (
        <span className="text-xs text-muted-foreground">{service.primary_ip}</span>
      ) : null}
    </div>
  );
}

function SortableHead({
  sortKey,
  label,
  sort,
  onToggle,
  className,
  align,
}: {
  sortKey: SortKey;
  label: string;
  sort: SortState;
  onToggle: (key: SortKey) => void;
  className?: string;
  align?: "left" | "right";
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  const ariaSort: AriaAttributes["aria-sort"] = !active
    ? "none"
    : sort.dir === "asc"
      ? "ascending"
      : "descending";

  return (
    <TableHead className={className} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        className={`group inline-flex items-center gap-1 -m-2 p-2 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          align === "right" ? "ml-auto" : ""
        } ${active ? "text-foreground" : "text-muted-foreground"}`}
      >
        <span>{label}</span>
        <Icon
          className={`h-3.5 w-3.5 transition-opacity ${
            active ? "opacity-100" : "opacity-40 group-hover:opacity-80"
          }`}
          aria-hidden="true"
        />
      </button>
    </TableHead>
  );
}

export default function Hosting() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: statusData } = useHostingStatus();
  const {
    data: servicesData,
    isLoading: servicesLoading,
    isError: servicesError,
    error: servicesErrorObj,
    refetch: refetchServices,
    isRefetching,
  } = useHostingServices();

  const services = (servicesData?.services as HostingServiceRow[] | undefined) ?? [];

  // Active filter from URL (?status=...) — defaults to "active"
  const urlStatus = searchParams.get("status");
  const activeFilter: FilterKey = isFilterKey(urlStatus) ? urlStatus : "active";

  const setActiveFilter = (next: FilterKey) => {
    const params = new URLSearchParams(searchParams);
    if (next === "active") {
      params.delete("status");
    } else {
      params.set("status", next);
    }
    setSearchParams(params, { replace: true });
  };

  const counts = useMemo(() => {
    const result: Record<FilterKey, number> = {
      active: 0,
      suspended: 0,
      cancelled: 0,
      all: services.length,
    };
    for (const svc of services) {
      for (const filter of FILTERS) {
        if (filter.key === "all") continue;
        if (filter.matches(svc.status)) {
          result[filter.key] += 1;
        }
      }
    }
    return result;
  }, [services]);

  // ── Sorting ────────────────────────────────────────────────────────────
  const [sort, setSort] = useState<SortState>({
    key: "created_at",
    dir: "desc",
  });

  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "created_at" || key === "price_monthly" ? "desc" : "asc" }
    );
  };

  const sortValue = (svc: HostingServiceRow, key: SortKey): string | number => {
    switch (key) {
      case "plan_name":
        return (svc.plan_name ?? "").toLowerCase();
      case "domain":
        // Auto-assigned rows sort together at the bottom (alphabetically last)
        return svc.is_auto_domain ? "\uffff" : (svc.domain ?? "").toLowerCase();
      case "region":
        // Unknown regions sort to the end
        return (svc.region_name ?? "\uffff").toLowerCase();
      case "status":
        return svc.status;
      case "created_at":
        return new Date(svc.created_at).getTime() || 0;
      case "price_monthly": {
        const v = svc.price_monthly;
        const n = typeof v === "string" ? parseFloat(v) : v ?? 0;
        return isFinite(n as number) ? (n as number) : 0;
      }
    }
  };

  const visibleServices = useMemo(() => {
    const filter = FILTERS.find((f) => f.key === activeFilter) ?? FILTERS[0];
    const filtered = services.filter((svc) => filter.matches(svc.status));
    const sorted = [...filtered].sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [services, activeFilter, sort]);

  const [pendingCancel, setPendingCancel] = useState<HostingServiceRow | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleConfirmCancel = async () => {
    if (!pendingCancel) return;
    const target = pendingCancel;
    setCancellingId(target.id);
    try {
      await apiClient.post(`/hosting/services/${target.id}/cancel`, {});
      toast.success("Hosting subscription cancelled");
      await queryClient.invalidateQueries({ queryKey: hostingKeys.services() });
      // If the user was filtered to Active, switch them to Cancelled so they can see the result.
      if (activeFilter === "active") {
        setActiveFilter("cancelled");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to cancel subscription");
    } finally {
      setCancellingId(null);
      setPendingCancel(null);
    }
  };

  if (!statusData?.enabled) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-4">Web Hosting</h1>
        <p className="text-muted-foreground">Web hosting is not currently available.</p>
      </div>
    );
  }

  const filteredEmptyMessage: Record<FilterKey, { title: string; subtitle: string; cta: boolean }> = {
    active: {
      title: "No active subscriptions",
      subtitle: "Purchase a plan to get started with web hosting.",
      cta: true,
    },
    suspended: {
      title: "No suspended subscriptions",
      subtitle: "Subscriptions appear here when billing fails or they're paused.",
      cta: false,
    },
    cancelled: {
      title: "No cancelled subscriptions",
      subtitle: "Cancelled subscriptions will appear here for your records.",
      cta: false,
    },
    all: {
      title: "No hosting subscriptions yet",
      subtitle: "Get started by purchasing your first hosting plan.",
      cta: true,
    },
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Web Hosting</h1>
          <p className="text-sm text-muted-foreground">
            Manage your web hosting subscriptions, domains, and services.
          </p>
        </div>
        <Button onClick={() => navigate("/hosting/store")}>
          <Plus className="w-4 h-4 mr-2" />
          New Subscription
        </Button>
      </div>

      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={activeFilter}
          onValueChange={(value) => isFilterKey(value) && setActiveFilter(value)}
        >
          <TabsList>
            {FILTERS.map((filter) => (
              <TabsTrigger key={filter.key} value={filter.key} className="group gap-2">
                <span>{filter.label}</span>
                <span className="inline-flex items-center justify-center rounded-full bg-background/60 text-xs font-medium px-1.5 min-w-[1.25rem] h-5 text-muted-foreground group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary">
                  {counts[filter.key]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetchServices()}
          disabled={isRefetching}
          className="self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead className="w-[22%]" sortKey="plan_name" label="Plan" sort={sort} onToggle={toggleSort} />
                <SortableHead className="w-[24%]" sortKey="domain" label="Domain" sort={sort} onToggle={toggleSort} />
                <SortableHead className="w-[14%]" sortKey="region" label="Region" sort={sort} onToggle={toggleSort} />
                <SortableHead className="w-[10%]" sortKey="status" label="Status" sort={sort} onToggle={toggleSort} />
                <SortableHead className="w-[12%]" sortKey="created_at" label="Created" sort={sort} onToggle={toggleSort} />
                <SortableHead className="w-[10%]" sortKey="price_monthly" label="Price" sort={sort} onToggle={toggleSort} />
                <TableHead className="w-[8%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {servicesLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : servicesError ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12">
                    <div className="flex flex-col items-center text-center gap-3">
                      <AlertCircle className="w-8 h-8 text-destructive" />
                      <div>
                        <p className="font-medium">Failed to load subscriptions</p>
                        <p className="text-sm text-muted-foreground">
                          {(servicesErrorObj as Error)?.message || "Something went wrong."}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => refetchServices()}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Retry
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : visibleServices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12">
                    <div className="flex flex-col items-center text-center gap-3">
                      <Globe className="w-10 h-10 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{filteredEmptyMessage[activeFilter].title}</p>
                        <p className="text-sm text-muted-foreground">
                          {filteredEmptyMessage[activeFilter].subtitle}
                        </p>
                      </div>
                      {filteredEmptyMessage[activeFilter].cta ? (
                        <Button onClick={() => navigate("/hosting/store")}>
                          Browse Plans
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                visibleServices.map((service) => {
                  const isCancelled = service.status === "cancelled";
                  const open = () => navigate(`/hosting/${service.id}`);
                  return (
                    <TableRow
                      key={service.id}
                      role="link"
                      tabIndex={0}
                      aria-label={`Open hosting subscription ${service.plan_name}`}
                      className="cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/60"
                      onClick={open}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          open();
                        }
                      }}
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{service.plan_name}</span>
                          {service.service_type ? (
                            <span className="text-xs text-muted-foreground capitalize">
                              {service.service_type.replace(/[-_]/g, " ")}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DomainCell service={service} />
                      </TableCell>
                      <TableCell className="text-sm">
                        {service.region_name ? (
                          <span className="text-foreground">{service.region_name}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={service.status} cancelledAt={service.cancelled_at} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(service.created_at)}
                      </TableCell>
                      <TableCell className="text-sm">{formatPrice(service.price_monthly)}</TableCell>
                      <TableCell className="text-right">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={open}
                            aria-label={`Manage ${service.plan_name}`}
                            title="Manage"
                          >
                            <Eye className="w-4 h-4" aria-hidden="true" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={isCancelled || cancellingId === service.id}
                            onClick={() => setPendingCancel(service)}
                            aria-label={`Cancel ${service.plan_name}`}
                          >
                            {cancellingId === service.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                            ) : (
                              "Cancel"
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog
        open={!!pendingCancel}
        onOpenChange={(open) => {
          if (!open && cancellingId === null) setPendingCancel(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel hosting subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingCancel?.is_auto_domain ? (
                <>
                  This will cancel your <strong>{pendingCancel?.plan_name}</strong> subscription on
                  the auto-assigned subdomain. Your website data will be permanently removed.
                </>
              ) : (
                <>
                  This will cancel your <strong>{pendingCancel?.plan_name}</strong> subscription for{" "}
                  <strong>{pendingCancel?.domain}</strong>. Your website data will be permanently
                  removed.
                </>
              )}
              <br />
              <br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancellingId !== null}>Keep subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmCancel();
              }}
              disabled={cancellingId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancellingId !== null ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cancelling…
                </>
              ) : (
                "Cancel subscription"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
