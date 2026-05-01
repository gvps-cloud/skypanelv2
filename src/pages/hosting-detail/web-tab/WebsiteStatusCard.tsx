import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Power } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

interface Props {
  subscriptionId: string;
}

export default function WebsiteStatusCard({ subscriptionId }: Props) {
  const [website, setWebsite] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingSuspend, setTogglingSuspend] = useState(false);

  const load = useCallback(async () => {
    if (!subscriptionId) return;
    setLoading(true);
    try {
      const data = await apiClient.get<Record<string, any>>(`/hosting/web/${subscriptionId}/website`);
      setWebsite(data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [subscriptionId]);

  useEffect(() => { load(); }, [load]);

  const isSuspended = website?.status === "disabled" || website?.isSuspended === true;

  const handleToggleSuspend = async () => {
    if (!subscriptionId) return;
    const action = isSuspended ? "unsuspend" : "suspend";
    if (!confirm(`${isSuspended ? "Unsuspend" : "Suspend"} this website?`)) return;
    setTogglingSuspend(true);
    try {
      await apiClient.patch(`/hosting/web/${subscriptionId}/website`, {
        isSuspended: !isSuspended,
      });
      toast.success(`Website ${action === "suspend" ? "suspended" : "unsuspended"}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} website`);
    } finally {
      setTogglingSuspend(false);
    }
  };

  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <div className="px-6 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
              <Power className="h-5 w-5 text-primary" />
              <span>Website Status</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Manage website status and active state.</p>
          </div>
          <div className="flex items-center gap-3">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <>
                <Badge variant={isSuspended ? "destructive" : "default"}>
                  {isSuspended ? "Suspended" : "Active"}
                </Badge>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={!isSuspended}
                    onCheckedChange={handleToggleSuspend}
                    disabled={togglingSuspend}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
