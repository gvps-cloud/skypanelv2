import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useEnhanceAdminStatus, useLinodeAdminStatus } from "@/hooks/useEnhanceAdmin";
import { hostingKeys, vpsProductKeys } from "@/hooks/useHosting";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Globe, Server, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function FeatureTogglesPanel() {
  const queryClient = useQueryClient();
  const { data: enhanceStatus, isLoading: enhanceLoading, refetch: refetchEnhance } = useEnhanceAdminStatus();
  const { data: linodeStatus, isLoading: linodeLoading, refetch: refetchLinode } = useLinodeAdminStatus();
  const [enhanceToggling, setEnhanceToggling] = useState(false);
  const [linodeToggling, setLinodeToggling] = useState(false);

  const handleEnhanceToggle = async (enabled: boolean) => {
    setEnhanceToggling(true);
    try {
      await apiClient.patch("/admin/enhance/status", { enabled });
      toast.success(`Enhance web hosting ${enabled ? "enabled" : "disabled"}`);
      await refetchEnhance();
      await queryClient.invalidateQueries({ queryKey: hostingKeys.status() });
    } catch (error: any) {
      toast.error(error?.message || "Failed to toggle Enhance");
    } finally {
      setEnhanceToggling(false);
    }
  };

  const handleLinodeToggle = async (enabled: boolean) => {
    setLinodeToggling(true);
    try {
      await apiClient.patch("/admin/linode/status", { enabled });
      toast.success(`VPS / Linode hosting ${enabled ? "enabled" : "disabled"}`);
      await refetchLinode();
      await queryClient.invalidateQueries({ queryKey: vpsProductKeys.all });
    } catch (error: any) {
      toast.error(error?.message || "Failed to toggle VPS hosting");
    } finally {
      setLinodeToggling(false);
    }
  };

  if (enhanceLoading || linodeLoading) {
    return (
      <Card className="border-primary/25">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const canToggleEnhance = enhanceStatus?.hardEnabled && enhanceStatus?.envConfigured;
  const canToggleLinode = linodeStatus?.hardEnabled && linodeStatus?.envConfigured;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Feature toggles</h2>
        <p className="text-sm text-muted-foreground">
          Turn customer-facing Enhance web hosting and VPS (Linode) surfaces on or off without redeploying.
        </p>
      </div>

      <Card className="border-primary/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5" />
            Enhance web hosting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Hard gate</p>
              <Badge variant={enhanceStatus?.hardEnabled ? "default" : "secondary"}>
                {enhanceStatus?.hardEnabled ? "On" : "Off"}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Environment</p>
              <Badge variant={enhanceStatus?.envConfigured ? "default" : "destructive"}>
                {enhanceStatus?.envConfigured ? "OK" : "Incomplete"}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Runtime</p>
              <Badge variant={enhanceStatus?.runtimeEnabled ? "default" : "secondary"}>
                {enhanceStatus?.runtimeEnabled ? "On" : "Off"}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Effective</p>
              <Badge variant={enhanceStatus?.effectiveEnabled ? "default" : "secondary"}>
                {enhanceStatus?.effectiveEnabled ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
          {enhanceStatus?.missingEnv && enhanceStatus.missingEnv.length > 0 && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <span className="inline-flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Missing: {enhanceStatus.missingEnv.join(", ")}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <Switch
              id="toggle-enhance-runtime"
              checked={enhanceStatus?.runtimeEnabled || false}
              onCheckedChange={handleEnhanceToggle}
              disabled={!canToggleEnhance || enhanceToggling}
            />
            <Label htmlFor="toggle-enhance-runtime" className="text-sm">
              {enhanceToggling ? <Loader2 className="inline h-4 w-4 animate-spin" /> : "Runtime enabled (customers)"}
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Server className="h-5 w-5" />
            VPS compute
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">API token</p>
              <Badge variant={linodeStatus?.hardEnabled ? "default" : "secondary"}>
                {linodeStatus?.hardEnabled ? "Set" : "Missing"}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Environment</p>
              <Badge variant={linodeStatus?.envConfigured ? "default" : "destructive"}>
                {linodeStatus?.envConfigured ? "OK" : "Incomplete"}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Runtime</p>
              <Badge variant={linodeStatus?.runtimeEnabled ? "default" : "secondary"}>
                {linodeStatus?.runtimeEnabled ? "On" : "Off"}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Effective</p>
              <Badge variant={linodeStatus?.effectiveEnabled ? "default" : "secondary"}>
                {linodeStatus?.effectiveEnabled ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
          {linodeStatus?.missingEnv && linodeStatus.missingEnv.length > 0 && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <span className="inline-flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Missing: {linodeStatus.missingEnv.join(", ")}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <Switch
              id="toggle-linode-runtime"
              checked={linodeStatus?.runtimeEnabled || false}
              onCheckedChange={handleLinodeToggle}
              disabled={!canToggleLinode || linodeToggling}
            />
            <Label htmlFor="toggle-linode-runtime" className="text-sm">
              {linodeToggling ? <Loader2 className="inline h-4 w-4 animate-spin" /> : "Runtime enabled (customers)"}
            </Label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
