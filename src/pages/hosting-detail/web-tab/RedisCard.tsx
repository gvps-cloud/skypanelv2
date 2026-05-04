import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Database, Loader2, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface RedisOperation {
  method: string;
  operationId: string;
  enhancePath: string;
}

interface RedisState {
  enabled: boolean;
  allowed: boolean | null;
  status: "available" | "not_in_plan" | "unavailable";
  operations: RedisOperation[];
}

interface Props {
  subscriptionId: string;
}

const FALLBACK_OPERATIONS: RedisOperation[] = [
  { method: "GET", operationId: "getWebsiteRedisState", enhancePath: "/v2/websites/{website_id}/redis" },
  { method: "PUT", operationId: "setWebsiteRedisState", enhancePath: "/v2/websites/{website_id}/redis" },
];

function statusLabel(state: RedisState | null) {
  if (!state) return "Unknown";
  if (state.status === "not_in_plan") return "Not included in this plan";
  if (state.status === "unavailable") return "Unavailable";
  return state.enabled ? "Enabled" : "Disabled";
}

function planEligibilityLabel(state: RedisState | null) {
  if (state?.allowed === false) return "Plan gated";
  if (state?.allowed === true) return "Plan eligible";
  return "Plan eligibility unknown";
}

export default function RedisCard({ subscriptionId }: Props) {
  const [state, setState] = useState<RedisState | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    if (!subscriptionId) return;
    setLoading(true);
    try {
      const data = await apiClient.get<RedisState>(`/hosting/web/${subscriptionId}/redis`);
      setState({
        enabled: Boolean(data?.enabled),
        allowed: typeof data?.allowed === "boolean" ? data.allowed : null,
        status: data?.status ?? "unavailable",
        operations: Array.isArray(data?.operations) && data.operations.length > 0 ? data.operations : FALLBACK_OPERATIONS,
      });
    } catch {
      setState({ enabled: false, allowed: null, status: "unavailable", operations: FALLBACK_OPERATIONS });
    } finally {
      setLoading(false);
    }
  }, [subscriptionId]);

  useEffect(() => { load(); }, [load]);

  const toggle = async () => {
    if (!state || state.allowed === false || state.status !== "available") return;
    setToggling(true);
    try {
      const nextEnabled = !state.enabled;
      const data = await apiClient.put<Partial<RedisState>>(`/hosting/web/${subscriptionId}/redis`, { enabled: nextEnabled });
      setState((current) => ({
        enabled: Boolean(data?.enabled ?? nextEnabled),
        allowed: typeof data?.allowed === "boolean" ? data.allowed : current?.allowed ?? null,
        status: data?.status ?? "available",
        operations: Array.isArray(data?.operations) && data.operations.length > 0 ? data.operations : current?.operations ?? FALLBACK_OPERATIONS,
      }));
      toast.success(`Redis ${nextEnabled ? "enabled" : "disabled"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle Redis");
    } finally {
      setToggling(false);
    }
  };

  const operations = state?.operations ?? FALLBACK_OPERATIONS;
  const redisCanToggle = Boolean(state && state.allowed !== false && state.status === "available");

  return (
    <section className="rounded-2xl cyber-card cyber-card--hover">
      <div className="border-b border-border px-6 py-4 sm:px-8 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground sm:text-lg">
              <Database className="h-5 w-5 text-primary" />
              <span>Redis</span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Enhance documents Redis as a website-level enable/disable state; no Redis config editor is exposed in the API spec.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-3 w-3 mr-1.5", loading && "animate-spin")} />Refresh
          </Button>
        </div>
      </div>
      <div className="px-6 py-5 sm:px-8 sm:py-6">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">Redis State</Label>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={state?.status === "available" && state.enabled ? "default" : "secondary"}>
                    {statusLabel(state)}
                  </Badge>
                  <Badge variant={state?.allowed === false ? "secondary" : "outline"}>
                    {planEligibilityLabel(state)}
                  </Badge>
                </div>
                {state?.allowed === false ? (
                  <p className="text-xs text-muted-foreground">
                    Enhance reports `canUse.redis` as false for this website, so Redis controls are disabled.
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border p-4">
                <Label className="text-sm font-medium">Enable Redis</Label>
                <Switch checked={Boolean(state?.enabled)} onCheckedChange={toggle} disabled={!redisCanToggle || toggling} />
              </div>
            </div>
            <div className="rounded-lg border border-border p-4">
              <h3 className="text-sm font-medium">Enhance API Coverage</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                The Enhance spec only documents these boolean Redis state operations for websites.
              </p>
              <div className="mt-3 grid gap-2">
                {operations.map((operation) => (
                  <div key={`${operation.method}-${operation.operationId}`} className="flex flex-col gap-1 rounded-md bg-muted/40 p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{operation.method}</Badge>
                      <span className="font-medium">{operation.operationId}</span>
                    </div>
                    <code className="text-muted-foreground">{operation.enhancePath}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
