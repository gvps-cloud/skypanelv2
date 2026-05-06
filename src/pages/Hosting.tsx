import { useState } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { useHostingServices, useHostingStatus, hostingKeys } from "@/hooks/useHosting";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Globe, Plus, ArrowRight, Search, LayoutDashboard, CreditCard, Server, ExternalLink, LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { formatBillingAmount } from "@/lib/formatters";
import Pagination from "@/components/ui/Pagination";
import { TerminalPageHeader } from "@/components/terminal";

interface HostingService {
  id: string;
  domain: string | null;
  status: "active" | "suspended" | "cancelled" | "error" | "provisioning";
  primary_ip: string | null;
  next_billing_at: string | null;
  created_at: string;
  cancelled_at: string | null;
  plan_id: string | null;
  plan_name: string | null;
  service_type: string | null;
  price_monthly: number | null;
  enhance_plan_id: string | null;
}

const statusBadgeVariant = (status: string) => {
  switch (status) {
    case "active":
      return "default";
    case "suspended":
      return "secondary";
    case "cancelled":
      return "destructive";
    case "error":
      return "destructive";
    case "provisioning":
      return "outline";
    default:
      return "secondary";
  }
};

export default function Hosting() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: statusData } = useHostingStatus();
  const { data: servicesData, isLoading: servicesLoading } = useHostingServices();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const services: HostingService[] = servicesData?.services ?? [];

  const filtered = services.filter((service) => {
    const matchesStatus = statusFilter === "all" || service.status === statusFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (service.domain ?? "").toLowerCase().includes(q) ||
      (service.plan_name ?? "").toLowerCase().includes(q) ||
      (service.primary_ip ?? "").toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const pageItems = filtered.slice(startIndex, startIndex + itemsPerPage);

  const activeCount = services.filter((s) => s.status === "active").length;
  const totalMonthly = services
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + (parseFloat(String(s.price_monthly)) || 0), 0);

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      await apiClient.post(`/hosting/services/${id}/cancel`, {});
      toast.success("Hosting subscription cancelled. A prorated refund for unused days has been credited to your wallet.");
      await queryClient.invalidateQueries({ queryKey: hostingKeys.services() });
    } catch (error: any) {
      toast.error(error?.message || "Failed to cancel subscription");
    } finally {
      setCancellingId(null);
    }
  };

  const handleSso = async () => {
    setSsoLoading(true);
    try {
      const data = await apiClient.post<{ url: string }>("/hosting/sso", {});
      if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to open hosting panel");
    } finally {
      setSsoLoading(false);
    }
  };

  const handleRequestReactivation = (service: HostingService) => {
    const description = [
      `I would like to request reactivation of my cancelled hosting subscription.`,
      ``,
      `**Domain:** ${service.domain || "N/A"}`,
      `**Plan:** ${service.plan_name || "Unknown"}`,
      `**Subscription ID:** ${service.id}`,
      `**Enhance Plan ID:** ${service.enhance_plan_id || "N/A"}`,
      `**Cancelled on:** ${service.cancelled_at ? new Date(service.cancelled_at).toLocaleDateString() : "N/A"}`,
      ``,
      `Please restore this hosting subscription so I can continue using my website.`,
    ].join("\n");

    navigate(`/support?create=1&subject=${encodeURIComponent("Hosting Reactivation Request")}&description=${encodeURIComponent(description)}&category=technical&hostingSubscriptionId=${encodeURIComponent(service.id)}`);
  };

  if (!statusData?.enabled) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-4">Web Hosting</h1>
        <p className="text-muted-foreground">Web hosting is not currently available.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6 font-mono">
      <TerminalPageHeader pathPrefix="~/hosting" command="services --list" />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Web Hosting</h1>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <Button variant="outline" onClick={handleSso} disabled={ssoLoading}>
              {ssoLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4 mr-2" />
              )}
              Open Panel
            </Button>
          )}
          <Button onClick={() => navigate("/hosting/store")}>
            <Plus className="w-4 h-4 mr-2" />
            New Subscription
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4 flex items-center gap-4">
          <div className="rounded-full bg-primary/10 p-3">
            <Server className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Active Subscriptions</p>
            <p className="text-2xl font-bold">{activeCount}</p>
          </div>
        </div>
        <div className="rounded-lg border p-4 flex items-center gap-4">
          <div className="rounded-full bg-primary/10 p-3">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Monthly Spend</p>
            <p className="text-2xl font-bold">{formatBillingAmount(totalMonthly)}</p>
          </div>
        </div>
        <div className="rounded-lg border p-4 flex items-center gap-4">
          <div className="rounded-full bg-primary/10 p-3">
            <LayoutDashboard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Subscriptions</p>
            <p className="text-2xl font-bold">{services.length}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search domain, plan, or IP..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["active", "all", "suspended", "provisioning", "error", "cancelled"] as const).map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setStatusFilter(s);
                setCurrentPage(1);
              }}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {servicesLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Globe className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No hosting subscriptions found</h3>
          <p className="text-muted-foreground mb-4">
            {services.length === 0
              ? "Get started by purchasing your first hosting plan."
              : "No subscriptions match your filters."}
          </p>
          {services.length === 0 && (
            <Button onClick={() => navigate("/hosting/store")}>
              Browse Plans
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      ) : (
        <ScrollArea className="w-full whitespace-nowrap rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Primary IP</TableHead>
                <TableHead>Next Billing</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((service) => {
                const isActive = service.status === "active";
                return (
                  <TableRow
                    key={service.id}
                    className={isActive ? "cursor-pointer" : "opacity-60"}
                    onClick={() => {
                      if (isActive) navigate(`/hosting/${service.id}`);
                    }}
                  >
                    <TableCell className="font-medium">
                      {service.domain ?? (
                        <span className="text-muted-foreground italic">No domain</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {service.plan_name ?? (
                        <span className="text-muted-foreground italic">Unknown plan</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(service.status)}>
                        {service.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {service.primary_ip ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {service.next_billing_at
                        ? new Date(service.next_billing_at).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(service.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isActive ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/hosting/${service.id}`);
                              }}
                            >
                              Manage
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive hover:text-destructive"
                                  onClick={(e) => e.stopPropagation()}
                                  disabled={cancellingId === service.id}
                                >
                                  {cancellingId === service.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    "Cancel"
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will cancel the hosting subscription for{" "}
                                    <strong>{service.domain ?? "this site"}</strong>. The website
                                    will be removed and billing will stop. You will receive a prorated
                                    refund for unused days credited to your wallet. If you change your
                                    mind later, you can request reactivation via a support ticket.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Keep subscription</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleCancel(service.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Cancel subscription
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRequestReactivation(service);
                            }}
                          >
                            <LifeBuoy className="w-4 h-4 mr-1" />
                            Request Reactivation
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
          <Pagination
            currentPage={safePage}
            totalItems={filtered.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            showItemsPerPage={false}
          />
        </ScrollArea>
      )}
    </div>
  );
}
