import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listVLANs, deleteVLAN, type IPAMVLAN } from "@/services/ipamService";

export function VLANTable() {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<IPAMVLAN | null>(null);

  const {
    data: vlans = [],
    isLoading: loading,
    refetch,
  } = useQuery<IPAMVLAN[]>({
    queryKey: ["admin", "networking", "vlans"],
    queryFn: async () => {
      const result = await listVLANs();
      if (!result.success || !result.data) throw new Error(result.error || "Failed to load VLANs");
      return result.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (vlan: IPAMVLAN) => deleteVLAN(vlan.region, vlan.label),
    onSuccess: () => {
      toast.success("VLAN deleted");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "networking", "vlans"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete VLAN"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">VLANs</h3>
          <p className="text-sm text-muted-foreground">{vlans.length} VLANs</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading}>
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
                  <TableHead>Label</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Attached Instances</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : vlans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No VLANs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  vlans.map((vlan) => (
                    <TableRow key={`${vlan.region}-${vlan.label}`}>
                      <TableCell className="font-medium">{vlan.label}</TableCell>
                      <TableCell className="text-sm">{vlan.region}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {vlan.instanceIds.length > 0 ? (
                            vlan.instanceIds.map((id) => (
                              <Badge key={id} variant="secondary" className="font-mono text-xs">
                                {id}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">None</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {vlan.created ? new Date(vlan.created).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setDeleteTarget(vlan)}
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete VLAN</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete VLAN "{deleteTarget?.label}" in {deleteTarget?.region}?
              This will detach all instances from this VLAN.
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
