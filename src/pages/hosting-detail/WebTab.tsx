import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, RotateCcw, Globe, AlertTriangle, RefreshCw, Power } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface PhpSettings {
  lsapiChildren: number;
}

interface WebTabProps {
  subscriptionId: string;
}

export default function WebTab({ subscriptionId }: WebTabProps) {
  const [settings, setSettings] = useState<PhpSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [websiteStatus, setWebsiteStatus] = useState<string | null>(null);
  const [websiteSuspended, setWebsiteSuspended] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [togglingSuspend, setTogglingSuspend] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!subscriptionId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<PhpSettings>(`/hosting/web/${subscriptionId}/php`);
      setSettings(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load PHP settings";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [subscriptionId]);

  const loadWebsite = useCallback(async () => {
    if (!subscriptionId) return;
    setStatusLoading(true);
    try {
      const data = await apiClient.get<Record<string, any>>(`/hosting/web/${subscriptionId}/website`);
      setWebsiteStatus(data?.status ?? null);
      setWebsiteSuspended(data?.status === "suspended");
    } catch {
      // non-fatal
    } finally {
      setStatusLoading(false);
    }
  }, [subscriptionId]);

  useEffect(() => {
    loadSettings();
    loadWebsite();
  }, [loadSettings, loadWebsite]);

  const handleSave = async () => {
    if (!subscriptionId || !settings) return;
    setSaving(true);
    try {
      await apiClient.put(`/hosting/web/${subscriptionId}/php`, settings);
      toast.success("PHP settings saved");
      setIsEditing(false);
      await loadSettings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save PHP settings");
    } finally {
      setSaving(false);
    }
  };

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

  const handleToggleSuspend = async () => {
    if (!subscriptionId) return;
    const action = websiteSuspended ? "unsuspend" : "suspend";
    if (!confirm(`${websiteSuspended ? "Unsuspend" : "Suspend"} this website?`)) return;
    setTogglingSuspend(true);
    try {
      await apiClient.put(`/hosting/web/${subscriptionId}/website`, {
        status: websiteSuspended ? "active" : "suspended",
      });
      toast.success(`Website ${action === "suspend" ? "suspended" : "unsuspended"}`);
      await loadWebsite();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} website`);
    } finally {
      setTogglingSuspend(false);
    }
  };

  const updateField = <K extends keyof PhpSettings>(key: K, value: PhpSettings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  if (loading && !settings) {
    return (
      <section className="rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading web settings...</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border bg-card shadow-sm">
        <div className="px-6 py-8 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={loadSettings}>
            <RefreshCw className="h-3 w-3 mr-1.5" />Retry
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {/* Website Status */}
      <section className="rounded-2xl border bg-card shadow-sm">
        <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
                <Power className="h-5 w-5 text-primary" />
                <span>Website Status</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">Suspend or unsuspend this website.</p>
            </div>
            <div className="flex items-center gap-3">
              {statusLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <Badge variant={websiteSuspended ? "destructive" : "default"}>
                    {websiteStatus ?? "unknown"}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!websiteSuspended}
                      onCheckedChange={handleToggleSuspend}
                      disabled={togglingSuspend}
                    />
                    <span className="text-xs text-muted-foreground">
                      {websiteSuspended ? "Suspended" : "Active"}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* PHP Settings */}
      <section className="rounded-2xl border bg-card shadow-sm">
        <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
                <Globe className="h-5 w-5 text-primary" />
                <span>PHP Settings</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">Manage PHP configuration.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadSettings} disabled={loading}>
                <RefreshCw className={cn("h-3 w-3 mr-1.5", loading && "animate-spin")} />Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsEditing((prev) => !prev)} disabled={saving || restarting}>
                {isEditing ? "Cancel" : "Edit"}
              </Button>
              <Button size="sm" onClick={handleRestart} disabled={restarting || loading}>
                {restarting ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <RotateCcw className="h-3 w-3 mr-1.5" />}
                Restart PHP
              </Button>
            </div>
          </div>
        </div>
        <div className="px-6 sm:px-8 py-5 sm:py-6">
          {settings ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="lsapi-children">LSAPI Children</Label>
                {isEditing ? (
                  <Input id="lsapi-children" type="number" value={settings.lsapiChildren} onChange={(e) => updateField("lsapiChildren", Number(e.target.value))} />
                ) : (
                  <div className="h-10 flex items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-foreground">{settings.lsapiChildren}</div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Globe className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No PHP settings found.</p>
            </div>
          )}
          {isEditing && settings && (
            <div className="mt-6 flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Settings
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
