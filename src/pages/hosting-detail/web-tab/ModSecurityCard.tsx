import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface Domain { id: string; domain: string; }

interface Props {
  subscriptionId: string;
  domains: Domain[];
}

export default function ModSecurityCard({ subscriptionId, domains }: Props) {
  const [selectedDomainId, setSelectedDomainId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);

  const basePath = `/hosting/web/${subscriptionId}/domains/${selectedDomainId}/modsec-status`;

  const load = useCallback(async () => {
    if (!selectedDomainId) return;
    setLoading(true);
    try {
      const data = await apiClient.get<{ enabled: boolean }>(basePath);
      setEnabled(Boolean(data?.enabled));
    } catch {
      setEnabled(false);
    } finally {
      setLoading(false);
    }
  }, [basePath, selectedDomainId]);

  useEffect(() => {
    if (domains.length > 0 && !selectedDomainId) {
      setSelectedDomainId(domains[0].id);
    }
  }, [domains, selectedDomainId]);

  useEffect(() => { if (selectedDomainId) load(); }, [load, selectedDomainId]);

  const toggle = async () => {
    setToggling(true);
    try {
      const nextEnabled = !enabled;
      await apiClient.put(basePath, { enabled: nextEnabled });
      setEnabled(nextEnabled);
      toast.success(`ModSecurity ${nextEnabled ? "enabled" : "disabled"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update ModSecurity");
    } finally {
      setToggling(false);
    }
  };

  return (
    <section className="rounded-2xl cyber-card cyber-card--hover">
      <div className="border-b border-border px-6 py-4 sm:px-8 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground sm:text-lg">
              <ShieldAlert className="h-5 w-5 text-primary" />
              <span>ModSecurity</span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Manage the documented domain-level web application firewall status.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading || !selectedDomainId}>
            <RefreshCw className={cn("h-3 w-3 mr-1.5", loading && "animate-spin")} />Refresh
          </Button>
        </div>
      </div>
      <div className="px-6 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Domain</Label>
            <Select value={selectedDomainId} onValueChange={setSelectedDomainId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a domain" />
              </SelectTrigger>
              <SelectContent>
                {domains.map((domain) => (
                  <SelectItem key={domain.id} value={domain.id}>{domain.domain}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!selectedDomainId ? (
            <p className="text-sm text-muted-foreground">Select a domain to manage ModSecurity.</p>
          ) : loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <Label className="text-sm font-medium">ModSecurity Status</Label>
                <div className="mt-1 text-xs text-muted-foreground">
                  <Badge variant={enabled ? "default" : "secondary"}>{enabled ? "Enabled" : "Disabled"}</Badge>
                </div>
              </div>
              <Switch checked={enabled} onCheckedChange={toggle} disabled={toggling} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
