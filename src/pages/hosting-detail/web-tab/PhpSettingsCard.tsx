import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, RotateCcw, Globe } from "lucide-react";
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

const PHP_VERSIONS = [
  "php56", "php70", "php71", "php72", "php73", "php74",
  "php80", "php81", "php82", "php83", "php84", "php85",
];

interface Props {
  subscriptionId: string;
}

export default function PhpSettingsCard({ subscriptionId }: Props) {
  const [website, setWebsite] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState(false);
  const [changingVersion, setChangingVersion] = useState(false);

  const load = useCallback(async () => {
    if (!subscriptionId) return;
    setLoading(true);
    try {
      const data = await apiClient.get<Record<string, any>>(`/hosting/web/${subscriptionId}/website`);
      setWebsite(data);
    } catch {
      setWebsite(null);
    } finally {
      setLoading(false);
    }
  }, [subscriptionId]);

  useEffect(() => { load(); }, [load]);

  const handleRestart = async () => {
    if (!subscriptionId) return;
    setRestarting(true);
    try {
      await apiClient.post(`/hosting/web/${subscriptionId}/php/restart`);
      toast.success("PHP restarted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restart PHP");
    } finally {
      setRestarting(false);
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

  const currentVersion = website?.phpVersion || "";

  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
              <Globe className="h-5 w-5 text-primary" />
              <span>PHP Settings</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">PHP version configuration.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleRestart} disabled={restarting || loading}>
              {restarting ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <RotateCcw className="h-3 w-3 mr-1.5" />}
              Restart PHP
            </Button>
          </div>
        </div>
      </div>
      <div className="px-6 sm:px-8 py-5 sm:py-6">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
