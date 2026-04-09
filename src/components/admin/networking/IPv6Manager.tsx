import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Plus, RefreshCw, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createIPv6Range,
  deleteIPv6Range,
  listIPv6Pools,
  listIPv6Ranges,
  type IPAMIPv6Pool,
  type IPAMIPv6Range,
} from "@/services/ipamService";
import { IPv6RangeRdnsEditor } from "./IPv6RangeRdnsEditor";

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

  const [createOpen, setCreateOpen] = useState(false);
  const [prefixLength, setPrefixLength] = useState(64);
  const [instanceId, setInstanceId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [rdnsTarget, setRdnsTarget] = useState<IPAMIPv6Range | null>(null);

  const rangesQuery = useQuery<IPAMIPv6Range[]>({
    queryKey: ["admin", "networking", "ipv6-ranges"],
    queryFn: async () => {
      const result = await listIPv6Ranges();
      if (!result.success || !result.data) throw new Error(result.error || "Failed to load ranges");
      return result.data;
    },
  });

  const poolsQuery = useQuery<IPAMIPv6Pool[]>({
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
      return (json.servers || []).map((server: any) => ({
        id: server.id,
        label: server.label,
        provider_instance_id: server.provider_instance_id,
      }));
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { prefixLength: number; instanceId?: string }) => {
      const result = await createIPv6Range(payload.prefixLength, payload.instanceId);
      if (!result.success) throw new Error(result.error || "Failed to create IPv6 range");
      return result;
    },
    onSuccess: () => {
      toast.success("IPv6 range created");
      setCreateOpen(false);
      setInstanceId("");
      setPrefixLength(64);
      queryClient.invalidateQueries({ queryKey: ["admin", "networking", "ipv6-ranges"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "networking", "ips"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (range: string) => deleteIPv6Range(range),
    onSuccess: () => {
      toast.success("IPv6 range deleted");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "networking", "ipv6-ranges"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "networking", "ips"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete range"),
  });

  const ranges = rangesQuery.data ?? [];
  const pools = poolsQuery.data ?? [];
  const loading = rangesQuery.isLoading || poolsQuery.isLoading;

  const rangesError =
    rangesQuery.error instanceof Error ? rangesQuery.error.message : null;
  const poolsError =
    poolsQuery.error instanceof Error ? poolsQuery.error.message : null;

  const handleRefresh = () => {
    rangesQuery.refetch();
    poolsQuery.refetch();
  };

  const renderRangeInstanceCell = (instance: IPAMIPv6Range) => {
    if (instance.instanceIds.length > 0) {
      const joined = instance.instanceIds.join(", ");
      return (
        <span className="block max-w-[220px] truncate" title={joined}>
          {joined}
        </span>
      );
    }
    return instance.instanceId || <span className="text-muted-foreground">Unassigned</span>;
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
                <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />
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
                    {rangesQuery.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                          Loading IPv6 ranges...
                        </TableCell>
                      </TableRow>
                    ) : rangesError ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-destructive">
                          {rangesError}
                        </TableCell>
                      </TableRow>
                    ) : ranges.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                          No IPv6 ranges found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      ranges.map((range) => (
                        <TableRow key={`${range.range}-${range.prefixLength}`}>
                          <TableCell className="font-mono text-sm">{range.range}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">/{range.prefixLength}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {renderRangeInstanceCell(range)}
                          </TableCell>
                          <TableCell className="text-sm">{range.region}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {range.routeTarget || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="text-sm">
                            {range.created ? new Date(range.created).toLocaleDateString() : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Manage sub-address reverse DNS"
                                onClick={() => setRdnsTarget(range)}
                              >
                                <Settings2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                title="Delete range"
                                onClick={() => setDeleteTarget(range.range)}
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
              <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
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
                    {poolsQuery.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                          Loading IPv6 pools...
                        </TableCell>
                      </TableRow>
                    ) : poolsError ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-destructive">
                          {poolsError}
                        </TableCell>
                      </TableRow>
                    ) : pools.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                          No IPv6 pools found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pools.map((pool) => (
                        <TableRow key={`${pool.range}-${pool.prefixLength}`}>
                          <TableCell className="font-mono text-sm">{pool.range}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">/{pool.prefixLength}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {pool.instanceId || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="text-sm">{pool.region}</TableCell>
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create IPv6 Range</DialogTitle>
            <DialogDescription>
              Allocate a new IPv6 range. Optionally assign it to a VPS instance.
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
                onChange={(event) => setPrefixLength(Number(event.target.value))}
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
                  {instances.map((instance) => (
                    <SelectItem key={instance.provider_instance_id} value={instance.provider_instance_id}>
                      {instance.label} ({instance.provider_instance_id})
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
            <Button
              onClick={() => createMutation.mutate({ prefixLength, instanceId: instanceId || undefined })}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create Range"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rdnsTarget} onOpenChange={(open) => !open && setRdnsTarget(null)}>
        <DialogContent className="sm:max-w-2xl">
          {rdnsTarget ? (
            <>
              <DialogHeader>
                <DialogTitle>IPv6 range reverse DNS</DialogTitle>
                <DialogDescription>
                  Manage custom reverse DNS records for addresses within{" "}
                  <span className="font-mono text-foreground">
                    {rdnsTarget.range}/{rdnsTarget.prefixLength}
                  </span>
                  .
                </DialogDescription>
              </DialogHeader>
              <IPv6RangeRdnsEditor
                prefixes={[
                  {
                    range: rdnsTarget.range,
                    prefixLength: rdnsTarget.prefixLength,
                    region: rdnsTarget.region,
                    routeTarget: rdnsTarget.routeTarget,
                  },
                ]}
                onSaved={() => {
                  queryClient.invalidateQueries({ queryKey: ["admin", "networking", "ips"] });
                }}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setRdnsTarget(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
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
