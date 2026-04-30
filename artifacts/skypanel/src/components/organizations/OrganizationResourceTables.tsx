import React, { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Key, Server, Ticket } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Pagination from "@/components/ui/Pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { OrganizationResources } from "@/types/organizations";

type ResourceTabKey = "vps" | "sshKeys" | "tickets";
type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

interface TablePaginationState {
  page: number;
  limit: number;
}

interface OrganizationResourceTablesProps {
  organizationId: string;
  isActiveOrganization: boolean;
  resources: OrganizationResources;
  formatTimestamp: (timestamp: string | undefined) => string;
  getProviderSyncedLabel: (providerType: string) => string;
  getStatusBadgeVariant: (status: string) => BadgeVariant;
  onCreateVps: () => void;
  onOpenSshKeys: (keyId?: string) => void;
  onCreateTicket: () => void;
  onOpenVps: (vpsId: string) => void;
  onOpenTicket: (ticketId: string) => void;
}

const DEFAULT_LIMIT = 5;
const DEFAULT_PAGINATION: Record<ResourceTabKey, TablePaginationState> = {
  vps: { page: 1, limit: DEFAULT_LIMIT },
  sshKeys: { page: 1, limit: DEFAULT_LIMIT },
  tickets: { page: 1, limit: DEFAULT_LIMIT },
};

const getPaginatedItems = <T,>(items: T[], page: number, limit: number) => {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * limit;

  return {
    currentPage,
    totalItems,
    itemsPerPage: limit,
    items: items.slice(startIndex, startIndex + limit),
  };
};

const StateMessage: React.FC<{ message: string; muted?: boolean }> = ({
  message,
  muted = false,
}) => (
  <div
    className={cn(
      "rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground",
      muted && "bg-muted/50",
    )}
  >
    {message}
  </div>
);

const RowActionButton: React.FC<{ label: string; onClick: () => void }> = ({
  label,
  onClick,
}) => (
  <Button
    type="button"
    variant="ghost"
    size="sm"
    className="h-8 w-8 p-0"
    onClick={(event) => {
      event.stopPropagation();
      onClick();
    }}
  >
    <span className="sr-only">{label}</span>
    <ArrowUpRight className="h-4 w-4" />
  </Button>
);

export function OrganizationResourceTables({
  organizationId,
  isActiveOrganization,
  resources,
  formatTimestamp,
  getProviderSyncedLabel,
  getStatusBadgeVariant,
  onCreateVps,
  onOpenSshKeys,
  onCreateTicket,
  onOpenVps,
  onOpenTicket,
}: OrganizationResourceTablesProps) {
  const [activeTab, setActiveTab] = useState<ResourceTabKey>("vps");
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION);

  useEffect(() => {
    setActiveTab("vps");
    setPagination(DEFAULT_PAGINATION);
  }, [organizationId]);

  const vpsPage = useMemo(
    () => getPaginatedItems(resources.vps_instances, pagination.vps.page, pagination.vps.limit),
    [resources.vps_instances, pagination.vps.page, pagination.vps.limit],
  );
  const sshKeysPage = useMemo(
    () => getPaginatedItems(resources.ssh_keys, pagination.sshKeys.page, pagination.sshKeys.limit),
    [resources.ssh_keys, pagination.sshKeys.page, pagination.sshKeys.limit],
  );
  const ticketsPage = useMemo(
    () => getPaginatedItems(resources.tickets, pagination.tickets.page, pagination.tickets.limit),
    [resources.tickets, pagination.tickets.page, pagination.tickets.limit],
  );

  const updatePage = (tab: ResourceTabKey, page: number) => {
    setPagination((current) => ({
      ...current,
      [tab]: { ...current[tab], page },
    }));
  };

  const updateLimit = (tab: ResourceTabKey, limit: number) => {
    setPagination((current) => ({
      ...current,
      [tab]: { page: 1, limit },
    }));
  };

  const getClickableRowProps = (onOpen: () => void) => ({
    role: "button" as const,
    tabIndex: 0,
    className: "cursor-pointer",
    onClick: onOpen,
    onKeyDown: (event: React.KeyboardEvent<HTMLTableRowElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen();
      }
    },
  });

  return (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ResourceTabKey)}>
      <TabsList className="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-3">
        <TabsTrigger value="vps">VPS Instances ({resources.vps_instances.length})</TabsTrigger>
        <TabsTrigger value="sshKeys">SSH Keys ({resources.ssh_keys.length})</TabsTrigger>
        <TabsTrigger value="tickets">Support Tickets ({resources.tickets.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="vps">
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Server className="h-5 w-5" />
                VPS Instances
              </CardTitle>
              <CardDescription>
                {resources.vps_instances.length} servers in this organization
              </CardDescription>
            </div>
            {resources.permissions.vps_create && (
              <Button type="button" variant="outline" size="sm" onClick={onCreateVps}>
                {isActiveOrganization ? "Create" : "Switch & Create"}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {!resources.permissions.vps_view ? (
              <StateMessage message="You do not have permission to view VPS instances" muted />
            ) : resources.vps_instances.length === 0 ? (
              <StateMessage message="No VPS instances found" />
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Region</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="w-[56px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vpsPage.items.map((vps) => (
                        <TableRow key={vps.id} {...getClickableRowProps(() => onOpenVps(vps.id))}>
                          <TableCell className="font-medium">{vps.label}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(vps.status)}>{vps.status}</Badge>
                          </TableCell>
                          <TableCell>{vps.plan_name || vps.configuration.type}</TableCell>
                          <TableCell>{vps.configuration.region}</TableCell>
                          <TableCell>{vps.ip_address || "—"}</TableCell>
                          <TableCell>{formatTimestamp(vps.created_at)}</TableCell>
                          <TableCell>
                            <RowActionButton
                              label={`Open VPS instance ${vps.label}`}
                              onClick={() => onOpenVps(vps.id)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Pagination
                  currentPage={vpsPage.currentPage}
                  totalItems={vpsPage.totalItems}
                  itemsPerPage={vpsPage.itemsPerPage}
                  onPageChange={(page) => updatePage("vps", page)}
                  onItemsPerPageChange={(limit) => updateLimit("vps", limit)}
                  itemsPerPageOptions={[5, 10, 20]}
                />
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="sshKeys">
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Key className="h-5 w-5" />
                SSH Keys
              </CardTitle>
              <CardDescription>
                {resources.ssh_keys.length} keys available for this organization
              </CardDescription>
            </div>
            {resources.permissions.ssh_keys_view && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenSshKeys()}
              >
                {isActiveOrganization ? "Open" : "Switch & Open"}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {!resources.permissions.ssh_keys_view ? (
              <StateMessage message="You do not have permission to view SSH keys" muted />
            ) : resources.ssh_keys.length === 0 ? (
              <StateMessage message="No SSH keys found" />
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Fingerprint</TableHead>
                        <TableHead>Sync Status</TableHead>
                        <TableHead>Added</TableHead>
                        <TableHead className="w-[56px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sshKeysPage.items.map((sshKey) => {
                        const syncLabel = sshKey.linode_key_id
                          ? getProviderSyncedLabel("linode")
                          : "Pending sync";

                        return (
                          <TableRow
                            key={sshKey.id}
                            {...getClickableRowProps(() => onOpenSshKeys(sshKey.id))}
                          >
                            <TableCell className="font-medium">{sshKey.name}</TableCell>
                            <TableCell className="max-w-[320px] truncate font-mono text-xs">
                              {sshKey.fingerprint}
                            </TableCell>
                            <TableCell>
                              <Badge variant={sshKey.linode_key_id ? "secondary" : "outline"}>
                                {syncLabel}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatTimestamp(sshKey.created_at)}</TableCell>
                            <TableCell>
                              <RowActionButton
                                label={`Open SSH key ${sshKey.name}`}
                                onClick={() => onOpenSshKeys(sshKey.id)}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <Pagination
                  currentPage={sshKeysPage.currentPage}
                  totalItems={sshKeysPage.totalItems}
                  itemsPerPage={sshKeysPage.itemsPerPage}
                  onPageChange={(page) => updatePage("sshKeys", page)}
                  onItemsPerPageChange={(limit) => updateLimit("sshKeys", limit)}
                  itemsPerPageOptions={[5, 10, 20]}
                />
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="tickets">
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Ticket className="h-5 w-5" />
                Support Tickets
              </CardTitle>
              <CardDescription>
                {resources.tickets.length} tickets associated with this organization
              </CardDescription>
            </div>
            {resources.permissions.tickets_create && (
              <Button type="button" variant="outline" size="sm" onClick={onCreateTicket}>
                {isActiveOrganization ? "Create" : "Switch & Create"}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {!resources.permissions.tickets_view ? (
              <StateMessage message="You do not have permission to view tickets" muted />
            ) : resources.tickets.length === 0 ? (
              <StateMessage message="No support tickets found" />
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="w-[56px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ticketsPage.items.map((ticket) => (
                        <TableRow
                          key={ticket.id}
                          {...getClickableRowProps(() => onOpenTicket(ticket.id))}
                        >
                          <TableCell className="font-medium">{ticket.subject}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(ticket.status)}>{ticket.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {ticket.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatTimestamp(ticket.updated_at)}</TableCell>
                          <TableCell>{formatTimestamp(ticket.created_at)}</TableCell>
                          <TableCell>
                            <RowActionButton
                              label={`Open support ticket ${ticket.subject}`}
                              onClick={() => onOpenTicket(ticket.id)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Pagination
                  currentPage={ticketsPage.currentPage}
                  totalItems={ticketsPage.totalItems}
                  itemsPerPage={ticketsPage.itemsPerPage}
                  onPageChange={(page) => updatePage("tickets", page)}
                  onItemsPerPageChange={(limit) => updateLimit("tickets", limit)}
                  itemsPerPageOptions={[5, 10, 20]}
                />
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
