import { useState } from "react";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, DollarSign, Receipt } from "lucide-react";
import { AdminHeroCard } from "@/components/admin/AdminHeroCard";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

export function RefundList() {
  const [status, setStatus] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["refunds", status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      params.set("limit", "50");
      const res = await apiClient.get(`/admin/refunds?${params.toString()}`);
      return res as { refunds: any[] };
    },
  });

  const handleProcess = async (id: string) => {
    try {
      const result = await apiClient.post(`/admin/refunds/${id}/process`, {});
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      refetch();
    } catch (error: any) {
      toast.error(error?.message || "Failed to process refund");
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await apiClient.post(`/admin/refunds/${id}/cancel`, {});
      toast.success("Refund cancelled");
      refetch();
    } catch (error: any) {
      toast.error(error?.message || "Failed to cancel refund");
    }
  };

  return (
    <div className="space-y-4">
      <AdminHeroCard
        badge="billing.refunds"
        badgeIcon={Receipt}
        title="Refund Management"
        description="Review and process refund requests from customers"
        decorativeIcon={Receipt}
      />
      <div className="flex items-center gap-2">
        <Input
          placeholder="Filter by status (pending, processing, completed, failed, cancelled)"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-80"
        />
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      <div className="grid gap-3">
        {data?.refunds?.map((refund: any) => (
          <Card key={refund.id}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">
                      {refund.amount} {refund.currency}
                    </span>
                    <Badge
                      variant={
                        refund.status === "completed"
                          ? "default"
                          : refund.status === "failed"
                            ? "destructive"
                            : refund.status === "pending"
                              ? "outline"
                              : "secondary"
                      }
                    >
                      {refund.status}
                    </Badge>
                    <Badge variant="outline">{refund.initiated_by_type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{refund.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    Org: {refund.organization_name} | User: {refund.user_email} |{" "}
                    {new Date(refund.created_at).toLocaleString()}
                  </p>
                  {refund.provider_refund_id && (
                    <p className="text-xs text-muted-foreground">
                      PayPal Refund ID: {refund.provider_refund_id}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {refund.status === "pending" && (
                    <>
                      <Button size="sm" onClick={() => handleProcess(refund.id)}>
                        Process
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleCancel(refund.id)}>
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!isLoading && data?.refunds?.length === 0 && (
        <p className="text-center text-muted-foreground py-12">No refunds found.</p>
      )}
    </div>
  );
}
