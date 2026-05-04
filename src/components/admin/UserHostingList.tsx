import { useState } from "react";
import {
  useEnhanceAdminSubscriptions,
  enhanceAdminKeys,
} from "@/hooks/useEnhanceAdmin";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import Pagination from "@/components/ui/Pagination";

interface Subscription {
  id: string;
  organization_name: string;
  domain: string;
  plan_name: string;
  status: "active" | "suspended" | "cancelled";
  next_billing_at: string;
  price_monthly?: string | number | null;
  hosting_wallet_balance?: string | number | null;
  latest_billing_status?: string | null;
  latest_billing_failure_reason?: string | null;
  latest_invoice_id?: string | null;
}

export function UserHostingList() {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actingId, setActingId] = useState<string | null>(null);

  const { data, isLoading } = useEnhanceAdminSubscriptions({
    page: currentPage,
    limit: itemsPerPage,
    status: statusFilter,
  });
  const queryClient = useQueryClient();

  const subscriptions: Subscription[] = data?.subscriptions ?? [];
  const pagination = data?.pagination;
  const padRowCount = Math.max(0, itemsPerPage - subscriptions.length);
  const isActing = (subId: string) => actingId?.startsWith(`${subId}:`) ?? false;

  const handleSuspend = async (subId: string) => {
    setActingId(`${subId}:suspend`);
    try {
      await apiClient.post(`/admin/enhance/subscriptions/${subId}/suspend`);
      toast.success("Subscription suspended");
      await queryClient.invalidateQueries({
        queryKey: enhanceAdminKeys.subscriptions(),
      });
    } catch (error: any) {
      toast.error(error?.message || "Failed to suspend subscription");
    } finally {
      setActingId(null);
    }
  };

  const handleUnsuspend = async (subId: string) => {
    setActingId(`${subId}:unsuspend`);
    try {
      await apiClient.post(`/admin/enhance/subscriptions/${subId}/unsuspend`);
      toast.success("Subscription unsuspended");
      await queryClient.invalidateQueries({
        queryKey: enhanceAdminKeys.subscriptions(),
      });
    } catch (error: any) {
      toast.error(error?.message || "Failed to unsuspend subscription");
    } finally {
      setActingId(null);
    }
  };

  const handleRetryBilling = async (subId: string) => {
    setActingId(`${subId}:retry`);
    try {
      const response = await apiClient.post<{ invoiceId?: string | null }>(
        `/admin/enhance/subscriptions/${subId}/retry-billing`
      );
      toast.success("Billing retry completed");
      if (response.invoiceId) {
        window.location.href = `/billing/invoice/${response.invoiceId}`;
      }
      await queryClient.invalidateQueries({
        queryKey: enhanceAdminKeys.subscriptions(),
      });
    } catch (error: any) {
      toast.error(error?.message || "Failed to retry billing");
    } finally {
      setActingId(null);
    }
  };

  const handleGenerateInvoice = async (subId: string) => {
    setActingId(`${subId}:invoice`);
    try {
      const response = await apiClient.post<{ invoiceId?: string | null }>(
        `/admin/enhance/subscriptions/${subId}/invoice`
      );
      toast.success("Invoice ready");
      if (response.invoiceId) {
        window.location.href = `/billing/invoice/${response.invoiceId}`;
      }
      await queryClient.invalidateQueries({
        queryKey: enhanceAdminKeys.subscriptions(),
      });
    } catch (error: any) {
      toast.error(error?.message || "Failed to generate invoice");
    } finally {
      setActingId(null);
    }
  };

  const handleCreditRefund = async (sub: Subscription) => {
    const amountText = window.prompt("Hosting wallet credit amount");
    if (!amountText) return;
    const amount = Number(amountText);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a positive refund amount");
      return;
    }
    const reason = window.prompt("Refund reason", "Admin hosting wallet credit refund")
      || "Admin hosting wallet credit refund";

    setActingId(`${sub.id}:refund`);
    try {
      await apiClient.post(`/admin/enhance/subscriptions/${sub.id}/refund`, {
        amount,
        reason,
      });
      toast.success("Hosting wallet credit issued");
      await queryClient.invalidateQueries({
        queryKey: enhanceAdminKeys.subscriptions(),
      });
    } catch (error: any) {
      toast.error(error?.message || "Failed to issue hosting refund");
    } finally {
      setActingId(null);
    }
  };

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "suspended":
        return "secondary";
      case "cancelled":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const billingBadgeVariant = (status: string | null | undefined) => {
    switch (status) {
      case "failed":
        return "destructive";
      case "paid":
      case "refunded":
        return "default";
      case "pending":
        return "secondary";
      default:
        return "outline";
    }
  };

  const formatMoney = (value: string | number | null | undefined) => {
    const amount = typeof value === "number" ? value : Number(value ?? 0);
    return Number.isFinite(amount)
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
      : "—";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Hosting Subscriptions</h2>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : subscriptions.length === 0 ? (
        <div
          className={cn(
            "rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"
          )}
        >
          No subscriptions found.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead>Next Billing</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-medium">
                    {sub.organization_name}
                  </TableCell>
                  <TableCell>{sub.domain}</TableCell>
                  <TableCell>{sub.plan_name}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(sub.status)}>
                      {sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant={billingBadgeVariant(sub.latest_billing_status) as any}>
                        {sub.latest_billing_status || "not billed"}
                      </Badge>
                      {sub.latest_billing_failure_reason && (
                        <div className="max-w-44 truncate text-xs text-destructive">
                          {sub.latest_billing_failure_reason}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatMoney(sub.hosting_wallet_balance)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {sub.next_billing_at
                      ? new Date(sub.next_billing_at).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {sub.status === "active" && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isActing(sub.id)}
                          onClick={() => handleSuspend(sub.id)}
                        >
                          {isActing(sub.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Suspend"
                          )}
                        </Button>
                      )}
                      {sub.status === "suspended" && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isActing(sub.id)}
                          onClick={() => handleUnsuspend(sub.id)}
                        >
                          {isActing(sub.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Unsuspend"
                          )}
                        </Button>
                      )}
                      {(sub.status === "suspended" || sub.latest_billing_status === "failed") && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isActing(sub.id)}
                          onClick={() => handleRetryBilling(sub.id)}
                        >
                          Retry
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isActing(sub.id)}
                        onClick={() => handleGenerateInvoice(sub.id)}
                      >
                        Invoice
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isActing(sub.id)}
                        onClick={() => handleCreditRefund(sub)}
                      >
                        Credit
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {Array.from({ length: padRowCount }).map((_, i) => (
                <TableRow
                  key={`subscription-table-pad-${i}`}
                  aria-hidden
                  className="pointer-events-none hover:bg-transparent"
                >
                  <TableCell className="font-medium">
                    <span className="block">&nbsp;</span>
                  </TableCell>
                  <TableCell>
                    <span className="block">&nbsp;</span>
                  </TableCell>
                  <TableCell>
                    <span className="block">&nbsp;</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="invisible select-none">
                      —
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="invisible select-none">
                      —
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="block">&nbsp;</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="block">&nbsp;</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-block min-h-9 min-w-16">&nbsp;</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pagination && pagination.total > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={pagination.total}
          itemsPerPage={itemsPerPage}
          onPageChange={(page) => {
            setCurrentPage(page);
          }}
          onItemsPerPageChange={(limit) => {
            setItemsPerPage(limit);
            setCurrentPage(1);
          }}
        />
      )}
    </div>
  );
}
