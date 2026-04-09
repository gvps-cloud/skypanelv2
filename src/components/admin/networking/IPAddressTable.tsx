import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  deleteIPAddress,
  listIPs,
  listIPv6Pools,
  type IPAMIPAddress,
  type IPAMIPv6Pool,
  updateReverseDNS,
} from "@/services/ipamService";
import { Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AllocateIPDialog } from "./AllocateIPDialog";
import { IPv6RangeRdnsEditor } from "./IPv6RangeRdnsEditor";

type FamilyFilter = "all" | "ipv4" | "ipv6";
type ScopeFilter = "all" | "public" | "private";
type RdnsFilter = "all" | "with-rdns" | "without-rdns";
type PrefixContextFilter = "all" | "with-prefix" | "without-prefix";

function hasRdns(ip: IPAMIPAddress): boolean {
  return typeof ip.rdns === "string" && ip.rdns.trim().length > 0;
}

function hasPrefixContext(ip: IPAMIPAddress): boolean {
  return Array.isArray(ip.ipv6Prefixes) && ip.ipv6Prefixes.length > 0;
}

function getAddressFamily(ip: IPAMIPAddress): "ipv4" | "ipv6" {
  return ip.type === "ipv4" ? "ipv4" : "ipv6";
}

export function IPAddressTable() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [familyFilter, setFamilyFilter] = useState<FamilyFilter>("all");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [rdnsFilter, setRdnsFilter] = useState<RdnsFilter>("all");
  const [prefixContextFilter, setPrefixContextFilter] =
    useState<PrefixContextFilter>("all");
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IPAMIPAddress | null>(null);
  const [directRdns, setDirectRdns] = useState("");
  const [savingDirectRdns, setSavingDirectRdns] = useState(false);

  const ipsQuery = useQuery({
    queryKey: ["admin", "networking", "ips", page],
    queryFn: async () => {
      const result = await listIPs(page, 100);
      if (!result.success)
        throw new Error(result.error || "Failed to load IPs");
      return {
        data: result.data ?? [],
        pages: result.pages ?? 1,
        total: result.total ?? 0,
      };
    },
  });

  const poolsQuery = useQuery<IPAMIPv6Pool[]>({
    queryKey: ["admin", "networking", "ipv6-pools"],
    queryFn: async () => {
      const result = await listIPv6Pools();
      if (!result.success || !result.data)
        throw new Error(result.error || "Failed to load pools");
      return result.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (ip: IPAMIPAddress) =>
      deleteIPAddress(ip.instanceId ?? "", ip.address),
    onSuccess: () => {
      toast.success("IP address deleted");
      setDeleteTarget(null);
      queryClient.invalidateQueries({
        queryKey: ["admin", "networking", "ips"],
      });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to delete IP"),
  });

  const allIps = useMemo(
    () => ipsQuery.data?.data ?? [],
    [ipsQuery.data?.data],
  );
  const totalPages = ipsQuery.data?.pages ?? 1;
  const total = ipsQuery.data?.total ?? 0;

  const filteredIps = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allIps.filter((ip) => {
      if (term) {
        const searchable = [
          ip.address,
          ip.instanceId ?? "",
          ip.region,
          ip.rdns ?? "",
          ip.vpsLabel ?? "",
          ip.vpsId ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(term)) return false;
      }

      if (familyFilter !== "all" && getAddressFamily(ip) !== familyFilter)
        return false;
      if (
        scopeFilter !== "all" &&
        (scopeFilter === "public" ? !ip.public : ip.public)
      )
        return false;
      if (
        rdnsFilter !== "all" &&
        (rdnsFilter === "with-rdns" ? !hasRdns(ip) : hasRdns(ip))
      )
        return false;
      if (
        prefixContextFilter !== "all" &&
        (prefixContextFilter === "with-prefix"
          ? !hasPrefixContext(ip)
          : hasPrefixContext(ip))
      ) {
        return false;
      }

      return true;
    });
  }, [
    allIps,
    familyFilter,
    prefixContextFilter,
    rdnsFilter,
    scopeFilter,
    search,
  ]);

  useEffect(() => {
    if (filteredIps.length === 0) {
      setSelectedAddress(null);
      return;
    }
    if (
      !selectedAddress ||
      !filteredIps.some((ip) => ip.address === selectedAddress)
    ) {
      setSelectedAddress(filteredIps[0].address);
    }
  }, [filteredIps, selectedAddress]);

  const selectedIp = useMemo(
    () => filteredIps.find((ip) => ip.address === selectedAddress) ?? null,
    [filteredIps, selectedAddress],
  );

  useEffect(() => {
    setDirectRdns(selectedIp?.rdns ?? "");
  }, [selectedIp?.address, selectedIp?.rdns]);

  const ipv4Count = filteredIps.filter(
    (ip) => getAddressFamily(ip) === "ipv4",
  ).length;
  const ipv6Count = filteredIps.filter(
    (ip) => getAddressFamily(ip) === "ipv6",
  ).length;
  const prefixContextCount = filteredIps.filter((ip) =>
    hasPrefixContext(ip),
  ).length;
  const ipsError =
    ipsQuery.error instanceof Error ? ipsQuery.error.message : null;

  const saveDirectRdns = async (overrideValue?: string) => {
    if (!selectedIp) return;
    setSavingDirectRdns(true);
    const trimmed = (overrideValue ?? directRdns).trim();
    const result = await updateReverseDNS(
      selectedIp.address,
      trimmed.length > 0 ? trimmed : null,
    );
    setSavingDirectRdns(false);

    if (!result.success) {
      toast.error(result.error || "Failed to update reverse DNS");
      return;
    }

    toast.success(trimmed ? "Reverse DNS updated" : "Reverse DNS cleared");
    queryClient.invalidateQueries({ queryKey: ["admin", "networking", "ips"] });
  };

  return (
    <Tabs defaultValue="ips" className="w-full">
      <TabsList>
        <TabsTrigger value="ips">IP Addresses</TabsTrigger>
        <TabsTrigger value="pools">IPv6 Pools</TabsTrigger>
      </TabsList>

      <TabsContent value="ips" className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total IPs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{total}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Allocated addresses
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">IPv4</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{ipv4Count}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {search ? "Matching" : "On this page"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">IPv6</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{ipv6Count}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {search ? "Matching" : "On this page"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                IPv6 Prefix Context
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{prefixContextCount}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Rows with prefix metadata
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(360px,1fr)]">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">IP Addresses</CardTitle>
                  <CardDescription>
                    Data-dense operations view for address inventory and rDNS
                    actions.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => ipsQuery.refetch()}
                    disabled={ipsQuery.isFetching}
                  >
                    <RefreshCw
                      className={`mr-1 h-4 w-4 ${ipsQuery.isFetching ? "animate-spin" : ""}`}
                    />
                    Refresh
                  </Button>
                  <Button size="sm" onClick={() => setAllocateOpen(true)}>
                    <Plus className="mr-1 h-4 w-4" />
                    Allocate IP
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Filter by address, instance, region, or rDNS..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                <FilterChipGroup
                  label="Family"
                  options={[
                    { value: "all", label: "All" },
                    { value: "ipv4", label: "IPv4" },
                    { value: "ipv6", label: "IPv6" },
                  ]}
                  selected={familyFilter}
                  onChange={(value) => setFamilyFilter(value as FamilyFilter)}
                />
                <FilterChipGroup
                  label="Scope"
                  options={[
                    { value: "all", label: "All" },
                    { value: "public", label: "Public" },
                    { value: "private", label: "Private" },
                  ]}
                  selected={scopeFilter}
                  onChange={(value) => setScopeFilter(value as ScopeFilter)}
                />
                <FilterChipGroup
                  label="rDNS"
                  options={[
                    { value: "all", label: "All" },
                    { value: "with-rdns", label: "Has rDNS" },
                    { value: "without-rdns", label: "No rDNS" },
                  ]}
                  selected={rdnsFilter}
                  onChange={(value) => setRdnsFilter(value as RdnsFilter)}
                />
                <FilterChipGroup
                  label="Prefix"
                  options={[
                    { value: "all", label: "All" },
                    { value: "with-prefix", label: "Has Prefix Context" },
                    { value: "without-prefix", label: "No Prefix Context" },
                  ]}
                  selected={prefixContextFilter}
                  onChange={(value) =>
                    setPrefixContextFilter(value as PrefixContextFilter)
                  }
                />
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Address</TableHead>
                      <TableHead>Family</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Reverse DNS</TableHead>
                      <TableHead>Prefix Context</TableHead>
                      <TableHead>Instance</TableHead>
                      <TableHead>Region</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ipsQuery.isLoading ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="py-8 text-center text-muted-foreground"
                        >
                          Loading IP inventory...
                        </TableCell>
                      </TableRow>
                    ) : ipsError ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="py-8 text-center text-destructive"
                        >
                          {ipsError}
                        </TableCell>
                      </TableRow>
                    ) : filteredIps.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="py-8 text-center text-muted-foreground"
                        >
                          {search
                            ? "No matching IP addresses."
                            : "No IP addresses found."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredIps.map((ip) => {
                        const selected = ip.address === selectedAddress;
                        const family = getAddressFamily(ip);
                        return (
                          <TableRow
                            key={ip.address}
                            className={cn(
                              "cursor-pointer",
                              selected && "bg-muted/60",
                            )}
                            onClick={() => setSelectedAddress(ip.address)}
                          >
                            <TableCell className="font-mono text-sm">
                              {ip.address}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  family === "ipv4" ? "default" : "secondary"
                                }
                              >
                                {family}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={ip.public ? "default" : "outline"}
                              >
                                {ip.public ? "Public" : "Private"}
                              </Badge>
                            </TableCell>
                            <TableCell
                              className="max-w-[230px] truncate text-sm"
                              title={ip.rdns ?? undefined}
                            >
                              {hasRdns(ip) ? (
                                ip.rdns
                              ) : (
                                <span className="text-muted-foreground">
                                  Not set
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {hasPrefixContext(ip) ? (
                                <Badge variant="secondary">
                                  {ip.ipv6Prefixes!.length} prefix
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">
                                  None
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="space-y-1">
                                <div className="font-mono">
                                  {ip.instanceId || "Unassigned"}
                                </div>
                                {ip.vpsLabel ? (
                                  <div
                                    className="max-w-[180px] truncate text-muted-foreground"
                                    title={ip.vpsLabel}
                                  >
                                    {ip.vpsLabel}
                                  </div>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {ip.region}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} ({total} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() =>
                        setPage((previous) => Math.max(1, previous - 1))
                      }
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((previous) => previous + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Action Panel</CardTitle>
              <CardDescription>
                {selectedIp
                  ? "Selected row actions and reverse DNS controls."
                  : "Select an address row to inspect and apply changes."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedIp ? (
                <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No row selected.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                    <div className="font-mono text-sm">
                      {selectedIp.address}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant={
                          getAddressFamily(selectedIp) === "ipv4"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {getAddressFamily(selectedIp)}
                      </Badge>
                      <Badge
                        variant={selectedIp.public ? "default" : "outline"}
                      >
                        {selectedIp.public ? "Public" : "Private"}
                      </Badge>
                      {selectedIp.instanceId ? (
                        <Badge variant="outline" className="font-mono">
                          {selectedIp.instanceId}
                        </Badge>
                      ) : null}
                    </div>
                    {selectedIp.vpsLabel ? (
                      <p className="text-xs text-muted-foreground">
                        VPS: {selectedIp.vpsLabel}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="direct-rdns">Reverse DNS hostname</Label>
                      <Input
                        id="direct-rdns"
                        value={directRdns}
                        onChange={(event) => setDirectRdns(event.target.value)}
                        placeholder="host.example.com"
                        disabled={savingDirectRdns}
                      />
                      <p className="text-xs text-muted-foreground">
                        Direct address-level rDNS editing for IPv4 and the
                        primary IPv6 interface (SLAAC) address.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => void saveDirectRdns()}
                        disabled={savingDirectRdns}
                      >
                        {savingDirectRdns ? "Saving..." : "Save rDNS"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setDirectRdns("");
                          void saveDirectRdns("");
                        }}
                        disabled={savingDirectRdns}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  {getAddressFamily(selectedIp) === "ipv6" &&
                    hasPrefixContext(selectedIp) && (
                      <div className="border-t pt-4">
                        <IPv6RangeRdnsEditor
                          prefixes={selectedIp.ipv6Prefixes!.map((prefix) => ({
                            range: prefix.range,
                            prefixLength: prefix.prefixLength,
                            region: prefix.region,
                            routeTarget: prefix.routeTarget,
                          }))}
                          title="Range-aware IPv6 reverse DNS"
                          description="Use range rDNS endpoints to edit sub-address records for the selected IPv6 prefix."
                          onSaved={() => {
                            queryClient.invalidateQueries({
                              queryKey: ["admin", "networking", "ips"],
                            });
                          }}
                        />
                      </div>
                    )}

                  {selectedIp.public && selectedIp.instanceId ? (
                    <div className="border-t pt-4">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteTarget(selectedIp)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete IP
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <AllocateIPDialog
        open={allocateOpen}
        onClose={() => setAllocateOpen(false)}
        onAllocated={() =>
          queryClient.invalidateQueries({
            queryKey: ["admin", "networking", "ips"],
          })
        }
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete IP Address</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteTarget?.address}? This
              action cannot be undone. The instance will lose this IP address.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget)
              }
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TabsContent value="pools" className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">IPv6 Pools</h3>
            <p className="text-sm text-muted-foreground">
              {poolsQuery.data?.length ?? 0} pools (read-only)
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => poolsQuery.refetch()}
            disabled={poolsQuery.isFetching}
          >
            <RefreshCw
              className={`mr-1 h-4 w-4 ${poolsQuery.isFetching ? "animate-spin" : ""}`}
            />
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
                      <TableCell
                        colSpan={4}
                        className="py-8 text-center text-muted-foreground"
                      >
                        Loading IPv6 pools...
                      </TableCell>
                    </TableRow>
                  ) : poolsQuery.error ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-8 text-center text-destructive"
                      >
                        {poolsQuery.error instanceof Error
                          ? poolsQuery.error.message
                          : "Failed to load pools"}
                      </TableCell>
                    </TableRow>
                  ) : !poolsQuery.data || poolsQuery.data.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No IPv6 pools found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    poolsQuery.data.map((pool) => (
                      <TableRow key={`${pool.range}-${pool.prefixLength}`}>
                        <TableCell className="font-mono text-sm">
                          {pool.range}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            /{pool.prefixLength}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {pool.instanceId || (
                            <span className="text-muted-foreground">-</span>
                          )}
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
  );
}

function FilterChipGroup({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {options.map((option) => (
        <Button
          key={option.value}
          variant="outline"
          size="sm"
          className={cn(
            "h-7 px-2 text-xs",
            selected === option.value &&
              "border-primary bg-primary/10 text-primary",
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
