import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FileCode2, Loader2, RefreshCw, Save, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";

interface Domain { id: string; domain: string; }

interface Props {
  subscriptionId: string;
  domains: Domain[];
  webserver: "apache" | "nginx";
}

export default function VhostEditorCard({ subscriptionId, domains, webserver }: Props) {
  const [selectedDomainId, setSelectedDomainId] = useState("");
  const [contents, setContents] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const basePath = `/hosting/web/${subscriptionId}/domains/${selectedDomainId}/vhost`;

  const load = useCallback(async () => {
    if (!selectedDomainId) return;
    setLoading(true);
    try {
      const data = await apiClient.get<{ contents: string }>(basePath);
      setContents(typeof data?.contents === "string" ? data.contents : "");
    } catch {
      setContents("");
    } finally {
      setLoading(false);
    }
  }, [basePath, selectedDomainId]);

  useEffect(() => {
    if (domains.length > 0 && !selectedDomainId) {
      setSelectedDomainId(domains[0].id);
    }
  }, [domains, selectedDomainId]);

  useEffect(() => { if (selectedDomainId) load(); }, [load, selectedDomainId]);

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.put(basePath, { contents, webserver });
      toast.success("Custom vhost saved");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save vhost");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this custom vhost file?")) return;
    setDeleting(true);
    try {
      await apiClient.delete(basePath, { webserver });
      setContents("");
      toast.success("Custom vhost deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete vhost");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="rounded-2xl cyber-card cyber-card--hover">
      <div className="border-b border-border px-6 py-4 sm:px-8 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground sm:text-lg">
              <FileCode2 className="h-5 w-5 text-primary" />
              <span>{webserver === "apache" ? "Apache" : "Nginx"} Custom Vhost</span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Edit the documented domain custom vhost file for {webserver === "apache" ? "Apache" : "Nginx"}.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading || !selectedDomainId}>
            <RefreshCw className={cn("h-3 w-3 mr-1.5", loading && "animate-spin")} />Refresh
          </Button>
        </div>
      </div>
      <div className="px-6 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Domain</Label>
            <Select value={selectedDomainId} onValueChange={setSelectedDomainId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a domain" />
              </SelectTrigger>
              <SelectContent>
                {domains.map((domain) => (
                  <SelectItem key={domain.id} value={domain.id}>{domain.domain}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!selectedDomainId ? (
            <p className="text-sm text-muted-foreground">Select a domain to manage its custom vhost.</p>
          ) : loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="vhost-contents">Vhost contents</Label>
                <Textarea
                  id="vhost-contents"
                  value={contents}
                  onChange={(event) => setContents(event.target.value)}
                  placeholder={webserver === "apache" ? "# Apache vhost directives" : "# Nginx vhost directives"}
                  className="min-h-52 font-mono text-sm"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" size="sm" onClick={remove} disabled={deleting || !contents.trim()}>
                  {deleting ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Trash2 className="h-3 w-3 mr-1.5" />}
                  Delete Custom Vhost
                </Button>
                <Button size="sm" onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Save className="h-3 w-3 mr-1.5" />}
                  Save Vhost
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
