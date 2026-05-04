import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, Shield } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Props {
  subscriptionId: string;
}

export default function IoncubeRedisCard({ subscriptionId }: Props) {
  const [ioncube, setIoncube] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    if (!subscriptionId) return;
    setLoading(true);
    try {
      const ic = await apiClient.get<{ enabled: boolean }>(`/hosting/web/${subscriptionId}/ioncube`).catch(() => ({ enabled: false }));
      setIoncube(ic.enabled);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [subscriptionId]);

  useEffect(() => { load(); }, [load]);

  const toggleIoncube = async () => {
    setToggling(true);
    try {
      const newVal = !ioncube;
      await apiClient.put(`/hosting/web/${subscriptionId}/ioncube`, { enabled: newVal });
      setIoncube(newVal);
      toast.success(`Ioncube ${newVal ? "enabled" : "disabled"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle ioncube");
    } finally {
      setToggling(false);
    }
  };

  return (
    <section className="rounded-2xl cyber-card cyber-card--hover">
      <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
              <Shield className="h-5 w-5 text-primary" />
              <span>Ioncube Loader</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Enable or disable Ioncube loader for this website.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-3 w-3 mr-1.5", loading && "animate-spin")} />Refresh
          </Button>
        </div>
      </div>
      <div className="px-6 sm:px-8 py-5 sm:py-6">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label className="text-sm font-medium">Ioncube Loader</Label>
                  <p className="text-xs text-muted-foreground">PHP extension loader for encoded files</p>
                </div>
              </div>
              <Switch
                checked={ioncube}
                onCheckedChange={toggleIoncube}
                disabled={toggling}
              />
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
