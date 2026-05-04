import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Gauge, Loader2, RefreshCw, Save } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  subscriptionId: string;
}

export default function LsphpSettingsCard({ subscriptionId }: Props) {
  const [lsapiChildren, setLsapiChildren] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!subscriptionId) return;
    setLoading(true);
    try {
      const data = await apiClient.get<{ lsapiChildren?: number | string }>(`/hosting/web/${subscriptionId}/php`);
      setLsapiChildren(data?.lsapiChildren == null ? "" : String(data.lsapiChildren));
    } catch {
      setLsapiChildren("");
    } finally {
      setLoading(false);
    }
  }, [subscriptionId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const parsedChildren = Number(lsapiChildren);
    if (!Number.isFinite(parsedChildren) || parsedChildren < 0) {
      toast.error("LSPHP children must be a positive number");
      return;
    }

    setSaving(true);
    try {
      await apiClient.put(`/hosting/web/${subscriptionId}/php`, { lsapiChildren: parsedChildren });
      toast.success("LSPHP settings saved");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save LSPHP settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl cyber-card cyber-card--hover">
      <div className="border-b border-border px-6 py-4 sm:px-8 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground sm:text-lg">
              <Gauge className="h-5 w-5 text-primary" />
              <span>LSPHP Settings</span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Manage the Enhance LSPHP setting documented for LiteSpeed and OpenLiteSpeed websites.
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
          <div className="flex flex-col gap-4">
            <div className="max-w-sm flex flex-col gap-2">
              <Label htmlFor="lsapi-children">LSAPI children</Label>
              <Input
                id="lsapi-children"
                type="number"
                min="0"
                value={lsapiChildren}
                onChange={(event) => setLsapiChildren(event.target.value)}
                placeholder="10"
              />
              <p className="text-xs text-muted-foreground">Enhance schema field: lsapiChildren.</p>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={save} disabled={saving || !lsapiChildren.trim()}>
                {saving ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Save className="h-3 w-3 mr-1.5" />}
                Save LSPHP Settings
              </Button>
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
