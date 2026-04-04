import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { MoreHorizontal, Pencil, Trash2, RefreshCw, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import {
  listIPs,
  deleteIPAddress,
  type IPAMIPAddress,
} from "@/services/ipamService";
import { EditRDNSDialog } from "./EditRDNSDialog";
import { AllocateIPDialog } from "./AllocateIPDialog";

export function IPAddressTable() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  // Dialogs
  const [rdnsDialog, setRdnsDialog] = useState<{ open: boolean; address: string; rdns: string | null }>({
    open: false,
    address: "",
    rdns: null,
  });
  const [deleteTarget, setDeleteTarget] = useState<IPAMIPAddress | null>(null);
  const [allocateOpen, setAllocateOpen] = useState(false);

  const {
    data: ipResult,
    isLoading: loading,
    refetch,
  } = useQuery({
    queryKey: ["admin", "networking", "ips", page],
    queryFn: async () => {
      const result = await listIPs(page, 100);
      if (!result.success) throw new Error(result.error || "Failed to load IPs");
      return { data: result.data ?? [], pages: result.pages ?? 1, total: result.total ?? 0 };
    },
  });

  const totalPages = ipResult?.pages ?? 1;
  const total = ipResult?.total ?? 0;

  // Filter IPs by search term
  const filteredIps = useMemo(() => {
    const ips = ipResult?.data ?? [];
    if (!search.trim()) return ips;
    const term = search.toLowerCase();
    return ips.filter(
      (ip) =>
        ip.address.toLowerCase().includes(term) ||
        (ip.instanceId?.toLowerCase().includes(term) ?? false) ||
        ip.region.toLowerCase().includes(term) ||
        (ip.rdns?.toLowerCase().includes(term) ?? false)
    );
  }, [ipResult?.data, search]);

  const deleteMutation = useMutation({
    mutationFn: (ip: IPAMIPAddress) => deleteIPAddress(ip.instanceId ?? "", ip.address),
    onSuccess: () => {
      toast.success("IP address deleted");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "networking", "ips"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete IP"),
  });

  const ipv4Count = filteredIps.filter((ip) => ip.type === "ipv4").length;
  const ipv6Count = filteredIps.filter((ip) => ip.type !== "ipv4").length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total IPs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
            <p className="text-xs text-muted-foreground mt-1">Allocated addresses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">IPv4</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ipv4Count}</div>
            <p className="text-xs text-muted-foreground mt-1">{search ? "Matching" : "On this page"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">IPv6</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ipv6Count}</div>
            <p className="text-xs text-muted-foreground mt-1">{search ? "Matching" : "On this page"}</p>
          </CardContent>
        </Card>
      </div>

      {/* IP Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">IP Addresses</CardTitle>
              <CardDescription>Manage IP addresses across all instances</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button size="sm" onClick={() => setAllocateOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Allocate IP
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search / Filter */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter by address, instance, region, or rDNS..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Address</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Public</TableHead>
                  <TableHead>Reverse DNS</TableHead>
                  <TableHead>Instance</TableHead>
                  <TableHead>Region</TableHead>
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
                ) : filteredIps.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {search ? "No matching IP addresses." : "No IP addresses found."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredIps.map((ip) => (
                    <TableRow key={ip.address}>
                      <TableCell className="font-mono text-sm">{ip.address}</TableCell>
                      <TableCell>
                        <Badge variant={ip.type === "ipv4" ? "default" : "secondary"}>
                          {ip.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ip.public ? "default" : "outline"}>
                          {ip.public ? "Public" : "Private"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate" title={ip.rdns ?? undefined}>
                        {ip.rdns || <span className="text-muted-foreground">Not set</span>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {ip.instanceId || <span className="text-muted-foreground">Unassigned</span>}
                      </TableCell>
                      <TableCell className="text-sm">{ip.region}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                setRdnsDialog({ open: true, address: ip.address, rdns: ip.rdns })
                              }
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit rDNS
                            </DropdownMenuItem>
                            {ip.public && ip.instanceId && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteTarget(ip)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete IP
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} ({total} total)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <EditRDNSDialog
        open={rdnsDialog.open}
        address={rdnsDialog.address}
        currentRdns={rdnsDialog.rdns}
        onClose={() => setRdnsDialog({ open: false, address: "", rdns: null })}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["admin", "networking", "ips"] })}
      />

      <AllocateIPDialog
        open={allocateOpen}
        onClose={() => setAllocateOpen(false)}
        onAllocated={() => queryClient.invalidateQueries({ queryKey: ["admin", "networking", "ips"] })}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete IP Address</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteTarget?.address}? This action cannot be undone.
              The instance will lose this IP address.
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
