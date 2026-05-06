/**
 * Maintenance Manager Component
 * Allows admins to toggle maintenance mode, disable registrations,
 * and edit the rich-text maintenance message.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Save, Lock, Unlock, Copy, AlertTriangle, Wrench } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import RichTextEditor from "@/components/ui/rich-text-editor";

interface MaintenanceSettings {
  maintenanceMode: boolean;
  maintenanceMessageHtml: string;
  registrationDisabled: boolean;
  bypassCodeConfigured: boolean;
  /** Present only after unlock; cleared when auto-hide runs */
  code?: string | null;
}

export default function MaintenanceManager() {
  const { verifyPassword } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<MaintenanceSettings>({
    maintenanceMode: false,
    maintenanceMessageHtml: "",
    registrationDisabled: false,
    bypassCodeConfigured: false,
  });

  // Unlock state for viewing the bypass code
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [codeRevealed, setCodeRevealed] = useState(false);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<MaintenanceSettings>("/admin/platform/maintenance");
      setSettings({
        maintenanceMode: Boolean(data.maintenanceMode),
        maintenanceMessageHtml: data.maintenanceMessageHtml || "",
        registrationDisabled: Boolean(data.registrationDisabled),
        bypassCodeConfigured: Boolean(data.bypassCodeConfigured),
      });
    } catch (error: any) {
      console.error("Failed to fetch maintenance settings:", error);
      toast.error(error.message || "Failed to load maintenance settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    return () => {
      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current);
      }
    };
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload: Partial<MaintenanceSettings> = {};
      payload.maintenanceMode = settings.maintenanceMode;
      payload.maintenanceMessageHtml = settings.maintenanceMessageHtml;
      payload.registrationDisabled = settings.registrationDisabled;

      const data = await apiClient.put<MaintenanceSettings>("/admin/platform/maintenance", payload);
      setSettings((prev) => ({
        ...prev,
        maintenanceMode: Boolean(data.maintenanceMode),
        maintenanceMessageHtml: data.maintenanceMessageHtml || "",
        registrationDisabled: Boolean(data.registrationDisabled),
        bypassCodeConfigured: Boolean(data.bypassCodeConfigured),
      }));
      toast.success("Maintenance settings saved successfully");
    } catch (error: any) {
      console.error("Failed to save maintenance settings:", error);
      toast.error(error.message || "Failed to save maintenance settings");
    } finally {
      setSaving(false);
    }
  };

  const handleUnlock = async () => {
    if (!unlockPassword.trim()) {
      toast.error("Please enter your password");
      return;
    }
    try {
      setUnlockLoading(true);
      await verifyPassword(unlockPassword);
      const codeData = await apiClient.post<{ configured: boolean; code: string | null }>(
        "/admin/platform/maintenance/code",
        { password: unlockPassword },
      );
      setSettings((prev) => ({
        ...prev,
        bypassCodeConfigured: Boolean(codeData.configured),
        code: codeData.code || undefined,
      }));
      setCodeRevealed(true);
      setUnlockOpen(false);
      setUnlockPassword("");
      toast.success("Code revealed. It will auto-hide in 30 seconds.");
      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current);
      }
      revealTimeoutRef.current = setTimeout(() => {
        setCodeRevealed(false);
      }, 30_000);
    } catch (error: any) {
      toast.error(error.message || "Incorrect password");
    } finally {
      setUnlockLoading(false);
    }
  };

  const handleCopyCode = () => {
    const code = settings.bypassCodeConfigured ? settings.code || "" : "";
    if (!code) {
      toast.error("No code configured in environment");
      return;
    }
    navigator.clipboard.writeText(code).then(() => {
      toast.success("Code copied to clipboard");
    }).catch(() => {
      toast.error("Failed to copy code");
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Maintenance Mode Card */}
      <Card className="border-primary/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Maintenance Mode
          </CardTitle>
          <CardDescription>
            When enabled, the site displays a maintenance page for all non-admin users.
            Admins can bypass using the code configured in environment variables.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="maintenance-toggle" className="text-base font-medium">
                Enable Maintenance Mode
              </Label>
              <p className="text-sm text-muted-foreground">
                Blocks public access and redirects to the maintenance page.
              </p>
            </div>
            <Switch
              id="maintenance-toggle"
              checked={settings.maintenanceMode}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, maintenanceMode: checked }))
              }
            />
          </div>

          {settings.maintenanceMode && (
            <div className="space-y-2">
              <Label htmlFor="maintenance-message">Maintenance Message</Label>
              <RichTextEditor
                value={settings.maintenanceMessageHtml}
                onChange={(html) =>
                  setSettings((prev) => ({ ...prev, maintenanceMessageHtml: html }))
                }
                placeholder="Enter the message shown on the maintenance page..."
                height={240}
              />
              <p className="text-sm text-muted-foreground">
                This message is displayed to visitors during maintenance.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Registration Card */}
      <Card className="border-primary/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            User Registrations
          </CardTitle>
          <CardDescription>
            Control whether new users can create accounts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="registration-toggle" className="text-base font-medium">
                Disable Registrations
              </Label>
              <p className="text-sm text-muted-foreground">
                Prevents new sign-ups while keeping existing user access intact.
              </p>
            </div>
            <Switch
              id="registration-toggle"
              checked={settings.registrationDisabled}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, registrationDisabled: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Bypass Code Card */}
      <Card className="border-primary/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Admin Bypass Code
          </CardTitle>
          <CardDescription>
            The code required for admins to log in during maintenance mode.
            Configured via the MAINTENANCE_CODE environment variable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-md border bg-muted px-3 py-2 font-mono text-sm">
              {codeRevealed
                ? settings.code || "Not configured"
                : settings.bypassCodeConfigured
                  ? "••••••••••••••••"
                  : "Not configured"}
            </div>
            {codeRevealed ? (
              <Button variant="outline" size="sm" onClick={handleCopyCode}>
                <Copy className="mr-1.5 h-4 w-4" />
                Copy
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setUnlockOpen(true)}>
                <Unlock className="mr-1.5 h-4 w-4" />
                Unlock
              </Button>
            )}
          </div>
          {!settings.bypassCodeConfigured && (
            <p className="mt-2 text-sm text-destructive">
              Warning: No bypass code is configured. Admins will be unable to log in during maintenance.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {/* Unlock Dialog */}
      <Dialog open={unlockOpen} onOpenChange={setUnlockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reveal Bypass Code</DialogTitle>
            <DialogDescription>
              Enter your admin password to reveal the maintenance bypass code.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="unlock-password">Your Password</Label>
              <Input
                id="unlock-password"
                type="password"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                placeholder="Enter your password"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUnlock();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlockOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUnlock} disabled={unlockLoading}>
              {unlockLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Unlock className="mr-2 h-4 w-4" />
              )}
              Reveal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
