import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { RefreshCw, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  listIPv6Pools,
  listIPv6Ranges,
  createIPv6Range,
  deleteIPv6Range,
  type IPAMIPv6Range,
  type IPAMIPv6Pool,
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
                      <TableHead className="w-[50px]" />
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
                            {r.instanceId || <span className="text-muted-foreground">Unassigned</span>}
                          </TableCell>
                          <TableCell className="text-sm">{r.region}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {r.routeTarget || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.created ? new Date(r.created).toLocaleDateString() : "-"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => setDeleteTarget(r.range)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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
