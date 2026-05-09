import { useState } from "react";
import { useEnhanceAdminPlans, enhanceAdminKeys } from "@/hooks/useEnhanceAdmin";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCapacity } from "@/lib/hostingPlanFeatures";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
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

interface PlanFeatures {
  planType?: string;
  resources?: Record<string, { total?: number }>;
  allowances?: string[];
  selections?: Record<string, string>;
  subscriptionsCount?: number;
  allowedPhpVersions?: string[];
  defaultPhpVersion?: string | null;
  redisAllowed?: boolean;
  persistentAppsAllowed?: boolean;
}

interface EnhancePlan {
  id: string;
  name: string;
  enhance_plan_id: string;
  service_type: string;
  price_monthly: number;
  is_active: boolean;
  features?: PlanFeatures;
}

export function EnhancePlans() {
  const { data, isLoading } = useEnhanceAdminPlans();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [purgingOrphans, setPurgingOrphans] = useState(false);

  const plans: EnhancePlan[] = data?.plans ?? [];

  /** Build a short human-readable summary of the plan's resource limits */
  const resourceSummary = (features?: PlanFeatures): string => {
    if (!features?.resources || Object.keys(features.resources).length === 0) {
      return "No resource data";
    }
    const parts: string[] = [];
    const r = features.resources;
    if (r.websites) parts.push(`${r.websites.total ?? "∞"} sites`);
    if (r.diskspace) parts.push(`${formatCapacity(r.diskspace.total ?? null)} disk`);
    if (r.mailboxes) parts.push(`${r.mailboxes.total ?? "∞"} mail`);
    if (r.mysqlDbs) parts.push(`${r.mysqlDbs.total ?? "∞"} DBs`);
    if (r.transfer) parts.push(`${formatCapacity(r.transfer.total ?? null)} transfer`);
    if (r.ftpUsers) parts.push(`${r.ftpUsers.total ?? "∞"} FTP`);
    if (r.customers) parts.push(`${r.customers.total ?? "∞"} cust`);
    // If we didn't match any known keys, show a count
    if (parts.length === 0) {
      parts.push(`${Object.keys(r).length} resources`);
    }
    return parts.join(", ");
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result: any = await apiClient.post("/admin/enhance/plans/sync", {});
      if (result?.warning) {
        toast.warning(result.warning);
      } else {
        toast.success(`Synced ${result?.synced ?? 0} plans from Enhance`);
      }
      await queryClient.invalidateQueries({ queryKey: enhanceAdminKeys.plans() });
    } catch (error: any) {
      toast.error(error?.message || "Failed to sync plans");
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (planId: string) => {
    setDeletingId(planId);
    try {
      await apiClient.delete(`/admin/enhance/plans/${planId}`);
      toast.success("Plan deleted");
      await queryClient.invalidateQueries({ queryKey: enhanceAdminKeys.plans() });
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete plan");
    } finally {
      setDeletingId(null);
    }
  };

  const handlePurgeInactive = async () => {
    setPurgingOrphans(true);
    try {
      const result: any = await apiClient.delete("/admin/enhance/plans/purge-orphans");
      const count = result?.deleted ?? 0;
      toast.success(`Removed ${count} inactive plan${count !== 1 ? "s" : ""}`);
      await queryClient.invalidateQueries({ queryKey: enhanceAdminKeys.plans() });
    } catch (error: any) {
      toast.error(error?.message || "Failed to purge inactive plans");
    } finally {
      setPurgingOrphans(false);
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
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={purgingOrphans}>
                {purgingOrphans ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Purge Inactive
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Purge inactive plans?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all inactive plans and orphaned plans that have no active subscriptions. Plans with active subscriptions will not be removed. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handlePurgeInactive} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete inactive
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={handleSync} disabled={syncing} size="sm">
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sync from Enhance
          </Button>
        </div>
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
                <TableHead>Plan Type</TableHead>
                <TableHead>Resources</TableHead>
                <TableHead>Price (monthly)</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{plan.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ID: {plan.enhance_plan_id}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary">
                        {plan.features?.planType || plan.service_type}
                      </Badge>
                      {plan.features?.redisAllowed && (
                        <Badge variant="outline" className="text-xs">
                          Redis
                        </Badge>
                      )}
                      {plan.features?.persistentAppsAllowed && (
                        <Badge variant="outline" className="text-xs">
                          Persistent
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help text-sm text-muted-foreground">
                            {resourceSummary(plan.features)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          <div className="space-y-1 text-xs">
                            {plan.features?.resources && Object.entries(plan.features.resources).map(([key, val]) => (
                              <div key={key} className="flex justify-between gap-4">
                                <span>{key}</span>
                                <span className="font-mono">{val.total ?? "unlimited"}</span>
                              </div>
                            ))}
                            {plan.features?.defaultPhpVersion && (
                              <div className="mt-1 border-t pt-1">
                                PHP {plan.features.defaultPhpVersion}
                                {plan.features.allowedPhpVersions && plan.features.allowedPhpVersions.length > 1 && (
                                  <span className="text-muted-foreground">
                                    {" "}(also: {plan.features.allowedPhpVersions.filter(v => v !== plan.features?.defaultPhpVersion).join(", ")})
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          disabled={deletingId === plan.id}
                        >
                          {deletingId === plan.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{plan.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently removes the plan from the local catalog. Plans with active subscriptions cannot be deleted.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(plan.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
