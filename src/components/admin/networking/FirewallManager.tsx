import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Shield, MoreHorizontal, Pencil, Trash2, RefreshCw, Plus, Settings, BookTemplate } from "lucide-react";
import { toast } from "sonner";
import {
  listFirewalls, createFirewall, deleteFirewall, updateFirewall,
  getFirewallRules, updateFirewallRules,
  getFirewallDevices, attachFirewallDevice, detachFirewallDevice,
  getFirewallSettings, listFirewallTemplates,
  type IPAMFirewall, type IPAMFirewallRule, type IPAMFirewallRules,
  type IPAMFirewallDevice, type FirewallAction,
  type IPAMFirewallTemplate, type IPAMFirewallSettings,
} from "@/services/ipamService";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ── Empty rule template ──

function emptyRule(): IPAMFirewallRule {
  return {
    protocol: "TCP",
    ports: "",
    addresses: { ipv4: [], ipv6: [] },
    action: "ACCEPT",
    label: "",
    description: "",
  };
}

// ── Main Component ──

export function FirewallManager() {
  const queryClient = useQueryClient();
  const [selectedFirewall, setSelectedFirewall] = useState<IPAMFirewall | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IPAMFirewall | null>(null);
  const [rulesEditorOpen, setRulesEditorOpen] = useState(false);
  const [attachDialogOpen, setAttachDialogOpen] = useState(false);

  // ── Queries ──

  const firewallsQuery = useQuery({
    queryKey: ["admin", "networking", "firewalls"],
    queryFn: async () => {
      const res = await listFirewalls();
      if (!res.success) throw new Error(res.error);
      return res.data!;
    },
  });

  const rulesQuery = useQuery({
    queryKey: ["admin", "networking", "firewalls", selectedFirewall?.id, "rules"],
    queryFn: async () => {
      const res = await getFirewallRules(selectedFirewall!.id);
      if (!res.success) throw new Error(res.error);
      return res.data!;
    },
    enabled: !!selectedFirewall,
  });

  const devicesQuery = useQuery({
    queryKey: ["admin", "networking", "firewalls", selectedFirewall?.id, "devices"],
    queryFn: async () => {
      const res = await getFirewallDevices(selectedFirewall!.id);
      if (!res.success) throw new Error(res.error);
      return res.data!;
    },
    enabled: !!selectedFirewall,
  });

  const settingsQuery = useQuery({
    queryKey: ["admin", "networking", "firewall-settings"],
    queryFn: async () => {
      const res = await getFirewallSettings();
      if (!res.success) throw new Error(res.error);
      return res.data!;
    },
  });

  const templatesQuery = useQuery({
    queryKey: ["admin", "networking", "firewall-templates"],
    queryFn: async () => {
      const res = await listFirewallTemplates();
      if (!res.success) throw new Error(res.error);
      return res.data!;
    },
  });

  // Fetch servers for device attach dialog
  const serversQuery = useQuery({
    queryKey: ["admin", "servers"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/admin/servers`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch servers");
      return (json.servers || []) as Array<{ id: number; label: string; provider_instance_id: string }>;
    },
    enabled: attachDialogOpen,
  });

  // ── Mutations ──

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await deleteFirewall(id);
      if (!res.success) throw new Error(res.error);
    },
    onSuccess: () => {
      toast.success("Firewall deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "networking", "firewalls"] });
      setDeleteTarget(null);
      if (selectedFirewall && selectedFirewall.id === deleteTarget?.id) {
        setSelectedFirewall(null);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "enabled" | "disabled" }) => {
      const res = await updateFirewall(id, { status });
      if (!res.success) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: (data) => {
      toast.success(`Firewall ${data.status}`);
      queryClient.invalidateQueries({ queryKey: ["admin", "networking", "firewalls"] });
      if (selectedFirewall && selectedFirewall.id === data.id) {
        setSelectedFirewall(data);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveRulesMutation = useMutation({
    mutationFn: async (rules: IPAMFirewallRules) => {
      const res = await updateFirewallRules(selectedFirewall!.id, rules);
      if (!res.success) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: (data) => {
      toast.success("Rules updated");
      queryClient.setQueryData(
        ["admin", "networking", "firewalls", selectedFirewall?.id, "rules"],
        data
      );
      setRulesEditorOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const detachDeviceMutation = useMutation({
    mutationFn: async (deviceId: number) => {
      const res = await detachFirewallDevice(selectedFirewall!.id, deviceId);
      if (!res.success) throw new Error(res.error);
    },
    onSuccess: () => {
      toast.success("Device detached");
      queryClient.invalidateQueries({
        queryKey: ["admin", "networking", "firewalls", selectedFirewall?.id, "devices"],
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "networking", "firewalls"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const attachDeviceMutation = useMutation({
    mutationFn: async ({ type, entityId }: { type: string; entityId: number }) => {
      const res = await attachFirewallDevice(selectedFirewall!.id, type, entityId);
      if (!res.success) throw new Error(res.error);
    },
    onSuccess: () => {
      toast.success("Device attached");
      queryClient.invalidateQueries({
        queryKey: ["admin", "networking", "firewalls", selectedFirewall?.id, "devices"],
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "networking", "firewalls"] });
      setAttachDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Detail view ──

  if (selectedFirewall) {
    return (
      <FirewallDetailView
        firewall={selectedFirewall}
        rules={rulesQuery.data}
        rulesLoading={rulesQuery.isLoading}
        devices={devicesQuery.data}
        devicesLoading={devicesQuery.isLoading}
        settings={settingsQuery.data}
        templates={templatesQuery.data}
        servers={serversQuery.data}
        serversLoading={serversQuery.isLoading}
        rulesEditorOpen={rulesEditorOpen}
        setRulesEditorOpen={setRulesEditorOpen}
        attachDialogOpen={attachDialogOpen}
        setAttachDialogOpen={setAttachDialogOpen}
        onSaveRules={(rules) => saveRulesMutation.mutate(rules)}
        saveRulesPending={saveRulesMutation.isPending}
        onDetachDevice={(deviceId) => detachDeviceMutation.mutate(deviceId)}
        detachPending={detachDeviceMutation.isPending}
        onAttachDevice={(type, entityId) => attachDeviceMutation.mutate({ type, entityId })}
        attachPending={attachDeviceMutation.isPending}
        onBack={() => setSelectedFirewall(null)}
        onToggleStatus={(status) =>
          toggleStatusMutation.mutate({ id: selectedFirewall.id, status })
        }
        togglePending={toggleStatusMutation.isPending}
      />
    );
  }

  // ── List view ──

  const firewalls = firewallsQuery.data ?? [];
  const enabledCount = firewalls.filter((fw) => fw.status === "enabled").length;
  const disabledCount = firewalls.filter((fw) => fw.status === "disabled").length;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Firewalls</CardDescription>
            <CardTitle className="text-3xl">{firewalls.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Enabled</CardDescription>
            <CardTitle className="text-3xl text-green-600">{enabledCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Disabled</CardDescription>
            <CardTitle className="text-3xl text-muted-foreground">{disabledCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Firewalls</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => firewallsQuery.refetch()}
            disabled={firewallsQuery.isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${firewallsQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Firewall
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {firewallsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">Loading firewalls...</div>
          ) : firewalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <Shield className="h-8 w-8" />
              <p>No firewalls found</p>
              <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(true)}>
                Create your first firewall
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entities</TableHead>
                  <TableHead>Rules</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {firewalls.map((fw) => (
                  <TableRow key={fw.id}>
                    <TableCell className="font-medium">{fw.label}</TableCell>
                    <TableCell>
                      <Badge variant={fw.status === "enabled" ? "default" : "secondary"}>
                        {fw.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{fw.entities.length}</TableCell>
                    <TableCell>
                      {fw.rules.inbound.length} in / {fw.rules.outbound.length} out
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(fw.created).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedFirewall(fw)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit / Rules
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              toggleStatusMutation.mutate({
                                id: fw.id,
                                status: fw.status === "enabled" ? "disabled" : "enabled",
                              })
                            }
                          >
                            <Shield className="mr-2 h-4 w-4" />
                            {fw.status === "enabled" ? "Disable" : "Enable"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteTarget(fw)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <CreateFirewallDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["admin", "networking", "firewalls"] });
          setCreateDialogOpen(false);
        }}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Firewall</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.label}&quot;? This will detach all
              associated devices and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Create Firewall Dialog ──

function CreateFirewallDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [label, setLabel] = useState("");
  const [inboundPolicy, setInboundPolicy] = useState<FirewallAction>("DROP");
  const [outboundPolicy, setOutboundPolicy] = useState<FirewallAction>("ACCEPT");
  const [inboundRules, setInboundRules] = useState<IPAMFirewallRule[]>([]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await createFirewall({
        label,
        rules: {
          inbound_policy: inboundPolicy,
          outbound_policy: outboundPolicy,
          inbound: inboundRules.length > 0 ? inboundRules : undefined,
        },
      });
      if (!res.success) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      toast.success("Firewall created");
      setLabel("");
      setInboundPolicy("DROP");
      setOutboundPolicy("ACCEPT");
      setInboundRules([]);
      onCreated();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function addInboundRule() {
    setInboundRules((prev) => [...prev, emptyRule()]);
  }

  function removeInboundRule(index: number) {
    setInboundRules((prev) => prev.filter((_, i) => i !== index));
  }

  function updateInboundRule(index: number, field: keyof IPAMFirewallRule, value: unknown) {
    setInboundRules((prev) =>
      prev.map((rule, i) => (i === index ? { ...rule, [field]: value } : rule))
    );
  }

  function updateInboundAddresses(
    index: number,
    field: "ipv4" | "ipv6",
    value: string
  ) {
    const addrs = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setInboundRules((prev) =>
      prev.map((rule, i) =>
        i === index
          ? { ...rule, addresses: { ...rule.addresses, [field]: addrs } }
          : rule
      )
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Firewall</DialogTitle>
          <DialogDescription>
            Configure a new firewall with inbound and outbound policies.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fw-label">Label</Label>
            <Input
              id="fw-label"
              placeholder="my-firewall"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Inbound Policy</Label>
              <Select value={inboundPolicy} onValueChange={(v) => setInboundPolicy(v as FirewallAction)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACCEPT">ACCEPT</SelectItem>
                  <SelectItem value="DROP">DROP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Outbound Policy</Label>
              <Select value={outboundPolicy} onValueChange={(v) => setOutboundPolicy(v as FirewallAction)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACCEPT">ACCEPT</SelectItem>
                  <SelectItem value="DROP">DROP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Initial inbound rules */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Inbound Rules (optional)</Label>
              <Button variant="outline" size="sm" type="button" onClick={addInboundRule}>
                <Plus className="mr-1 h-3 w-3" />
                Add Rule
              </Button>
            </div>

            {inboundRules.map((rule, idx) => (
              <div key={idx} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Rule {idx + 1}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => removeInboundRule(idx)}
                    className="h-7 text-destructive"
                  >
                    Remove
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Select
                    value={rule.protocol}
                    onValueChange={(v) => updateInboundRule(idx, "protocol", v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TCP">TCP</SelectItem>
                      <SelectItem value="UDP">UDP</SelectItem>
                      <SelectItem value="ICMP">ICMP</SelectItem>
                      <SelectItem value="IPENCAP">IPENCAP</SelectItem>
                      <SelectItem value="GRE">GRE</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    className="h-8"
                    placeholder="Ports (e.g. 22, 80-443)"
                    value={rule.ports ?? ""}
                    onChange={(e) => updateInboundRule(idx, "ports", e.target.value)}
                  />
                  <Select
                    value={rule.action}
                    onValueChange={(v) => updateInboundRule(idx, "action", v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACCEPT">ACCEPT</SelectItem>
                      <SelectItem value="DROP">DROP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    className="h-8"
                    placeholder="IPv4 addresses (comma-separated)"
                    value={(rule.addresses.ipv4 ?? []).join(", ")}
                    onChange={(e) => updateInboundAddresses(idx, "ipv4", e.target.value)}
                  />
                  <Input
                    className="h-8"
                    placeholder="IPv6 addresses (comma-separated)"
                    value={(rule.addresses.ipv6 ?? []).join(", ")}
                    onChange={(e) => updateInboundAddresses(idx, "ipv6", e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!label.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? "Creating..." : "Create Firewall"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Firewall Detail View ──

function FirewallDetailView({
  firewall,
  rules,
  rulesLoading,
  devices,
  devicesLoading,
  settings,
  templates,
  servers,
  serversLoading,
  rulesEditorOpen,
  setRulesEditorOpen,
  attachDialogOpen,
  setAttachDialogOpen,
  onSaveRules,
  saveRulesPending,
  onDetachDevice,
  detachPending,
  onAttachDevice,
  attachPending,
  onBack,
  onToggleStatus,
  togglePending,
}: {
  firewall: IPAMFirewall;
  rules: IPAMFirewallRules | undefined;
  rulesLoading: boolean;
  devices: IPAMFirewallDevice[] | undefined;
  devicesLoading: boolean;
  settings: IPAMFirewallSettings | undefined;
  templates: IPAMFirewallTemplate[] | undefined;
  servers: Array<{ id: number; label: string; provider_instance_id: string }> | undefined;
  serversLoading: boolean;
  rulesEditorOpen: boolean;
  setRulesEditorOpen: (open: boolean) => void;
  attachDialogOpen: boolean;
  setAttachDialogOpen: (open: boolean) => void;
  onSaveRules: (rules: IPAMFirewallRules) => void;
  saveRulesPending: boolean;
  onDetachDevice: (deviceId: number) => void;
  detachPending: boolean;
  onAttachDevice: (type: string, entityId: number) => void;
  attachPending: boolean;
  onBack: () => void;
  onToggleStatus: (status: "enabled" | "disabled") => void;
  togglePending: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 mb-1">
            &larr; Back to firewalls
          </Button>
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-muted-foreground" />
            <h2 className="text-2xl font-bold">{firewall.label}</h2>
            <Badge variant={firewall.status === "enabled" ? "default" : "secondary"}>
              {firewall.status}
            </Badge>
          </div>
          {firewall.tags.length > 0 && (
            <div className="flex gap-1 pt-1">
              {firewall.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onToggleStatus(firewall.status === "enabled" ? "disabled" : "enabled")}
          disabled={togglePending}
        >
          {firewall.status === "enabled" ? "Disable" : "Enable"}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="rules" className="w-full">
        <TabsList>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="settings">Settings &amp; Templates</TabsTrigger>
        </TabsList>

        {/* ── Rules Tab ── */}
        <TabsContent value="rules" className="space-y-6 pt-4">
          {rulesLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading rules...</div>
          ) : rules ? (
            <>
              {/* Inbound */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Inbound Rules</CardTitle>
                      <CardDescription>
                        Default policy:{" "}
                        <Badge variant="outline">{rules.inbound_policy}</Badge>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {rules.inbound.length === 0 ? (
                    <p className="px-6 pb-4 text-sm text-muted-foreground">No inbound rules</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Label</TableHead>
                          <TableHead>Protocol</TableHead>
                          <TableHead>Ports</TableHead>
                          <TableHead>IPv4</TableHead>
                          <TableHead>IPv6</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rules.inbound.map((rule, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{rule.label || "—"}</TableCell>
                            <TableCell>{rule.protocol}</TableCell>
                            <TableCell>{rule.ports || "All"}</TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {rule.addresses.ipv4?.join(", ") || "All"}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {rule.addresses.ipv6?.join(", ") || "All"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={rule.action === "ACCEPT" ? "default" : "destructive"}>
                                {rule.action}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Outbound */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Outbound Rules</CardTitle>
                      <CardDescription>
                        Default policy:{" "}
                        <Badge variant="outline">{rules.outbound_policy}</Badge>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {rules.outbound.length === 0 ? (
                    <p className="px-6 pb-4 text-sm text-muted-foreground">No outbound rules</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Label</TableHead>
                          <TableHead>Protocol</TableHead>
                          <TableHead>Ports</TableHead>
                          <TableHead>IPv4</TableHead>
                          <TableHead>IPv6</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rules.outbound.map((rule, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{rule.label || "—"}</TableCell>
                            <TableCell>{rule.protocol}</TableCell>
                            <TableCell>{rule.ports || "All"}</TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {rule.addresses.ipv4?.join(", ") || "All"}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {rule.addresses.ipv6?.join(", ") || "All"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={rule.action === "ACCEPT" ? "default" : "destructive"}>
                                {rule.action}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Button onClick={() => setRulesEditorOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Rules
              </Button>
            </>
          ) : null}

          {/* Rules editor dialog */}
          <RulesEditorDialog
            open={rulesEditorOpen}
            onOpenChange={setRulesEditorOpen}
            rules={rules}
            onSave={onSaveRules}
            saving={saveRulesPending}
          />
        </TabsContent>

        {/* ── Devices Tab ── */}
        <TabsContent value="devices" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Attached Devices</h3>
            <Button size="sm" onClick={() => setAttachDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Attach Device
            </Button>
          </div>

          {devicesLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading devices...</div>
          ) : !devices || devices.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                <p>No devices attached</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devices.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell className="font-mono text-sm">{device.id}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{device.entity.type}</Badge>
                        </TableCell>
                        <TableCell>{device.entity.label}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(device.created).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-destructive"
                            onClick={() => onDetachDevice(device.id)}
                            disabled={detachPending}
                          >
                            Detach
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Attach device dialog */}
          <AttachDeviceDialog
            open={attachDialogOpen}
            onOpenChange={setAttachDialogOpen}
            servers={servers}
            loading={serversLoading}
            onAttach={onAttachDevice}
            attaching={attachPending}
          />
        </TabsContent>

        {/* ── Settings & Templates Tab ── */}
        <TabsContent value="settings" className="space-y-6 pt-4">
          {/* Firewall Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="h-4 w-4" />
                Default Firewall Settings
              </CardTitle>
              <CardDescription>
                Default firewalls applied to new Linodes and NodeBalancers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {settings ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Default Linode Firewall</span>
                    <span className="font-mono">
                      {settings.default_firewall_ids.linode ?? "None"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Default NodeBalancer Firewall</span>
                    <span className="font-mono">
                      {settings.default_firewall_ids.nodebalancer ?? "None"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No settings available</p>
              )}
            </CardContent>
          </Card>

          {/* Firewall Templates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookTemplate className="h-4 w-4" />
                Firewall Templates
              </CardTitle>
              <CardDescription>
                Pre-configured rule sets you can apply to new firewalls.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!templates || templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No templates available</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Slug</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((tmpl) => (
                      <TableRow key={tmpl.slug}>
                        <TableCell className="font-mono text-sm">{tmpl.slug}</TableCell>
                        <TableCell className="font-medium">{tmpl.label}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {tmpl.description}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Rules Editor Dialog ──

function RulesEditorDialog({
  open,
  onOpenChange,
  rules,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rules: IPAMFirewallRules | undefined;
  onSave: (rules: IPAMFirewallRules) => void;
  saving: boolean;
}) {
  const [inboundPolicy, setInboundPolicy] = useState<FirewallAction>("DROP");
  const [outboundPolicy, setOutboundPolicy] = useState<FirewallAction>("ACCEPT");
  const [inbound, setInbound] = useState<IPAMFirewallRule[]>([]);
  const [outbound, setOutbound] = useState<IPAMFirewallRule[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Populate local state when dialog opens with existing rules
  const initRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node && open && rules && !initialized) {
        setInboundPolicy(rules.inbound_policy);
        setOutboundPolicy(rules.outbound_policy);
        setInbound(rules.inbound.map((r) => ({ ...r, addresses: { ...r.addresses } })));
        setOutbound(rules.outbound.map((r) => ({ ...r, addresses: { ...r.addresses } })));
        setInitialized(true);
      }
    },
    [open, rules, initialized]
  );

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setInitialized(false);
    onOpenChange(nextOpen);
  }

  function addRule(direction: "inbound" | "outbound") {
    const setter = direction === "inbound" ? setInbound : setOutbound;
    setter((prev) => [...prev, emptyRule()]);
  }

  function removeRule(direction: "inbound" | "outbound", index: number) {
    const setter = direction === "inbound" ? setInbound : setOutbound;
    setter((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRule(
    direction: "inbound" | "outbound",
    index: number,
    field: keyof IPAMFirewallRule,
    value: unknown
  ) {
    const setter = direction === "inbound" ? setInbound : setOutbound;
    setter((prev) =>
      prev.map((rule, i) => (i === index ? { ...rule, [field]: value } : rule))
    );
  }

  function updateAddresses(
    direction: "inbound" | "outbound",
    index: number,
    field: "ipv4" | "ipv6",
    value: string
  ) {
    const addrs = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const setter = direction === "inbound" ? setInbound : setOutbound;
    setter((prev) =>
      prev.map((rule, i) =>
        i === index
          ? { ...rule, addresses: { ...rule.addresses, [field]: addrs } }
          : rule
      )
    );
  }

  function handleSave() {
    onSave({
      inbound,
      outbound,
      inbound_policy: inboundPolicy,
      outbound_policy: outboundPolicy,
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" ref={initRef}>
        <DialogHeader>
          <DialogTitle>Edit Firewall Rules</DialogTitle>
          <DialogDescription>
            Modify inbound and outbound rules and default policies.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Policies */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Inbound Policy</Label>
              <Select value={inboundPolicy} onValueChange={(v) => setInboundPolicy(v as FirewallAction)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACCEPT">ACCEPT</SelectItem>
                  <SelectItem value="DROP">DROP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Outbound Policy</Label>
              <Select value={outboundPolicy} onValueChange={(v) => setOutboundPolicy(v as FirewallAction)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACCEPT">ACCEPT</SelectItem>
                  <SelectItem value="DROP">DROP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Inbound rules */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Inbound Rules</Label>
              <Button variant="outline" size="sm" type="button" onClick={() => addRule("inbound")}>
                <Plus className="mr-1 h-3 w-3" />
                Add Rule
              </Button>
            </div>
            {inbound.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">No inbound rules</p>
            )}
            {inbound.map((rule, idx) => (
              <RuleEditorRow
                key={idx}
                rule={rule}
                index={idx}
                onUpdateField={(field, value) => updateRule("inbound", idx, field, value)}
                onUpdateAddresses={(field, value) => updateAddresses("inbound", idx, field, value)}
                onRemove={() => removeRule("inbound", idx)}
              />
            ))}
          </div>

          {/* Outbound rules */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Outbound Rules</Label>
              <Button variant="outline" size="sm" type="button" onClick={() => addRule("outbound")}>
                <Plus className="mr-1 h-3 w-3" />
                Add Rule
              </Button>
            </div>
            {outbound.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">No outbound rules</p>
            )}
            {outbound.map((rule, idx) => (
              <RuleEditorRow
                key={idx}
                rule={rule}
                index={idx}
                onUpdateField={(field, value) => updateRule("outbound", idx, field, value)}
                onUpdateAddresses={(field, value) => updateAddresses("outbound", idx, field, value)}
                onRemove={() => removeRule("outbound", idx)}
              />
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Rules"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Single Rule Editor Row ──

function RuleEditorRow({
  rule,
  index,
  onUpdateField,
  onUpdateAddresses,
  onRemove,
}: {
  rule: IPAMFirewallRule;
  index: number;
  onUpdateField: (field: keyof IPAMFirewallRule, value: unknown) => void;
  onUpdateAddresses: (field: "ipv4" | "ipv6", value: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Rule {index + 1}</span>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={onRemove}
          className="h-7 text-destructive"
        >
          Remove
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <Select
          value={rule.protocol}
          onValueChange={(v) => onUpdateField("protocol", v)}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TCP">TCP</SelectItem>
            <SelectItem value="UDP">UDP</SelectItem>
            <SelectItem value="ICMP">ICMP</SelectItem>
            <SelectItem value="IPENCAP">IPENCAP</SelectItem>
            <SelectItem value="GRE">GRE</SelectItem>
          </SelectContent>
        </Select>
        <Input
          className="h-8"
          placeholder="Ports (e.g. 22, 80-443)"
          value={rule.ports ?? ""}
          onChange={(e) => onUpdateField("ports", e.target.value)}
        />
        <Select
          value={rule.action}
          onValueChange={(v) => onUpdateField("action", v)}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ACCEPT">ACCEPT</SelectItem>
            <SelectItem value="DROP">DROP</SelectItem>
          </SelectContent>
        </Select>
        <Input
          className="h-8"
          placeholder="Label"
          value={rule.label ?? ""}
          onChange={(e) => onUpdateField("label", e.target.value)}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          className="h-8"
          placeholder="IPv4 addresses (comma-separated)"
          value={(rule.addresses.ipv4 ?? []).join(", ")}
          onChange={(e) => onUpdateAddresses("ipv4", e.target.value)}
        />
        <Input
          className="h-8"
          placeholder="IPv6 addresses (comma-separated)"
          value={(rule.addresses.ipv6 ?? []).join(", ")}
          onChange={(e) => onUpdateAddresses("ipv6", e.target.value)}
        />
      </div>
      <Input
        className="h-8"
        placeholder="Description"
        value={rule.description ?? ""}
        onChange={(e) => onUpdateField("description", e.target.value)}
      />
    </div>
  );
}

// ── Attach Device Dialog ──

function AttachDeviceDialog({
  open,
  onOpenChange,
  servers,
  loading,
  onAttach,
  attaching,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servers: Array<{ id: number; label: string; provider_instance_id: string }> | undefined;
  loading: boolean;
  onAttach: (type: string, entityId: number) => void;
  attaching: boolean;
}) {
  const [deviceType, setDeviceType] = useState<string>("linode");
  const [selectedServerId, setSelectedServerId] = useState<string>("");

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setDeviceType("linode");
      setSelectedServerId("");
    }
    onOpenChange(nextOpen);
  }

  function handleSubmit() {
    if (!selectedServerId) return;
    onAttach(deviceType, Number(selectedServerId));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Attach Device</DialogTitle>
          <DialogDescription>
            Attach a device to this firewall to apply its rules.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Device Type</Label>
            <Select value={deviceType} onValueChange={setDeviceType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="linode">Linode</SelectItem>
                <SelectItem value="linode_interface">Linode Interface</SelectItem>
                <SelectItem value="nodebalancer">NodeBalancer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Instance</Label>
            {loading ? (
              <div className="text-sm text-muted-foreground py-2">Loading servers...</div>
            ) : (
              <Select value={selectedServerId} onValueChange={setSelectedServerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a server" />
                </SelectTrigger>
                <SelectContent>
                  {(servers ?? []).map((server) => (
                    <SelectItem key={server.id} value={String(server.id)}>
                      {server.label} ({server.provider_instance_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedServerId || attaching}
          >
            {attaching ? "Attaching..." : "Attach"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
