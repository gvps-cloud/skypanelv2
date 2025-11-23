import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { PageHeader } from "@/components/layouts/PageHeader";
import { ContentCard } from "@/components/layouts/ContentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminPaaSCaddyPage() {
  const [context, setContext] = useState("");
  const [config, setConfig] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const data = await apiClient.get<{
        success: boolean;
        output: string;
      }>(
        `/api/admin/paas/caddy/config${
          context ? `?context=${encodeURIComponent(context)}` : ""
        }`
      );
      // Strip ANSI codes from output for cleaner display
      const raw = data.output || "";
      // eslint-disable-next-line no-control-regex
      const cleaned = raw.replace(/\x1b\[[0-9;]*m/g, "");
      setConfig(cleaned);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void load();
  }, [load]);

  async function deploy() {
    try {
      await apiClient.post("/api/admin/paas/caddy/deploy", { context });
      await load();
    } catch (e: any) {
      setError(e?.message || "Deploy failed");
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Caddy Configuration"
        description="View and redeploy the Caddy configuration managed by uncloud."
        badge={{ text: "PaaS Admin", variant: "secondary" }}
      />

      <ContentCard
        title="Caddy config"
        description="This shows the effective Caddyfile for the selected context."
        headerAction={
          <div className="flex items-center gap-2">
            <Input
              placeholder="Context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="h-8 w-40"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={load}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button size="sm" onClick={deploy} disabled={loading}>
              Deploy
            </Button>
          </div>
        }
      >
        {error && <div className="mb-3 text-sm text-destructive">{error}</div>}

        <div className="rounded-md border bg-muted/60 p-3">
          {loading ? (
            <div className="text-xs text-muted-foreground">Loading…</div>
          ) : (
            <pre className="max-h-[380px] overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed">
              {config || "No Caddy configuration available for this context."}
            </pre>
          )}
        </div>
      </ContentCard>
    </div>
  );
}
