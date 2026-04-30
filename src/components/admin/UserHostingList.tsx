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

interface Subscription {
  id: string;
  organization_name: string;
  domain: string;
  plan_name: string;
  status: "active" | "suspended" | "cancelled";
  next_billing_at: string;
}

export function UserHostingList() {
  const { data, isLoading } = useEnhanceAdminSubscriptions();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actingId, setActingId] = useState<string | null>(null);

  const subscriptions: Subscription[] = data?.subscriptions ?? [];

  const filtered = subscriptions.filter((sub) => {
    if (statusFilter === "all") return true;
    return sub.status === statusFilter;
  });

  const handleSuspend = async (subId: string) => {
    setActingId(subId);
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
    setActingId(subId);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Hosting Subscriptions</h2>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
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
      ) : filtered.length === 0 ? (
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
                <TableHead>Next Billing</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((sub) => (
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
                          disabled={actingId === sub.id}
                          onClick={() => handleSuspend(sub.id)}
                        >
                          {actingId === sub.id ? (
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
                          disabled={actingId === sub.id}
                          onClick={() => handleUnsuspend(sub.id)}
                        >
                          {actingId === sub.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Unsuspend"
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
