import { useState } from "react";
import { useEnhanceAdminStatus } from "@/hooks/useEnhanceAdmin";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Globe, RefreshCw, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function EnhanceIntegrationCard() {
  const { data: status, isLoading, refetch } = useEnhanceAdminStatus();
  const [toggling, setToggling] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleToggle = async (enabled: boolean) => {
    setToggling(true);
    try {
      await apiClient.patch("/admin/enhance/status", { enabled });
      toast.success(`Enhance ${enabled ? "enabled" : "disabled"}`);
      refetch();
    } catch (error: any) {
      toast.error(error?.message || "Failed to toggle Enhance");
    } finally {
      setToggling(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await apiClient.post("/admin/enhance/status/test", {});
      if (result.success) {
        toast.success("Health check passed: " + result.message);
      } else {
        toast.error("Health check failed: " + result.message);
      }
      refetch();
    } catch (error: any) {
      toast.error(error?.message || "Health check failed");
    } finally {
      setTesting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const canToggle = status?.hardEnabled && status?.envConfigured;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Enhance Web Hosting Integration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Hard Gate</p>
            <Badge variant={status?.hardEnabled ? "default" : "secondary"}>
              {status?.hardEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Environment</p>
            <Badge variant={status?.envConfigured ? "default" : "destructive"}>
              {status?.envConfigured ? "Configured" : "Incomplete"}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Runtime Toggle</p>
            <Badge variant={status?.runtimeEnabled ? "default" : "secondary"}>
              {status?.runtimeEnabled ? "On" : "Off"}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Effective</p>
            <Badge variant={status?.effectiveEnabled ? "default" : "secondary"}>
              {status?.effectiveEnabled ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>

        {status?.missingEnv && status.missingEnv.length > 0 && (
          <div className="rounded-md bg-destructive/10 p-3">
            <p className="text-sm font-medium text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Missing Environment Variables
            </p>
            <ul className="mt-1 text-sm text-destructive/80 list-disc list-inside">
              {status.missingEnv.map((env: string) => (
                <li key={env}>{env}</li>
              ))}
            </ul>
          </div>
        )}

        {status?.lastHealthCheckAt && (
          <div className="text-sm text-muted-foreground">
            Last health check: {new Date(status.lastHealthCheckAt).toLocaleString()} —{" "}
            <span className={status.lastHealthStatus === "healthy" ? "text-green-600" : "text-red-600"}>
              {status.lastHealthStatus}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center space-x-2">
            <Switch
              id="enhance-toggle"
              checked={status?.runtimeEnabled || false}
              onCheckedChange={handleToggle}
              disabled={!canToggle || toggling}
            />
            <Label htmlFor="enhance-toggle">
              {toggling ? <Loader2 className="w-4 h-4 animate-spin" /> : "Runtime Enabled"}
            </Label>
          </div>
          <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Test Connection
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
