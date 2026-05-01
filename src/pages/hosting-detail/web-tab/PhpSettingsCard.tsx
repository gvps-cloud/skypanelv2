import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, RotateCcw, Globe } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  subscriptionId: string;
}

export default function PhpSettingsCard({ subscriptionId }: Props) {
  const [settings, setSettings] = useState<{ lsapiChildren: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const load = useCallback(async () => {
    if (!subscriptionId) return;
    setLoading(true);
    try {
      const data = await apiClient.get<{ lsapiChildren: number }>(`/hosting/web/${subscriptionId}/php`);
      setSettings(data);
    } catch {
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, [subscriptionId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!subscriptionId || !settings) return;
    setSaving(true);
    try {
      await apiClient.put(`/hosting/web/${subscriptionId}/php`, settings);
      toast.success("PHP settings saved");
      setIsEditing(false);
      await load();
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

  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
              <Globe className="h-5 w-5 text-primary" />
              <span>PHP Settings</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">LSPHP process configuration.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditing((p) => !p)} disabled={saving || restarting}>
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
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : settings ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="lsapi-children">LSAPI Children</Label>
              {isEditing ? (
                <Input
                  id="lsapi-children"
                  type="number"
                  value={settings.lsapiChildren}
                  onChange={(e) => setSettings((p) => p ? { ...p, lsapiChildren: Number(e.target.value) } : p)}
                />
              ) : (
                <div className="h-10 flex items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-foreground">
                  {settings.lsapiChildren}
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No PHP settings found.</p>
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
  );
}
