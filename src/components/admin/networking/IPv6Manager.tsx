import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Search, Settings2, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  listIPv6Pools,
  listIPv6Ranges,
  createIPv6Range,
  deleteIPv6Range,
  getIPv6RangeRdnsRecords,
  updateIPv6RangeRdns,
  type IPAMIPv6Range,
  type IPAMIPv6Pool,
  type IPv6RangeRdnsVpsRow,
} from "@/services/ipamService";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

interface VPSInstance {
  id: string;
  label: string;
  provider_instance_id: string;
}

export function IPv6Manager() {
  const queryClient = useQueryClient();

  // Create range dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [prefixLength, setPrefixLength] = useState(64);
  const [instanceId, setInstanceId] = useState("");

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // IPv6 range sub-address rDNS (admin)
  const [rdnsDialog, setRdnsDialog] = useState<{
    open: boolean;
    range: string;
    prefixLength: number;
    ipAddress: string;
    domain: string;
    saving: boolean;
    deletingAddress: string | null;
    existingRecords: Array<{ address: string; rdns: string }>;
    loadingRecords: boolean;
    recordsFilter: string;
    recordsPage: number;
    vpsInstances: IPv6RangeRdnsVpsRow[];
  } | null>(null);

  const {
    data: ranges = [],
    isLoading: rangesLoading,
    refetch: refetchRanges,
  } = useQuery<IPAMIPv6Range[]>({
    queryKey: ["admin", "networking", "ipv6-ranges"],
    queryFn: async () => {
      const result = await listIPv6Ranges();
      if (!result.success || !result.data) throw new Error(result.error || "Failed to load ranges");
      return result.data;
    },
  });

  const {
    data: pools = [],
    isLoading: poolsLoading,
    refetch: refetchPools,
  } = useQuery<IPAMIPv6Pool[]>({
    queryKey: ["admin", "networking", "ipv6-pools"],
    queryFn: async () => {
      const result = await listIPv6Pools();
      if (!result.success || !result.data) throw new Error(result.error || "Failed to load pools");
      return result.data;
    },
  });

  const { data: instances = [] } = useQuery<VPSInstance[]>({
    queryKey: ["admin", "servers-for-ipv6"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/admin/servers`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load instances");
      return (json.servers || []).map((s: any) => ({
        id: s.id,
        label: s.label,
        provider_instance_id: s.provider_instance_id,
      }));
    },
  });

  const loading = rangesLoading || poolsLoading;

  const createMutation = useMutation({
    mutationFn: async (data: { prefixLength: number; instanceId?: string }) => {
      const result = await createIPv6Range(data.prefixLength, data.instanceId);
      if (!result.success) throw new Error(result.error || "Failed to create IPv6 range");
      return result;
    },
    onSuccess: () => {
      toast.success("IPv6 range created");
      setCreateOpen(false);
      setInstanceId("");
      setPrefixLength(64);
      queryClient.invalidateQueries({ queryKey: ["admin", "networking", "ipv6-ranges"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (range: string) => deleteIPv6Range(range),
    onSuccess: () => {
      toast.success("IPv6 range deleted");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "networking", "ipv6-ranges"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete range"),
  });

  const handleRefresh = () => {
    refetchRanges();
    refetchPools();
  };

  const openRangeRdnsDialog = async (range: string, prefixLength: number) => {
    const defaultAddress = range.endsWith("::") ? `${range}1` : `${range}::1`;
    setRdnsDialog({
      open: true,
      range,
      prefixLength,
      ipAddress: defaultAddress,
      domain: "",
      saving: false,
      deletingAddress: null,
      existingRecords: [],
      loadingRecords: true,
      recordsFilter: "",
      recordsPage: 0,
      vpsInstances: [],
    });
    try {
      const result = await getIPv6RangeRdnsRecords(range, prefixLength);
      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to load rDNS records");
      }
      setRdnsDialog((prev) =>
        prev && prev.range === range && prev.prefixLength === prefixLength
          ? {
              ...prev,
              existingRecords: result.data!.records,
              vpsInstances: result.data!.vpsInstances,
              loadingRecords: false,
            }
          : prev,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load rDNS records";
      toast.error(msg);
      setRdnsDialog((prev) => (prev ? { ...prev, loadingRecords: false } : prev));
    }
  };

  const saveRangeRdns = async () => {
    if (!rdnsDialog) return;
    const { range, prefixLength, ipAddress, domain } = rdnsDialog;
    if (!ipAddress.trim()) {
      toast.error("An IPv6 address is required");
      return;
    }
    setRdnsDialog((prev) => (prev ? { ...prev, saving: true } : prev));
    const trimmedAddr = ipAddress.trim();
    const trimmedDomain = domain.trim();
    const result = await updateIPv6RangeRdns(range, prefixLength, trimmedAddr, trimmedDomain.length > 0 ? trimmedDomain : null);
    if (!result.success) {
      toast.error(result.error || "Failed to update reverse DNS");
      setRdnsDialog((prev) => (prev ? { ...prev, saving: false } : prev));
      return;
    }
    toast.success("Reverse DNS updated");
    setRdnsDialog((prev) =>
      prev
        ? {
            ...prev,
            saving: false,
            domain: "",
            existingRecords: trimmedDomain
              ? [
                  ...prev.existingRecords.filter((r) => r.address !== trimmedAddr),
                  { address: trimmedAddr, rdns: trimmedDomain },
                ]
              : prev.existingRecords.filter((r) => r.address !== trimmedAddr),
          }
        : prev,
    );
  };

  const clearRangeRdnsRecord = async (address: string) => {
    if (!rdnsDialog) return;
    setRdnsDialog((prev) => (prev ? { ...prev, deletingAddress: address } : prev));
    const result = await updateIPv6RangeRdns(rdnsDialog.range, rdnsDialog.prefixLength, address, null);
    if (!result.success) {
      toast.error(result.error || "Failed to clear reverse DNS");
      setRdnsDialog((prev) => (prev ? { ...prev, deletingAddress: null } : prev));
      return;
    }
    toast.success("Reverse DNS cleared");
    setRdnsDialog((prev) =>
      prev
        ? {
            ...prev,
            deletingAddress: null,
            existingRecords: prev.existingRecords.filter((r) => r.address !== address),
            recordsPage: 0,
          }
        : prev,
    );
  };

  const renderRangeInstanceCell = (instanceId: string | null, instanceIds: string[]) => {
    if (instanceIds.length > 0) {
      const joined = instanceIds.join(", ");
      return (
        <span className="block max-w-[220px] truncate" title={joined}>
          {joined}
        </span>
      );
    }

    return instanceId || <span className="text-muted-foreground">Unassigned</span>;
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="ranges">
        <TabsList>
          <TabsTrigger value="ranges">IPv6 Ranges</TabsTrigger>
          <TabsTrigger value="pools">IPv6 Pools</TabsTrigger>
        </TabsList>

        <TabsContent value="ranges" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">IPv6 Ranges</h3>
              <p className="text-sm text-muted-foreground">{ranges.length} ranges</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Create Range
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Range</TableHead>
                      <TableHead>Prefix</TableHead>
                      <TableHead>Instance</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>Route Target</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[100px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : ranges.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No IPv6 ranges found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      ranges.map((r) => (
                        <TableRow key={r.range}>
                          <TableCell className="font-mono text-sm">{r.range}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">/{r.prefixLength}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {renderRangeInstanceCell(r.instanceId, r.instanceIds)}
                          </TableCell>
                          <TableCell className="text-sm">{r.region}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {r.routeTarget || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.created ? new Date(r.created).toLocaleDateString() : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Manage sub-address reverse DNS"
                                onClick={() => openRangeRdnsDialog(r.range, r.prefixLength)}
                              >
                                <Settings2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                title="Delete range"
                                onClick={() => setDeleteTarget(r.range)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pools" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">IPv6 Pools</h3>
              <p className="text-sm text-muted-foreground">{pools.length} pools (read-only)</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Range</TableHead>
                      <TableHead>Prefix</TableHead>
                      <TableHead>Instance</TableHead>
                      <TableHead>Region</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : pools.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No IPv6 pools found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pools.map((p) => (
                        <TableRow key={p.range}>
                          <TableCell className="font-mono text-sm">{p.range}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">/{p.prefixLength}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {p.instanceId || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="text-sm">{p.region}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Range Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create IPv6 Range</DialogTitle>
            <DialogDescription>
              Allocate a new IPv6 range. Optionally assign to a VPS instance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="prefix-length">Prefix Length</Label>
              <Input
                id="prefix-length"
                type="number"
                min={56}
                max={64}
                value={prefixLength}
                onChange={(e) => setPrefixLength(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Between /56 and /64</p>
            </div>
            <div className="space-y-2">
              <Label>Target Instance (optional)</Label>
              <Select value={instanceId} onValueChange={setInstanceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select instance..." />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((inst) => (
                    <SelectItem key={inst.provider_instance_id} value={inst.provider_instance_id}>
                      {inst.label} ({inst.provider_instance_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => createMutation.mutate({ prefixLength, instanceId: instanceId || undefined })} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Range"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin IPv6 range rDNS (sub-addresses within /64, etc.) */}
      <Dialog
        open={!!rdnsDialog?.open}
        onOpenChange={(open) => {
          if (!open && !rdnsDialog?.saving) {
            setRdnsDialog(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {rdnsDialog && (
            <>
              <DialogHeader>
                <DialogTitle>IPv6 range reverse DNS</DialogTitle>
                <DialogDescription>
                  Set custom reverse DNS for addresses within{" "}
                  <span className="font-mono text-foreground">
                    {rdnsDialog.range}/{rdnsDialog.prefixLength}
                  </span>
                  . Only addresses assigned to the linked panel VPS can be updated.
                </DialogDescription>
              </DialogHeader>
              {rdnsDialog.vpsInstances.length === 0 && !rdnsDialog.loadingRecords ? (
                <p className="text-sm text-muted-foreground py-2">
                  No panel VPS is linked to this range in Linode, or the range could not be loaded. Sub-address rDNS
                  requires a VPS attached to the range.
                </p>
              ) : null}
              {rdnsDialog.vpsInstances.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Linked VPS:{" "}
                  {rdnsDialog.vpsInstances.map((v) => `${v.label} (${v.provider_instance_id})`).join(", ")}
                </p>
              ) : null}
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="admin-ipv6-rdns-address">IPv6 address</Label>
                  <Input
                    id="admin-ipv6-rdns-address"
                    value={rdnsDialog.ipAddress}
                    onChange={(e) =>
                      setRdnsDialog((prev) => (prev ? { ...prev, ipAddress: e.target.value } : prev))
                    }
                    placeholder={`${rdnsDialog.range}1`}
                    className="font-mono text-sm"
                    disabled={rdnsDialog.saving || rdnsDialog.vpsInstances.length === 0}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-ipv6-rdns-domain">Domain name</Label>
                  <Input
                    id="admin-ipv6-rdns-domain"
                    value={rdnsDialog.domain}
                    onChange={(e) =>
                      setRdnsDialog((prev) => (prev ? { ...prev, domain: e.target.value } : prev))
                    }
                    placeholder="mail.example.com"
                    disabled={rdnsDialog.saving || rdnsDialog.vpsInstances.length === 0}
                  />
                  <p className="text-xs text-muted-foreground">Leave blank to clear rDNS for the address.</p>
                </div>
                {(rdnsDialog.loadingRecords || rdnsDialog.existingRecords.length > 0) && (() => {
                  const PAGE_SIZE = 5;
                  const filtered = rdnsDialog.existingRecords.filter(
                    (rec) =>
                      rdnsDialog.recordsFilter.trim() === "" ||
                      rec.address.toLowerCase().includes(rdnsDialog.recordsFilter.trim().toLowerCase()) ||
                      rec.rdns.toLowerCase().includes(rdnsDialog.recordsFilter.trim().toLowerCase()),
                  );
                  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
                  const page = Math.min(rdnsDialog.recordsPage, totalPages - 1);
                  const pageRecords = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
                  return (
                    <div className="border-t border-border pt-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">
                          Existing records
                          {!rdnsDialog.loadingRecords && (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                              ({filtered.length}
                              {rdnsDialog.recordsFilter ? " filtered" : ""})
                            </span>
                          )}
                        </p>
                      </div>
                      {rdnsDialog.loadingRecords ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Loading records…
                        </div>
                      ) : (
                        <>
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            <Input
                              value={rdnsDialog.recordsFilter}
                              onChange={(e) =>
                                setRdnsDialog((prev) =>
                                  prev ? { ...prev, recordsFilter: e.target.value, recordsPage: 0 } : prev,
                                )
                              }
                              placeholder="Filter by address or domain…"
                              className="pl-8 h-8 text-xs"
                            />
                          </div>
                          {pageRecords.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2">No records match your filter.</p>
                          ) : (
                            <ul className="space-y-1.5 max-h-[220px] overflow-y-auto">
                              {pageRecords.map((record) => {
                                const isDeleting = rdnsDialog.deletingAddress === record.address;
                                return (
                                  <li
                                    key={record.address}
                                    className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs group"
                                  >
                                    <button
                                      type="button"
                                      className="flex flex-col gap-0.5 text-left min-w-0 flex-1 hover:opacity-80 transition-opacity"
                                      title="Use this address"
                                      onClick={() =>
                                        setRdnsDialog((prev) =>
                                          prev
                                            ? { ...prev, ipAddress: record.address, domain: record.rdns }
                                            : prev,
                                        )
                                      }
                                    >
                                      <span className="font-mono font-semibold text-foreground truncate block">
                                        {record.address}
                                      </span>
                                      <span className="text-muted-foreground truncate block">{record.rdns}</span>
                                    </button>
                                    <button
                                      type="button"
                                      title="Clear rDNS"
                                      disabled={
                                        isDeleting || rdnsDialog.saving || rdnsDialog.deletingAddress !== null
                                      }
                                      onClick={() => clearRangeRdnsRecord(record.address)}
                                      className="flex-shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:border-destructive hover:text-destructive focus:outline-none focus:opacity-100 disabled:pointer-events-none disabled:opacity-40"
                                    >
                                      {isDeleting ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-3 w-3" />
                                      )}
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-xs text-muted-foreground">
                                Page {page + 1} of {totalPages}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={page === 0}
                                  onClick={() =>
                                    setRdnsDialog((prev) =>
                                      prev ? { ...prev, recordsPage: prev.recordsPage - 1 } : prev,
                                    )
                                  }
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40"
                                >
                                  <ChevronLeft className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={page >= totalPages - 1}
                                  onClick={() =>
                                    setRdnsDialog((prev) =>
                                      prev ? { ...prev, recordsPage: prev.recordsPage + 1 } : prev,
                                    )
                                  }
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40"
                                >
                                  <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setRdnsDialog(null)}
                  disabled={rdnsDialog.saving}
                >
                  Close
                </Button>
                <Button
                  onClick={saveRangeRdns}
                  disabled={
                    rdnsDialog.saving ||
                    !rdnsDialog.ipAddress.trim() ||
                    rdnsDialog.vpsInstances.length === 0
                  }
                >
                  {rdnsDialog.saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Range Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete IPv6 Range</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the range {deleteTarget}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
