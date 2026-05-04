import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type RuleKind = "allow" | "block";

interface Props {
  subscriptionId: string;
}

function normalizeRuleKind(kind: unknown): RuleKind {
  return kind === "allow" ? "allow" : "block";
}

function parseIps(value: string) {
  return value
    .split(/[\s,]+/)
    .map((ip) => ip.trim())
    .filter(Boolean);
}

export default function HtaccessIpRulesCard({ subscriptionId }: Props) {
  const [kind, setKind] = useState<RuleKind>("block");
  const [ipsText, setIpsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!subscriptionId) return;
    setLoading(true);
    try {
      const data = await apiClient.get<{ kind?: RuleKind | null; ips?: string[] }>(`/hosting/web/${subscriptionId}/htaccess/ips`);
      setKind(normalizeRuleKind(data?.kind));
      setIpsText((data?.ips ?? []).join("\n"));
    } catch {
      setKind("block");
      setIpsText("");
    } finally {
      setLoading(false);
    }
  }, [subscriptionId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.put(`/hosting/web/${subscriptionId}/htaccess/ips`, {
        kind,
        ips: parseIps(ipsText),
      });
      toast.success(".htaccess IP rules saved");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save IP rules");
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
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span>.htaccess IP Rules</span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Manage documented Apache-compatible Require ip allow or block rules.
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
            <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
              <div className="flex flex-col gap-2">
                <Label htmlFor="htaccess-ip-kind">Rule</Label>
                <Select value={kind} onValueChange={(value) => setKind(normalizeRuleKind(value))}>
                  <SelectTrigger id="htaccess-ip-kind">
                    <SelectValue placeholder="Select rule" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="block">Block listed IPs</SelectItem>
                    <SelectItem value="allow">Allow only listed IPs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="htaccess-ips">IP addresses</Label>
                <Textarea
                  id="htaccess-ips"
                  value={ipsText}
                  onChange={(event) => setIpsText(event.target.value)}
                  placeholder="192.0.2.10\n2001:db8::10"
                  className="min-h-28 font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">Separate IPs with new lines, commas, or spaces.</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Save className="h-3 w-3 mr-1.5" />}
                Save IP Rules
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
