/**
 * Organizations Page
 * Manages organization memberships and displays cross-organization resources
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Building2,
  Users,
  Server,
  Ticket,
  Settings,
  ChevronRight,
  Search,
  Filter,
  Grid3x3,
  List,
  Shield,
  Clock,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { formatCurrency } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  OrganizationWithStats,
  OrganizationResources,
} from "@/types/organizations";
import { StatsGrid } from "@/components/layouts/StatsGrid";
import { Skeleton } from "@/components/ui/skeleton";

interface ViewMode {
  type: "all" | "organization";
  organizationId?: string;
}

const Organizations: React.FC = () => {
  const [organizations, setOrganizations] = useState<OrganizationWithStats[]>([]);
  const [organizationResources, setOrganizationResources] = useState<
    OrganizationResources[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadingResources, setLoadingResources] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>({ type: "all" });
  const [resourceViewMode, setResourceViewMode] = useState<"grid" | "list">(
    "grid",
  );
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>("all");
  const { token, user, switchOrganization } = useAuth();
  const navigate = useNavigate();

  const loadOrganizations = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiClient.get<{
        organizations: OrganizationWithStats[];
      }>("/organizations");
      setOrganizations(data.organizations || []);
    } catch (error: any) {
      console.error("Failed to load organizations:", error);
      toast.error(error.message || "Failed to load organizations");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadOrganizationResources = useCallback(async () => {
    if (!token) return;
    setLoadingResources(true);
    try {
      const data = await apiClient.get<{
        resources: OrganizationResources[];
      }>("/organizations/resources");
      setOrganizationResources(data.resources || []);
    } catch (error: any) {
      console.error("Failed to load organization resources:", error);
      toast.error(error.message || "Failed to load resources");
    } finally {
      setLoadingResources(false);
    }
  }, [token]);

  useEffect(() => {
    loadOrganizations();
    loadOrganizationResources();
  }, [loadOrganizations, loadOrganizationResources]);

  const filteredOrganizations = useMemo(() => {
    return organizations.filter((org) =>
      org.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [organizations, searchTerm]);

  const filteredResources = useMemo(() => {
    let resources = organizationResources;

    if (selectedOrgFilter !== "all") {
      resources = resources.filter(
        (r) => r.organization_id === selectedOrgFilter,
      );
    }

    return resources;
  }, [organizationResources, selectedOrgFilter]);

  const handleOrganizationClick = (orgId: string) => {
    setViewMode({ type: "organization", organizationId: orgId });
  };

  const handleBackToAll = () => {
    setViewMode({ type: "all" });
  };

  const handleSwitchOrganization = async (orgId: string) => {
    await switchOrganization(orgId);
    toast.success("Switched organization context");
  };

  const selectedOrganization = useMemo(() => {
    if (viewMode.type === "organization" && viewMode.organizationId) {
      return organizations.find((org) => org.id === viewMode.organizationId);
    }
    return null;
  }, [viewMode, organizations]);

  const getRoleBadgeVariant = (role: string) => {
    switch (role.toLowerCase()) {
      case "owner":
        return "default";
      case "admin":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "running":
      case "open":
        return "default";
      case "stopped":
      case "closed":
        return "secondary";
      case "provisioning":
      case "pending":
        return "outline";
      default:
        return "outline";
    }
  };

  const formatTimestamp = useCallback((timestamp: string | undefined) => {
    if (!timestamp) return "—";
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return timestamp;
    }
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }, []);

  const totalStats = useMemo(() => {
    return {
      organizations: organizations.length,
      vpsInstances: organizations.reduce(
        (sum, org) => sum + org.stats.vps_count,
        0,
      ),
      tickets: organizations.reduce(
        (sum, org) => sum + org.stats.ticket_count,
        0,
      ),
      members: organizations.reduce(
        (sum, org) => sum + org.stats.member_count,
        0,
      ),
    };
  }, [organizations]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {viewMode.type === "all" ? (
        <>
          <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
            <div className="relative z-10">
              <div className="mb-2">
                <Badge variant="secondary" className="mb-3">
                  Team Management
                </Badge>
              </div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                Organizations
              </h1>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                Manage your organization memberships and view resources across all
                your teams in one place.
              </p>
            </div>

            <div className="absolute right-0 top-0 h-full w-1/3 opacity-5">
              <Building2 className="absolute right-10 top-10 h-32 w-32 rotate-12" />
              <Users className="absolute bottom-10 right-20 h-24 w-24 -rotate-6" />
            </div>
          </div>

          <StatsGrid
            stats={[
              {
                label: "Organizations",
                value: totalStats.organizations,
                description: "Active memberships",
                icon: <Building2 className="h-6 w-6" />,
              },
              {
                label: "VPS Instances",
                value: totalStats.vpsInstances,
                description: "Across all organizations",
                icon: <Server className="h-6 w-6" />,
              },
              {
                label: "Support Tickets",
                value: totalStats.tickets,
                description: "Open and active tickets",
                icon: <Ticket className="h-6 w-6" />,
              },
              {
                label: "Team Members",
                value: totalStats.members,
                description: "Total across organizations",
                icon: <Users className="h-6 w-6" />,
              },
            ]}
            columns={4}
          />

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Your Organizations</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {filteredOrganizations.length}{" "}
                    {filteredOrganizations.length === 1
                      ? "organization"
                      : "organizations"}{" "}
                    found
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      loadOrganizations();
                      loadOrganizationResources();
                    }}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search organizations..."
                  className="pl-10"
                  aria-label="Search organizations"
                />
              </div>

              {filteredOrganizations.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
                  <div className="rounded-full bg-muted p-4">
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold">
                    No organizations found
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {searchTerm
                      ? "Try adjusting your search terms"
                      : "You haven't joined any organizations yet"}
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredOrganizations.map((org) => (
                    <Card
                      key={org.id}
                      className="group cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
                      onClick={() => handleOrganizationClick(org.id)}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold group-hover:text-primary">
                                {org.name}
                              </h4>
                              <Badge variant={getRoleBadgeVariant(org.member_role)}>
                                {org.member_role}
                              </Badge>
                            </div>

                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Server className="h-3 w-3" />
                                {org.stats.vps_count} VPS
                              </div>
                              <div className="flex items-center gap-1">
                                <Ticket className="h-3 w-3" />
                                {org.stats.ticket_count} tickets
                              </div>
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {org.stats.member_count} members
                              </div>
                            </div>

                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              Joined {formatTimestamp(org.created_at)}
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Cross-Organization Resources</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    View all VPS instances and tickets across your organizations
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      loadOrganizationResources();
                    }}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-sm">
                  <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Select
                    value={selectedOrgFilter}
                    onValueChange={setSelectedOrgFilter}
                  >
                    <SelectTrigger className="pl-10">
                      <SelectValue placeholder="All organizations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All organizations</SelectItem>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant={resourceViewMode === "grid" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setResourceViewMode("grid")}
                  >
                    <Grid3x3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={resourceViewMode === "list" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setResourceViewMode("list")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {loadingResources ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i}>
                      <CardContent className="p-6">
                        <Skeleton className="h-20" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredResources.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
                  <div className="rounded-full bg-muted p-4">
                    <Server className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold">
                    No resources found
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedOrgFilter !== "all"
                      ? "This organization has no resources yet"
                      : "No resources across your organizations"}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredResources.map((resourceGroup) => (
                    <Card key={resourceGroup.organization_id}>
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">
                              {resourceGroup.organization_name}
                            </CardTitle>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Server className="h-3 w-3" />
                                {resourceGroup.vps_instances.length} VPS
                              </div>
                              <div className="flex items-center gap-1">
                                <Ticket className="h-3 w-3" />
                                {resourceGroup.tickets.length} tickets
                              </div>
                            </div>
                          </div>
                          <Link
                            to={`/organizations/${resourceGroup.organization_id}`}
                            className="text-sm text-muted-foreground hover:text-primary"
                          >
                            <Button variant="ghost" size="sm">
                              View details
                              <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {resourceGroup.permissions.vps_view &&
                          resourceGroup.vps_instances.length > 0 && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold">
                                  VPS Instances
                                </h4>
                                {resourceGroup.permissions.vps_create && (
                                  <Link
                                    to="/vps?create=1"
                                    className="text-xs text-primary hover:underline"
                                  >
                                    Create VPS
                                  </Link>
                                )}
                              </div>
                              <div
                                className={`grid gap-3 ${
                                  resourceViewMode === "grid"
                                    ? "sm:grid-cols-2 lg:grid-cols-3"
                                    : "grid-cols-1"
                                }`}
                              >
                                {resourceGroup.vps_instances.map((vps) => (
                                  <Card
                                    key={vps.id}
                                    className="group cursor-pointer transition-all hover:border-primary/50"
                                  >
                                    <CardContent className="p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 space-y-2">
                                          <div className="flex items-center gap-2">
                                            <h5 className="font-semibold text-sm">
                                              {vps.label}
                                            </h5>
                                            <Badge
                                              variant={getStatusBadgeVariant(
                                                vps.status,
                                              )}
                                              className="text-xs"
                                            >
                                              {vps.status}
                                            </Badge>
                                          </div>
                                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                            <span>
                                              {vps.configuration.type}
                                            </span>
                                            <span>•</span>
                                            <span>
                                              {vps.configuration.region}
                                            </span>
                                          </div>
                                          {vps.ip_address && (
                                            <div className="text-xs text-muted-foreground">
                                              {vps.ip_address}
                                            </div>
                                          )}
                                        </div>
                                        <Link
                                          to={`/vps/${vps.id}`}
                                          className="text-muted-foreground hover:text-primary"
                                        >
                                          <ChevronRight className="h-4 w-4" />
                                        </Link>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </div>
                          )}

                        {resourceGroup.permissions.tickets_view &&
                          resourceGroup.tickets.length > 0 && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold">
                                  Support Tickets
                                </h4>
                                {resourceGroup.permissions.tickets_create && (
                                  <Link
                                    to="/support"
                                    className="text-xs text-primary hover:underline"
                                  >
                                    Create ticket
                                  </Link>
                                )}
                              </div>
                              <div className="space-y-3">
                                {resourceGroup.tickets.map((ticket) => (
                                  <Card
                                    key={ticket.id}
                                    className="group cursor-pointer transition-all hover:border-primary/50"
                                  >
                                    <CardContent className="p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 space-y-2">
                                          <div className="flex items-center gap-2">
                                            <h5 className="font-semibold text-sm">
                                              {ticket.subject}
                                            </h5>
                                            <Badge
                                              variant={getStatusBadgeVariant(
                                                ticket.status,
                                              )}
                                              className="text-xs"
                                            >
                                              {ticket.status}
                                            </Badge>
                                            <Badge
                                              variant="outline"
                                              className="text-xs"
                                            >
                                              {ticket.priority}
                                            </Badge>
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {formatTimestamp(
                                              ticket.created_at,
                                            )}
                                          </div>
                                        </div>
                                        <Link
                                          to={`/support?ticket=${ticket.id}`}
                                          className="text-muted-foreground hover:text-primary"
                                        >
                                          <ChevronRight className="h-4 w-4" />
                                        </Link>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </div>
                          )}

                        {resourceGroup.vps_instances.length === 0 &&
                          resourceGroup.tickets.length === 0 && (
                            <div className="text-center py-8 text-sm text-muted-foreground">
                              No resources available for this organization
                            </div>
                          )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : selectedOrganization ? (
        <>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToAll}
            >
              <ChevronRight className="mr-2 h-4 w-4 rotate-180" />
              Back to all organizations
            </Button>
          </div>

          <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between relative z-10">
              <div>
                <div className="mb-2">
                  <Badge variant="secondary" className="mb-3">
                    Organization Details
                  </Badge>
                </div>
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                  {selectedOrganization.name}
                </h1>
                <p className="mt-2 max-w-2xl text-muted-foreground">
                  {selectedOrganization.description ||
                    "Manage this organization's resources and team members"}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Badge variant={getRoleBadgeVariant(selectedOrganization.member_role)}>
                    <Shield className="mr-1 h-3 w-3" />
                    {selectedOrganization.member_role}
                  </Badge>
                  <Badge variant="outline">
                    <Users className="mr-1 h-3 w-3" />
                    {selectedOrganization.stats.member_count} members
                  </Badge>
                  <Badge variant="outline">
                    <Server className="mr-1 h-3 w-3" />
                    {selectedOrganization.stats.vps_count} VPS instances
                  </Badge>
                  <Badge variant="outline">
                    <Ticket className="mr-1 h-3 w-3" />
                    {selectedOrganization.stats.ticket_count} tickets
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => handleSwitchOrganization(selectedOrganization.id)}
                  disabled={user?.organizationId === selectedOrganization.id}
                >
                  {user?.organizationId === selectedOrganization.id ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Active
                    </>
                  ) : (
                    "Switch to Organization"
                  )}
                </Button>
              </div>
            </div>
          </div>

          <Tabs defaultValue="resources" className="space-y-4">
            <TabsList>
              <TabsTrigger value="resources">Resources</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="resources" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Accessible Resources</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    VPS instances and tickets you have permission to view
                  </p>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                  {(() => {
                    const resources = organizationResources.find(
                      (r) => r.organization_id === selectedOrganization.id,
                    );
                    if (!resources) return null;

                    return (
                      <>
                        {resources.permissions.vps_view && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold">
                                VPS Instances
                              </h4>
                              {resources.permissions.vps_create && (
                                <Link
                                  to="/vps?create=1"
                                  className="text-sm text-primary hover:underline"
                                >
                                  Create VPS
                                </Link>
                              )}
                            </div>
                            {resources.vps_instances.length === 0 ? (
                              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                                No VPS instances available
                              </div>
                            ) : (
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {resources.vps_instances.map((vps) => (
                                  <Card
                                    key={vps.id}
                                    className="group cursor-pointer transition-all hover:border-primary/50"
                                  >
                                    <CardContent className="p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 space-y-2">
                                          <div className="flex items-center gap-2">
                                            <h5 className="font-semibold text-sm">
                                              {vps.label}
                                            </h5>
                                            <Badge
                                              variant={getStatusBadgeVariant(
                                                vps.status,
                                              )}
                                              className="text-xs"
                                            >
                                              {vps.status}
                                            </Badge>
                                          </div>
                                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                            <span>
                                              {vps.configuration.type}
                                            </span>
                                            <span>•</span>
                                            <span>
                                              {vps.configuration.region}
                                            </span>
                                          </div>
                                          {vps.ip_address && (
                                            <div className="text-xs text-muted-foreground">
                                              {vps.ip_address}
                                            </div>
                                          )}
                                        </div>
                                        <Link
                                          to={`/vps/${vps.id}`}
                                          className="text-muted-foreground hover:text-primary"
                                        >
                                          <ChevronRight className="h-4 w-4" />
                                        </Link>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {resources.permissions.tickets_view && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold">
                                Support Tickets
                              </h4>
                              {resources.permissions.tickets_create && (
                                <Link
                                  to="/support"
                                  className="text-sm text-primary hover:underline"
                                >
                                  Create ticket
                                </Link>
                              )}
                            </div>
                            {resources.tickets.length === 0 ? (
                              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                                No support tickets available
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {resources.tickets.map((ticket) => (
                                  <Card
                                    key={ticket.id}
                                    className="group cursor-pointer transition-all hover:border-primary/50"
                                  >
                                    <CardContent className="p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 space-y-2">
                                          <div className="flex items-center gap-2">
                                            <h5 className="font-semibold text-sm">
                                              {ticket.subject}
                                            </h5>
                                            <Badge
                                              variant={getStatusBadgeVariant(
                                                ticket.status,
                                              )}
                                              className="text-xs"
                                            >
                                              {ticket.status}
                                            </Badge>
                                            <Badge
                                              variant="outline"
                                              className="text-xs"
                                            >
                                              {ticket.priority}
                                            </Badge>
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {formatTimestamp(
                                              ticket.created_at,
                                            )}
                                          </div>
                                        </div>
                                        <Link
                                          to={`/support?ticket=${ticket.id}`}
                                          className="text-muted-foreground hover:text-primary"
                                        >
                                          <ChevronRight className="h-4 w-4" />
                                        </Link>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {!resources.permissions.vps_view &&
                          !resources.permissions.tickets_view && (
                            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                              You don't have permission to view any resources in
                              this organization
                            </div>
                          )}
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="members" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Team Members</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Manage team members and their roles
                  </p>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
                    <div className="rounded-full bg-muted p-4">
                      <Users className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Manage Team Members</h3>
                      <p className="text-sm text-muted-foreground max-w-sm mt-1">
                        Team member management is handled in your organization settings.
                      </p>
                    </div>
                    <Button 
                      onClick={() => {
                        handleSwitchOrganization(selectedOrganization.id);
                        navigate("/settings?tab=team");
                      }}
                    >
                      Go to Team Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Organization Settings</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Manage organization configuration and permissions
                  </p>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
                    <div className="rounded-full bg-muted p-4">
                      <Settings className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Organization Settings</h3>
                      <p className="text-sm text-muted-foreground max-w-sm mt-1">
                        Configure your organization settings, billing, and permissions.
                      </p>
                    </div>
                    <Button 
                      onClick={() => {
                        handleSwitchOrganization(selectedOrganization.id);
                        navigate("/settings");
                      }}
                    >
                      Go to Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
};

export default Organizations;
