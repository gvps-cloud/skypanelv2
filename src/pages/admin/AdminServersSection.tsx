import React from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  PowerOff,
  RefreshCw,
  RotateCcw,
  Search,
  ServerCog,
  Terminal,
} from "lucide-react";
import { SSHTerminal } from "@/components/VPS/SSHTerminal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ServerAction = "boot" | "reboot" | "shutdown";

interface ServerActionLoading {
  serverId: string;
  action: ServerAction;
}

interface AdminServerInstance {
  id: string;
  plan_id: string;
  provider_instance_id: string;
  label: string;
  status: string;
  ip_address: string | null;
  configuration: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  owner_id?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  plan_record_id?: string | null;
  plan_name?: string | null;
  plan_provider_plan_id?: string | null;
  plan_specifications?: Record<string, unknown> | null;
  provider_name?: string | null;
  region_label?: string | null;
}

interface AdminServersSectionProps {
  serversLoading: boolean;
  serverSearch: string;
  setServerSearch: React.Dispatch<React.SetStateAction<string>>;
  serverStatusFilter: string;
  setServerStatusFilter: React.Dispatch<React.SetStateAction<string>>;
  serverStatusOptions: string[];
  filteredServers: AdminServerInstance[];
  paginatedServers: AdminServerInstance[];
  totalServerPages: number;
  serverPage: number;
  setServerPage: React.Dispatch<React.SetStateAction<number>>;
  serverItemsPerPage: number;
  serverActionLoading: ServerActionLoading | null;
  sshModalOpen: boolean;
  setSshModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedSshServerId: string | null;
  onRefresh: () => void;
  onSshAction: (serverId: string) => void;
  onServerAction: (serverId: string, action: ServerAction) => void;
  formatDateTime: (value: string | null | undefined) => string;
  formatStatusLabel: (status: string | null | undefined) => string;
  statusBadgeClass: (status: string | null | undefined) => string;
}

const getServerSpecSummary = (server: AdminServerInstance): string => {
  const specRecord =
    server.plan_specifications && typeof server.plan_specifications === "object"
      ? (server.plan_specifications as Record<string, unknown>)
      : null;

  const readNumber = (key: string) => {
    if (!specRecord) return undefined;
    const raw = specRecord[key];
    if (typeof raw === "number") return raw;
    if (typeof raw === "string") {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  };

  const specParts: string[] = [];
  const vcpus = readNumber("vcpus") ?? readNumber("cpu") ?? readNumber("cores");
  const memory = readNumber("memory") ?? readNumber("memory_mb") ?? readNumber("ram");
  const disk = readNumber("disk") ?? readNumber("storage");
  const transfer = readNumber("transfer") ?? readNumber("bandwidth");

  if (typeof vcpus !== "undefined") {
    specParts.push(`${vcpus} vCPU`);
  }
  if (typeof memory !== "undefined") {
    specParts.push(`${memory} MB RAM`);
  }
  if (typeof disk !== "undefined") {
    specParts.push(`${disk} GB Disk`);
  }
  if (typeof transfer !== "undefined") {
    specParts.push(`${transfer} TB Transfer`);
  }

  return specParts.length > 0 ? specParts.join(" • ") : "—";
};

export const AdminServersSection: React.FC<AdminServersSectionProps> = ({
  serversLoading,
  serverSearch,
  setServerSearch,
  serverStatusFilter,
  setServerStatusFilter,
  serverStatusOptions,
  filteredServers,
  paginatedServers,
  totalServerPages,
  serverPage,
  setServerPage,
  serverItemsPerPage,
  serverActionLoading,
  sshModalOpen,
  setSshModalOpen,
  selectedSshServerId,
  onRefresh,
  onSshAction,
  onServerAction,
  formatDateTime,
  formatStatusLabel,
  statusBadgeClass,
}) => {
  return (
    <>
      <div className="relative mb-6 overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <Badge variant="secondary" className="mb-3">
              Infrastructure
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              VPS Servers
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Monitor and manage all VPS instances provisioned through the platform
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={onRefresh}
            disabled={serversLoading}
          >
            <RefreshCw className="h-4 w-4" />
            {serversLoading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>

        <div className="absolute right-0 top-0 h-full w-1/3 opacity-5">
          <ServerCog className="absolute right-10 top-10 h-32 w-32 rotate-12" />
        </div>
      </div>

      <Card className="border-primary/25">
        <CardHeader>
          <CardTitle>Server List</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="w-full xl:w-96">
              <Label htmlFor="server-search">Search</Label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="server-search"
                  placeholder="Search by label, IP, organization, or plan"
                  value={serverSearch}
                  onChange={(e) => setServerSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-full xl:w-56">
              <Label htmlFor="server-status">Status</Label>
              <Select
                value={serverStatusFilter}
                onValueChange={(value) => setServerStatusFilter(value)}
              >
                <SelectTrigger id="server-status" className="mt-1">
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {serverStatusOptions.map((status) => (
                    <SelectItem key={status} value={status.toLowerCase()}>
                      {formatStatusLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-4">
            {serversLoading ? (
              <div className="rounded-lg border py-10 text-center text-muted-foreground">
                Loading servers…
              </div>
            ) : filteredServers.length === 0 ? (
              <div className="rounded-lg border py-10 text-center text-muted-foreground">
                No servers match the current filters.
              </div>
            ) : (
              paginatedServers.map((server) => {
                const specSummary = getServerSpecSummary(server);
                const configurationRecord =
                  server.configuration && typeof server.configuration === "object"
                    ? (server.configuration as Record<string, unknown>)
                    : null;
                const regionValue = configurationRecord
                  ? configurationRecord["region"]
                  : undefined;
                const region = typeof regionValue === "string" ? regionValue : null;
                const normalizedStatus = (server.status ?? "").toLowerCase();
                const canBoot = normalizedStatus === "stopped";
                const canShutdown = normalizedStatus === "running";
                const canReboot =
                  normalizedStatus === "running" || normalizedStatus === "rebooting";
                const canSsh = normalizedStatus === "running";
                const loadingForServer = serverActionLoading?.serverId === server.id;

                return (
                  <Card key={server.id} className="border-border/70">
                    <CardContent className="space-y-4 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-1">
                          <p className="text-base font-semibold text-foreground">
                            {server.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Provider ID #{server.provider_instance_id}
                          </p>
                          {server.owner_email && (
                            <p className="text-xs text-muted-foreground">
                              Owner {server.owner_name || "Unknown"} • {server.owner_email}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className={statusBadgeClass(server.status)}>
                          {formatStatusLabel(server.status)}
                        </Badge>
                      </div>

                      <div className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
                        <div className="space-y-1">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            IP Address
                          </p>
                          <p className="font-medium text-foreground">
                            {server.ip_address || "—"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Plan
                          </p>
                          <p className="font-medium text-foreground">
                            {server.plan_name || server.plan_provider_plan_id || server.plan_id}
                          </p>
                          <p className="text-xs text-muted-foreground">{specSummary}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Region / Provider
                          </p>
                          <p className="font-medium text-foreground">
                            {server.region_label || region || "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {server.provider_name || "—"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Updated
                          </p>
                          <p className="font-medium text-foreground">
                            {formatDateTime(server.updated_at)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/vps/${server.id}`}>View</Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!canSsh}
                            onClick={() => onSshAction(server.id)}
                          >
                            <Terminal className="mr-1 h-4 w-4" />
                            SSH
                          </Button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={loadingForServer || !canBoot}
                            onClick={() => onServerAction(server.id, "boot")}
                          >
                            {loadingForServer && serverActionLoading?.action === "boot" ? (
                              <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="mr-1 h-4 w-4 text-emerald-500" />
                            )}
                            Boot
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={loadingForServer || !canShutdown}
                            onClick={() => onServerAction(server.id, "shutdown")}
                          >
                            {loadingForServer && serverActionLoading?.action === "shutdown" ? (
                              <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                            ) : (
                              <PowerOff className="mr-1 h-4 w-4 text-red-500" />
                            )}
                            Power Off
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={loadingForServer || !canReboot}
                            onClick={() => onServerAction(server.id, "reboot")}
                          >
                            {loadingForServer && serverActionLoading?.action === "reboot" ? (
                              <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                            ) : (
                              <RotateCcw className="mr-1 h-4 w-4" />
                            )}
                            Reboot
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {totalServerPages > 1 && (
            <div className="flex items-center justify-between py-4">
              <div className="text-sm text-muted-foreground">
                Showing {Math.min((serverPage - 1) * serverItemsPerPage + 1, filteredServers.length)} to{" "}
                {Math.min(serverPage * serverItemsPerPage, filteredServers.length)} of {filteredServers.length} servers
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setServerPage((p) => Math.max(1, p - 1))}
                  disabled={serverPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalServerPages) }, (_, i) => {
                    let p = i + 1;
                    if (totalServerPages > 5) {
                      if (serverPage > 3) {
                        p = serverPage - 2 + i;
                      }
                      if (p > totalServerPages) {
                        p = totalServerPages - (4 - i);
                      }
                    }

                    return (
                      <Button
                        key={p}
                        variant={serverPage === p ? "default" : "outline"}
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setServerPage(p)}
                      >
                        {p}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setServerPage((p) => Math.min(totalServerPages, p + 1))}
                  disabled={serverPage === totalServerPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={sshModalOpen} onOpenChange={setSshModalOpen}>
        <DialogContent className="flex h-[80vh] w-full max-w-[90vw] flex-col gap-0 border-border bg-background p-0">
          <DialogHeader className="shrink-0 border-b border-border/20 bg-muted/10 px-4 py-2">
            <DialogTitle className="flex items-center gap-2 text-sm font-mono text-foreground">
              <Terminal className="h-4 w-4" />
              SSH Console {selectedSshServerId && <span className="opacity-50">:: {selectedSshServerId}</span>}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Browser-based SSH terminal for the selected VPS instance.
            </DialogDescription>
          </DialogHeader>
          <div className="relative flex-1 overflow-hidden bg-background">
            {selectedSshServerId && (
              <SSHTerminal instanceId={selectedSshServerId} fitContainer={true} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
