import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, Plus, Trash2, FileEdit } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface HtaccessChain {
  lineNumber: number;
  conds: { testString: string; condPattern: string; flags: string[] }[];
  rule: { pattern: string; substitution: string; flags: string[] };
}

interface WebserverRewrite {
  path: string;
  destinationFile: string;
}

interface Props {
  subscriptionId: string;
  domains: Domain[];
  mode?: "htaccess" | "webserver" | "both";
}

export default function RewritesCard({ subscriptionId, domains, mode = "both" }: Props) {
  const [htaccessChains, setHtaccessChains] = useState<HtaccessChain[]>([]);
  const [webserverRewrites, setWebserverRewrites] = useState<WebserverRewrite[]>([]);
  const [loadingHt, setLoadingHt] = useState(true);
  const [loadingWs, setLoadingWs] = useState(false);
  const [selectedDomainId, setSelectedDomainId] = useState<string>("");
  const [newHtaccessPattern, setNewHtaccessPattern] = useState("");
  const [newHtaccessSubstitution, setNewHtaccessSubstitution] = useState("");
  const [newHtaccessFlags, setNewHtaccessFlags] = useState("L");
  const [newRewritePath, setNewRewritePath] = useState("");
  const [newRewriteDest, setNewRewriteDest] = useState("");
  const [saving, setSaving] = useState(false);

  const htBase = `/hosting/web/${subscriptionId}/htaccess`;
  const wsBase = `/hosting/web/${subscriptionId}/domains/${selectedDomainId}/webserver-rewrites`;
  const showHtaccess = mode === "htaccess" || mode === "both";
  const showWebserver = mode === "webserver" || mode === "both";

  const loadHtaccess = useCallback(async () => {
    if (!showHtaccess) return;
    setLoadingHt(true);
    try {
      const data = await apiClient.get<{ items: HtaccessChain[] }>(htBase);
      setHtaccessChains(data?.items ?? []);
    } catch {
      setHtaccessChains([]);
    } finally {
      setLoadingHt(false);
    }
  }, [htBase, showHtaccess]);

  const loadWebserver = useCallback(async () => {
    if (!showWebserver || !selectedDomainId) return;
    setLoadingWs(true);
    try {
      const data = await apiClient.get<{ rewrites: WebserverRewrite[] }>(wsBase);
      setWebserverRewrites(data?.rewrites ?? []);
    } catch {
      setWebserverRewrites([]);
    } finally {
      setLoadingWs(false);
    }
  }, [wsBase, selectedDomainId, showWebserver]);

  useEffect(() => { if (showHtaccess) loadHtaccess(); }, [loadHtaccess, showHtaccess]);
  useEffect(() => { if (showWebserver && selectedDomainId) loadWebserver(); }, [selectedDomainId, loadWebserver, showWebserver]);
  useEffect(() => {
    if (showWebserver && domains.length > 0 && !selectedDomainId) setSelectedDomainId(domains[0].id);
  }, [domains, selectedDomainId, showWebserver]);

  const handleDeleteChain = async (lineNumber: number) => {
    if (!confirm("Delete this rewrite chain?")) return;
    setSaving(true);
    try {
      await apiClient.patch(htBase, { items: [{ lineNumber }] });
      toast.success("Rewrite chain deleted");
      await loadHtaccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete chain");
    } finally {
      setSaving(false);
    }
  };

  const handleAddHtaccessRewrite = async () => {
    if (!newHtaccessPattern.trim() || !newHtaccessSubstitution.trim()) return;
    const nextLineNumber = htaccessChains.reduce((max, chain) => Math.max(max, chain.lineNumber), 0) + 1;
    const flags = newHtaccessFlags
      .split(/[\s,]+/)
      .map((flag) => flag.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      await apiClient.patch(htBase, {
        items: [{
          lineNumber: nextLineNumber,
          conds: [],
          rule: {
            pattern: newHtaccessPattern.trim(),
            substitution: newHtaccessSubstitution.trim(),
            flags,
          },
        }],
      });
      toast.success(".htaccess rewrite added");
      setNewHtaccessPattern("");
      setNewHtaccessSubstitution("");
      setNewHtaccessFlags("L");
      await loadHtaccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add .htaccess rewrite");
    } finally {
      setSaving(false);
    }
  };

  const handleAddWebserverRewrite = async () => {
    if (!newRewritePath.trim() || !newRewriteDest.trim()) return;
    setSaving(true);
    try {
      await apiClient.put(wsBase, { path: newRewritePath.trim(), destinationFile: newRewriteDest.trim() });
      toast.success("Webserver rewrite added");
      setNewRewritePath("");
      setNewRewriteDest("");
      await loadWebserver();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add rewrite");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWebserverRewrite = async (path: string) => {
    setSaving(true);
    try {
      await apiClient.delete(`${wsBase}?path=${encodeURIComponent(path)}`);
      toast.success("Rewrite deleted");
      await loadWebserver();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete rewrite");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl cyber-card cyber-card--hover">
      <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
              <FileEdit className="h-5 w-5 text-primary" />
              <span>URL Rewrites</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {mode === "webserver" ? "Manage Enhance webserver rewrites for Nginx domains." : "Manage documented .htaccess rewrite rules for this website."}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { if (showHtaccess) loadHtaccess(); if (showWebserver && selectedDomainId) loadWebserver(); }}>
            <RefreshCw className="h-3 w-3 mr-1.5" />Refresh
          </Button>
        </div>
      </div>
      <div className="px-6 sm:px-8 py-5 sm:py-6 space-y-6">
        {showHtaccess && <div>
          <h3 className="text-sm font-medium mb-3">.htaccess Rewrite Rules</h3>
          {loadingHt ? (
            <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : htaccessChains.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Line</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Conditions</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {htaccessChains.map((chain) => (
                  <TableRow key={chain.lineNumber}>
                    <TableCell className="text-xs text-muted-foreground">{chain.lineNumber}</TableCell>
                    <TableCell className="font-mono text-xs">
                      <span className="text-blue-500">{chain.rule.pattern}</span>
                      {" → "}
                      <span className="text-green-500">{chain.rule.substitution}</span>
                      {chain.rule.flags.length > 0 && (
                        <Badge variant="secondary" className="ml-1.5 text-[10px]">{chain.rule.flags.join(",")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {chain.conds.length > 0 ? chain.conds.length + " condition(s)" : "—"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteChain(chain.lineNumber)} disabled={saving}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-xs text-muted-foreground">No .htaccess rewrite rules found.</p>
          )}
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_160px_auto] lg:items-end">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Pattern</Label>
              <Input placeholder="^old-path/?$" value={newHtaccessPattern} onChange={(event) => setNewHtaccessPattern(event.target.value)} className="h-9" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Substitution</Label>
              <Input placeholder="/new-path/" value={newHtaccessSubstitution} onChange={(event) => setNewHtaccessSubstitution(event.target.value)} className="h-9" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Flags</Label>
              <Input placeholder="L,R=301" value={newHtaccessFlags} onChange={(event) => setNewHtaccessFlags(event.target.value)} className="h-9" />
            </div>
            <Button size="sm" onClick={handleAddHtaccessRewrite} disabled={saving || !newHtaccessPattern.trim() || !newHtaccessSubstitution.trim()}>
              <Plus className="h-3 w-3 mr-1.5" />Add
            </Button>
          </div>
        </div>}

        {showWebserver && <div>
          <h3 className="text-sm font-medium mb-3">Webserver Rewrites</h3>
          <div className="mb-3">
            <Label className="text-xs">Domain</Label>
            <Select value={selectedDomainId} onValueChange={setSelectedDomainId}>
              <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Select domain" /></SelectTrigger>
              <SelectContent>
                {domains.map((d) => (<SelectItem key={d.id} value={d.id}>{d.domain}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          {!selectedDomainId ? null : loadingWs ? (
            <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              {webserverRewrites.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Path</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webserverRewrites.map((rw) => (
                      <TableRow key={rw.path}>
                        <TableCell className="font-mono text-sm">{rw.path}</TableCell>
                        <TableCell className="font-mono text-sm">{rw.destinationFile}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteWebserverRewrite(rw.path)} disabled={saving}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-xs text-muted-foreground mb-3">No webserver rewrites found.</p>
              )}
              <div className="flex items-end gap-2 mt-3">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Path</Label>
                  <Input placeholder="/old-path" value={newRewritePath} onChange={(e) => setNewRewritePath(e.target.value)} className="h-9" />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Destination File</Label>
                  <Input placeholder="/new-path/index.html" value={newRewriteDest} onChange={(e) => setNewRewriteDest(e.target.value)} className="h-9" />
                </div>
                <Button size="sm" onClick={handleAddWebserverRewrite} disabled={saving || !newRewritePath.trim() || !newRewriteDest.trim()}>
                  <Plus className="h-3 w-3 mr-1.5" />Add
                </Button>
              </div>
            </>
          )}
        </div>}
      </div>
    </section>
  );
}
