import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, Trash2, Plus, Zap, X } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Domain { id: string; domain: string; }

interface Props {
  subscriptionId: string;
  domains: Domain[];
}

export default function NginxCacheCard({ subscriptionId, domains }: Props) {
  const [selectedDomainId, setSelectedDomainId] = useState<string>("");
  const [enabled, setEnabled] = useState(false);
  const [excludedPaths, setExcludedPaths] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [purging, setPurging] = useState(false);
  const [newPath, setNewPath] = useState("");
  const [addingPath, setAddingPath] = useState(false);
  const [removingPath, setRemovingPath] = useState<string | null>(null);

  const basePath = `/hosting/web/${subscriptionId}/domains/${selectedDomainId}/nginx-fastcgi`;

  const load = useCallback(async () => {
    if (!selectedDomainId) return;
    setLoading(true);
    try {
      const [st, paths] = await Promise.all([
        apiClient.get<{ enabled: boolean }>(basePath),
        apiClient.get<{ paths: string[] }>(`${basePath}/excluded-paths`).catch(() => ({ paths: [] })),
      ]);
      setEnabled(st.enabled);
      setExcludedPaths(paths.paths ?? []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [basePath, selectedDomainId]);

  useEffect(() => {
    if (selectedDomainId) load();
  }, [selectedDomainId, load]);

  useEffect(() => {
    if (domains.length > 0 && !selectedDomainId) {
      setSelectedDomainId(domains[0].id);
    }
  }, [domains, selectedDomainId]);

  const handleToggle = async () => {
    setToggling(true);
    try {
      const newVal = !enabled;
      await apiClient.put(basePath, newVal);
      setEnabled(newVal);
      toast.success(`FastCGI cache ${newVal ? "enabled" : "disabled"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle cache");
    } finally {
      setToggling(false);
    }
  };

  const handlePurge = async () => {
    if (!confirm("Purge FastCGI cache?")) return;
    setPurging(true);
    try {
      await apiClient.delete(basePath);
      toast.success("FastCGI cache purged");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to purge cache");
    } finally {
      setPurging(false);
    }
  };

  const handleAddPath = async () => {
    if (!newPath.trim()) return;
    setAddingPath(true);
    try {
      await apiClient.post(`${basePath}/excluded-paths`, { path: newPath.trim() });
      toast.success("Excluded path added");
      setNewPath("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add path");
    } finally {
      setAddingPath(false);
    }
  };

  const handleRemovePath = async (path: string) => {
    setRemovingPath(path);
    try {
      await apiClient.delete(`${basePath}/excluded-paths?path=${encodeURIComponent(path)}`);
      toast.success("Excluded path removed");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove path");
    } finally {
      setRemovingPath(null);
    }
  };

  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
              <Zap className="h-5 w-5 text-primary" />
              <span>Nginx FastCGI Cache</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Manage Nginx caching per domain.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading || !selectedDomainId}>
              <RefreshCw className={cn("h-3 w-3 mr-1.5", loading && "animate-spin")} />Refresh
            </Button>
          </div>
        </div>
      </div>
      <div className="px-6 sm:px-8 py-5 sm:py-6 space-y-4">
        <div className="space-y-2">
          <Label>Domain</Label>
          <Select value={selectedDomainId} onValueChange={setSelectedDomainId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a domain" />
            </SelectTrigger>
            <SelectContent>
              {domains.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.domain}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!selectedDomainId ? (
          <p className="text-sm text-muted-foreground">Select a domain to manage its cache settings.</p>
        ) : loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <Label className="text-sm font-medium">FastCGI Cache</Label>
                <p className="text-xs text-muted-foreground">
                  <Badge variant={enabled ? "default" : "secondary"} className="mr-1.5">
                    {enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={enabled} onCheckedChange={handleToggle} disabled={toggling} />
                <Button variant="outline" size="sm" onClick={handlePurge} disabled={purging || !enabled}>
                  {purging ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Trash2 className="h-3 w-3 mr-1.5" />}
                  Purge Cache
                </Button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">Excluded Paths</h3>
              {excludedPaths.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Path</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {excludedPaths.map((p) => (
                      <TableRow key={p}>
                        <TableCell className="font-mono text-sm">{p}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemovePath(p)} disabled={removingPath === p}>
                            {removingPath === p ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5 text-destructive" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-xs text-muted-foreground">No excluded paths configured.</p>
              )}
              <div className="flex items-center gap-2 mt-3">
                <Input placeholder="/wp-admin/" value={newPath} onChange={(e) => setNewPath(e.target.value)} className="h-9" />
                <Button size="sm" onClick={handleAddPath} disabled={addingPath || !newPath.trim()}>
                  {addingPath ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Plus className="h-3 w-3 mr-1.5" />}
                  Add
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
