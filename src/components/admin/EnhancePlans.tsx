import { useState } from "react";
import { useEnhanceAdminPlans, enhanceAdminKeys } from "@/hooks/useEnhanceAdmin";
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
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface EnhancePlan {
  id: string;
  name: string;
  enhance_plan_id: string;
  service_type: string;
  price_monthly: number;
  is_active: boolean;
}

export function EnhancePlans() {
  const { data, isLoading } = useEnhanceAdminPlans();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const plans: EnhancePlan[] = data?.plans ?? [];

  const handleSync = async () => {
    setSyncing(true);
    try {
      await apiClient.post("/admin/enhance/plans/sync", {});
      toast.success("Plans synced from Enhance");
      await queryClient.invalidateQueries({ queryKey: enhanceAdminKeys.plans() });
    } catch (error: any) {
      toast.error(error?.message || "Failed to sync plans");
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdate = async (
    planId: string,
    payload: Partial<EnhancePlan>
  ) => {
    setSavingId(planId);
    try {
      await apiClient.put(`/admin/enhance/plans/${planId}`, payload);
      toast.success("Plan updated");
      await queryClient.invalidateQueries({ queryKey: enhanceAdminKeys.plans() });
    } catch (error: any) {
      toast.error(error?.message || "Failed to update plan");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Enhance Plans</h2>
        <Button onClick={handleSync} disabled={syncing} size="sm">
          {syncing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sync from Enhance
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : plans.length === 0 ? (
        <div
          className={cn(
            "rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"
          )}
        >
          No plans found. Click "Sync from Enhance" to import plans.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Enhance Plan ID</TableHead>
                <TableHead>Service Type</TableHead>
                <TableHead>Price (monthly)</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {plan.enhance_plan_id}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{plan.service_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        defaultValue={plan.price_monthly}
                        className="w-28"
                        disabled={savingId === plan.id}
                        onBlur={(e) => {
                          const value = parseFloat(e.target.value);
                          if (
                            !Number.isNaN(value) &&
                            value !== plan.price_monthly
                          ) {
                            handleUpdate(plan.id, { price_monthly: value });
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={plan.is_active}
                        disabled={savingId === plan.id}
                        onCheckedChange={(checked) =>
                          handleUpdate(plan.id, { is_active: checked })
                        }
                      />
                      {savingId === plan.id && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
