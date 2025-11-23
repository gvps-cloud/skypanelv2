import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { PageHeader } from "@/components/layouts/PageHeader";
import { ContentCard } from "@/components/layouts/ContentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminPaaSDnsPage() {
  const [context, setContext] = useState("");
  const [output, setOutput] = useState("");
  const [clusterDomain, setClusterDomain] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const show = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const data = await apiClient.get<{
        success: boolean;
        output: string;
        error?: string;
      }>(
        `/api/admin/paas/dns/show${
          context ? `?context=${encodeURIComponent(context)}` : ""
        }`
      );
      const raw = data.output || "";
      setOutput(raw);

      // Check for specific error conditions
      const lowerOutput = raw.toLowerCase();
      
      // Check for context not found error
      if (lowerOutput.includes('context') && lowerOutput.includes('not found')) {
        setError(context 
          ? `The cluster "${context}" does not exist. Leave the cluster field empty to use your default cluster, or enter the name of an existing cluster.`
          : "Cluster not found. Please verify your cluster configuration or name is correct.");
        setClusterDomain("");
        return;
      }
      
      // Check if there's an error indicating no domain is reserved
      const hasError = lowerOutput.includes('error:') || 
                       lowerOutput.includes('no domain');
      
      if (hasError) {
        // No domain reserved, clear the domain field
        setClusterDomain("");
      } else {
        // Try to extract the cluster domain from the CLI output.
        // Look for the last line which should contain just the domain
        const lines = raw.split('\n').filter(l => l.trim());
        const lastLine = lines[lines.length - 1]?.trim() || "";
        
        // The domain should be in format: <slug>.cluster.uncloud.run
        const match = lastLine.match(/^([a-zA-Z0-9-]+\.cluster\.uncloud\.run)$/);
        setClusterDomain(match ? match[1] : "");
      }
    } catch (e: any) {
      const errorMsg = e?.message || "Failed to load DNS information";
      // Clean up technical error messages
      if (errorMsg.includes('config.yaml') || errorMsg.includes('/root/')) {
        setError("Unable to connect to cluster. Please verify your cluster configuration or name is correct.");
      } else {
        setError(errorMsg);
      }
      setClusterDomain("");
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void show();
  }, [show]);

  async function reserve() {
    try {
      setError("");
      await apiClient.post("/api/admin/paas/dns/reserve", {
        context: context || undefined,
      });
      await show();
    } catch (e: any) {
      const errorMsg = e?.message || "Failed to reserve domain";
      // Clean up technical error messages
      if (errorMsg.includes('config.yaml') || errorMsg.includes('/root/') || 
          (errorMsg.toLowerCase().includes('context') && errorMsg.toLowerCase().includes('not found'))) {
        setError(context 
          ? `The cluster "${context}" does not exist. Leave the cluster field empty to use your default cluster, or enter the name of an existing cluster.`
          : "Unable to connect to cluster. Please verify your cluster configuration or name is correct.");
      } else {
        setError(errorMsg);
      }
    }
  }

  async function release() {
    try {
      setError("");
      await apiClient.post("/api/admin/paas/dns/release", {
        context: context || undefined,
      });
      await show();
    } catch (e: any) {
      const errorMsg = e?.message || "Failed to release domain";
      // Clean up technical error messages
      if (errorMsg.includes('config.yaml') || errorMsg.includes('/root/') || 
          (errorMsg.toLowerCase().includes('context') && errorMsg.toLowerCase().includes('not found'))) {
        setError(context 
          ? `The cluster "${context}" does not exist. Leave the cluster field empty to use your default cluster, or enter the name of an existing cluster.`
          : "Unable to connect to cluster. Please verify your cluster configuration or name is correct.");
      } else {
        setError(errorMsg);
      }
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="PaaS DNS"
        description="Manage your cluster's auto-assigned *.cluster.uncloud.run domain. All services automatically get subdomains. If you manage multiple clusters, use the context field to switch between them."
        badge={{ text: "PaaS Admin", variant: "secondary" }}
      />

      <ContentCard
        title="Cluster Domain"
        description="Reserve or release a unique domain for your cluster. The domain is automatically assigned by uncloud.run and used by all services in this cluster."
        headerAction={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Input
                placeholder="default"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="h-8 w-32 text-xs"
                title="Cluster context name (leave empty for default context)"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                cluster
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={show}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Context Info */}
          {context && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 border">
              <span className="font-medium">Cluster Context:</span> {context}
            </div>
          )}
          
          {/* Domain Status Display */}
          <div className="rounded-md border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Current Cluster Domain
                </div>
                {clusterDomain ? (
                  <div className="font-mono text-sm font-semibold text-foreground">
                    {clusterDomain}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic">
                    No domain reserved
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-2">
                  {clusterDomain 
                    ? "Services automatically get subdomains like: service-name." + clusterDomain
                    : "Click Reserve to get an auto-assigned *.cluster.uncloud.run domain"}
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <Button
                  size="sm"
                  onClick={reserve}
                  disabled={loading || Boolean(clusterDomain)}
                >
                  Reserve Domain
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={release}
                  disabled={loading || !clusterDomain}
                >
                  Release
                </Button>
              </div>
            </div>
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          {/* Raw CLI Output - only show if not an error */}
          {!error && output && !output.toLowerCase().includes('not found') && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Details
              </div>
              <div className="rounded-md border bg-muted/60 p-3">
                {loading ? (
                  <div className="text-xs text-muted-foreground">Loading…</div>
                ) : (
                  <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
                    {output}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      </ContentCard>
    </div>
  );
}

