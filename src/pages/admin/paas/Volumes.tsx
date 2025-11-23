import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { PageHeader } from "@/components/layouts/PageHeader";
import { ContentCard } from "@/components/layouts/ContentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminPaaSVolumesPage() {
  const [context, setContext] = useState("");
  const [search, setSearch] = useState("");
  const [volumes, setVolumes] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data =
        await apiClient.get<{
          success: boolean;
          volumes: string[];
          error?: string;
        }>(
          `/api/admin/paas/volumes${
            context ? `?context=${encodeURIComponent(context)}` : ""
          }`
        );
      setVolumes(data.volumes || []);
    } catch (e: any) {
      const errorMsg = e?.message || "Failed to load volumes";
      // Clean up technical error messages
      if (errorMsg.includes('config.yaml') || errorMsg.includes('/root/') || 
          (errorMsg.toLowerCase().includes('context') && errorMsg.toLowerCase().includes('not found'))) {
        setError(context 
          ? `The cluster "${context}" does not exist. Leave the cluster field empty to use your default cluster, or enter the name of an existing cluster.`
          : "Unable to connect to cluster. Please verify your cluster configuration or name is correct.");
      } else {
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function create() {
    try {
      await apiClient.post("/api/admin/paas/volumes", { name, context });
      setName("");
      await refresh();
    } catch (e: any) {
      const errorMsg = e?.message || "Failed to create volume";
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

  async function remove(v: string) {
    try {
      const query = context ? `?context=${encodeURIComponent(context)}` : "";
      await apiClient.delete(
        `/api/admin/paas/volumes/${encodeURIComponent(v)}${query}`
      );
      await refresh();
    } catch (e: any) {
      const errorMsg = e?.message || "Failed to delete volume";
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

  const filteredVolumes = volumes.filter((v) =>
    v.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="PaaS Volumes"
        description="Manage Docker volumes in your uncloud clusters. If you manage multiple clusters, use the context field to switch between them."
        badge={{ text: "PaaS Admin", variant: "secondary" }}
      />

      <ContentCard
        title="Volumes"
        description="Create and delete volumes attached to your PaaS services."
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
            <Input
              placeholder="Search volumes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-40"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={refresh}
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
          
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder="New volume name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="sm:max-w-xs"
            />
            <Button
              size="sm"
              onClick={create}
              disabled={!name.trim() || loading}
            >
              Create volume
            </Button>
          </div>

          {loading && (
            <div className="text-sm text-muted-foreground">Loading…</div>
          )}
          {error && <div className="text-sm text-destructive">{error}</div>}

          {filteredVolumes.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {volumes.length === 0 
                ? "No volumes found in this cluster." 
                : "No volumes match your search."}
            </div>
          ) : (
            <ul className="divide-y rounded-md border bg-card text-sm">
              {filteredVolumes.map((v) => (
                <li
                  key={v}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <span className="font-mono text-xs sm:text-sm">{v}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => remove(v)}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </ContentCard>
    </div>
  );
}

