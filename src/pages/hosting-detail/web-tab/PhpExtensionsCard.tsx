import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, X, Cpu } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  subscriptionId: string;
}

export default function PhpExtensionsCard({ subscriptionId }: Props) {
  const [enabled, setEnabled] = useState<string[]>([]);
  const [available, setAvailable] = useState<string[]>([]);
  const [builtIn, setBuiltIn] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!subscriptionId) return;
    setLoading(true);
    try {
      const [en, av, bi] = await Promise.all([
        apiClient.get<{ extensions: string[] }>(`/hosting/web/${subscriptionId}/php/extensions`),
        apiClient.get<{ extensions: string[] }>(`/hosting/web/${subscriptionId}/php/extensions/available`),
        apiClient.get<{ extensions: string[] }>(`/hosting/web/${subscriptionId}/php/extensions/built-in`),
      ]);
      setEnabled(en.extensions ?? []);
      setAvailable(av.extensions ?? []);
      setBuiltIn(bi.extensions ?? []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [subscriptionId]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (name: string, enable: boolean) => {
    setToggling(name);
    try {
      if (enable) {
        await apiClient.post(`/hosting/web/${subscriptionId}/php/extensions/${encodeURIComponent(name)}`);
        toast.success(`Enabled ${name}`);
      } else {
        await apiClient.delete(`/hosting/web/${subscriptionId}/php/extensions/${encodeURIComponent(name)}`);
        toast.success(`Disabled ${name}`);
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${enable ? "enable" : "disable"} ${name}`);
    } finally {
      setToggling(null);
    }
  };

  const configurable = available.filter((e) => !builtIn.includes(e));
  const enabledSet = new Set(enabled);

  return (
    <section className="rounded-2xl cyber-card cyber-card--hover">
      <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
              <Cpu className="h-5 w-5 text-primary" />
              <span>PHP Extensions</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Enable or disable configurable PHP extensions.</p>
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
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Configurable Extensions</h3>
              <div className="flex flex-wrap gap-2">
                {configurable.map((ext) => {
                  const isEnabled = enabledSet.has(ext);
                  const busy = toggling === ext;
                  return (
                    <button
                      key={ext}
                      onClick={() => toggle(ext, !isEnabled)}
                      disabled={busy}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                        isEnabled
                          ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                          : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
                      } ${busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                      {ext}
                      {isEnabled && <X className="h-3 w-3" />}
                    </button>
                  );
                })}
                {configurable.length === 0 && (
                  <p className="text-xs text-muted-foreground">No configurable extensions available.</p>
                )}
              </div>
            </div>
            {builtIn.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Built-in Extensions (read-only)</h3>
                <div className="flex flex-wrap gap-1.5">
                  {builtIn.map((ext) => (
                    <Badge key={ext} variant="secondary" className="text-xs">{ext}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
