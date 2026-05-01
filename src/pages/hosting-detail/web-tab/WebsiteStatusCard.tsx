import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Power } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const PHP_VERSIONS = [
  "php56", "php70", "php71", "php72", "php73", "php74",
  "php80", "php81", "php82", "php83", "php84", "php85",
];

interface Props {
  subscriptionId: string;
}

export default function WebsiteStatusCard({ subscriptionId }: Props) {
  const [website, setWebsite] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingSuspend, setTogglingSuspend] = useState(false);
  const [changingVersion, setChangingVersion] = useState(false);

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
  const currentVersion = website?.phpVersion || "";

  const handleToggleSuspend = async () => {
    if (!subscriptionId) return;
    const action = isSuspended ? "unsuspend" : "suspend";
    if (!confirm(`${isSuspended ? "Unsuspend" : "Suspend"} this website?`)) return;
    setTogglingSuspend(true);
    try {
      await apiClient.patch(`/hosting/web/${subscriptionId}/website`, {
        status: isSuspended ? "active" : "disabled",
      });
      toast.success(`Website ${action === "suspend" ? "suspended" : "unsuspended"}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} website`);
    } finally {
      setTogglingSuspend(false);
    }
  };

  const handleVersionChange = async (version: string) => {
    if (!subscriptionId) return;
    setChangingVersion(true);
    try {
      await apiClient.patch(`/hosting/web/${subscriptionId}/website`, { phpVersion: version });
      toast.success(`PHP version changed to ${version.replace("php", "PHP ")}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change PHP version");
    } finally {
      setChangingVersion(false);
    }
  };

  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
              <Power className="h-5 w-5 text-primary" />
              <span>Website Status</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Manage website status and PHP version.</p>
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
      <div className="px-6 sm:px-8 py-5 sm:py-6">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Domain</Label>
              <div className="h-10 flex items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-foreground">
                {website?.domain?.domain || "—"}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="php-version">PHP Version</Label>
              <Select value={currentVersion} onValueChange={handleVersionChange} disabled={changingVersion}>
                <SelectTrigger id="php-version">
                  <SelectValue placeholder={currentVersion ? currentVersion.replace("php", "PHP ") : "Select version"}>
                    {changingVersion ? "Changing..." : currentVersion ? currentVersion.replace("php", "PHP ") : "Select version"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PHP_VERSIONS.map((v) => (
                    <SelectItem key={v} value={v}>{v.replace("php", "PHP ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
