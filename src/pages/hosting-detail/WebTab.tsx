import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, RotateCcw, Globe, AlertTriangle, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface PhpSettings {
  version: string;
  memory_limit: string;
  max_execution_time: number;
  max_input_time: number;
  max_input_vars: number;
  post_max_size: string;
  upload_max_filesize: string;
  display_errors: boolean;
  opcache_enabled: boolean;
}

interface WebTabProps {
  subscriptionId: string;
}

const PHP_VERSIONS = ["8.3", "8.2", "8.1", "8.0", "7.4"];

export default function WebTab({ subscriptionId }: WebTabProps) {
  const [settings, setSettings] = useState<PhpSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

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

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    if (!subscriptionId || !settings) return;
    setSaving(true);
    try {
      await apiClient.put(`/hosting/web/${subscriptionId}/php`, settings);
      toast.success("PHP settings saved successfully");
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
      toast.success("PHP restarted successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restart PHP");
    } finally {
      setRestarting(false);
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
          <span className="ml-2 text-sm text-muted-foreground">Loading PHP settings...</span>
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
            <RefreshCw className="h-3 w-3 mr-1.5" />
            Retry
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
              <Globe className="h-5 w-5 text-primary" />
              <span>PHP Settings</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Manage PHP configuration for this hosting subscription.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadSettings} disabled={loading}>
              <RefreshCw className={cn("h-3 w-3 mr-1.5", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing((prev) => !prev)}
              disabled={saving || restarting}
            >
              {isEditing ? "Cancel" : "Edit"}
            </Button>
            <Button
              size="sm"
              onClick={handleRestart}
              disabled={restarting || loading}
            >
              {restarting ? (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3 w-3 mr-1.5" />
              )}
              Restart PHP
            </Button>
          </div>
        </div>
      </div>

      <div className="px-6 sm:px-8 py-5 sm:py-6">
        {settings ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="php-version">PHP Version</Label>
              {isEditing ? (
                <Select value={settings.version} onValueChange={(v) => updateField("version", v)}>
                  <SelectTrigger id="php-version">
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    {PHP_VERSIONS.map((v) => (
                      <SelectItem key={v} value={v}>
                        PHP {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="h-10 flex items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-foreground">
                  {settings.version}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="memory-limit">Memory Limit</Label>
              {isEditing ? (
                <Input
                  id="memory-limit"
                  value={settings.memory_limit}
                  onChange={(e) => updateField("memory_limit", e.target.value)}
                  placeholder="256M"
                />
              ) : (
                <div className="h-10 flex items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-foreground">
                  {settings.memory_limit}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-execution-time">Max Execution Time (seconds)</Label>
              {isEditing ? (
                <Input
                  id="max-execution-time"
                  type="number"
                  value={settings.max_execution_time}
                  onChange={(e) => updateField("max_execution_time", Number(e.target.value))}
                />
              ) : (
                <div className="h-10 flex items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-foreground">
                  {settings.max_execution_time}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-input-time">Max Input Time (seconds)</Label>
              {isEditing ? (
                <Input
                  id="max-input-time"
                  type="number"
                  value={settings.max_input_time}
                  onChange={(e) => updateField("max_input_time", Number(e.target.value))}
                />
              ) : (
                <div className="h-10 flex items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-foreground">
                  {settings.max_input_time}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-input-vars">Max Input Vars</Label>
              {isEditing ? (
                <Input
                  id="max-input-vars"
                  type="number"
                  value={settings.max_input_vars}
                  onChange={(e) => updateField("max_input_vars", Number(e.target.value))}
                />
              ) : (
                <div className="h-10 flex items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-foreground">
                  {settings.max_input_vars}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="post-max-size">Post Max Size</Label>
              {isEditing ? (
                <Input
                  id="post-max-size"
                  value={settings.post_max_size}
                  onChange={(e) => updateField("post_max_size", e.target.value)}
                  placeholder="64M"
                />
              ) : (
                <div className="h-10 flex items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-foreground">
                  {settings.post_max_size}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="upload-max-filesize">Upload Max Filesize</Label>
              {isEditing ? (
                <Input
                  id="upload-max-filesize"
                  value={settings.upload_max_filesize}
                  onChange={(e) => updateField("upload_max_filesize", e.target.value)}
                  placeholder="64M"
                />
              ) : (
                <div className="h-10 flex items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-foreground">
                  {settings.upload_max_filesize}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="display-errors">Display Errors</Label>
              {isEditing ? (
                <Select
                  value={settings.display_errors ? "true" : "false"}
                  onValueChange={(v) => updateField("display_errors", v === "true")}
                >
                  <SelectTrigger id="display-errors">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">On</SelectItem>
                    <SelectItem value="false">Off</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="h-10 flex items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-foreground">
                  {settings.display_errors ? "On" : "Off"}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="opcache-enabled">OPcache Enabled</Label>
              {isEditing ? (
                <Select
                  value={settings.opcache_enabled ? "true" : "false"}
                  onValueChange={(v) => updateField("opcache_enabled", v === "true")}
                >
                  <SelectTrigger id="opcache-enabled">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">On</SelectItem>
                    <SelectItem value="false">Off</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="h-10 flex items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-foreground">
                  {settings.opcache_enabled ? "On" : "Off"}
                </div>
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
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Settings
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
