import { useState } from "react";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Shield, Search, Filter } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

export function FraudCheckList() {
  const [status, setStatus] = useState("");
  const [checkType, setCheckType] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["fraud-checks", status, checkType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (checkType) params.set("check_type", checkType);
      params.set("limit", "50");
      const res = await apiClient.get(`/admin/fraud-checks?${params.toString()}`);
      return res as { checks: any[] };
    },
  });

  const handleOverride = async (id: string, action: "allowed" | "blocked") => {
    try {
      await apiClient.post(`/admin/fraud-checks/${id}/override`, {
        action,
        reason: "Admin manual override",
      });
      toast.success(`Fraud check overridden to ${action}`);
      refetch();
    } catch (error: any) {
      toast.error(error?.message || "Failed to override");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Filter by status (approve, review, reject)"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-64"
        />
        <Input
          placeholder="Filter by type"
          value={checkType}
          onChange={(e) => setCheckType(e.target.value)}
          className="w-64"
        />
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <Search className="w-4 h-4" />
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      <div className="grid gap-3">
        {data?.checks?.map((check: any) => (
          <Card key={check.id}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium capitalize">{check.check_type}</span>
                    <Badge
                      variant={
                        check.action_taken === "blocked"
                          ? "destructive"
                          : check.action_taken === "flagged"
                            ? "outline"
                            : "default"
                      }
                    >
                      {check.action_taken}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Score: {check.score} | Status: {check.status}
                    {check.is_vpn && " | VPN"}
                    {check.is_proxy && " | Proxy"}
                    {check.is_tor && " | TOR"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {check.email} | {check.ip_address} | {new Date(check.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOverride(check.id, "allowed")}
                  >
                    Allow
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleOverride(check.id, "blocked")}
                  >
                    Block
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!isLoading && data?.checks?.length === 0 && (
        <p className="text-center text-muted-foreground py-12">No fraud checks found.</p>
      )}
    </div>
  );
}
