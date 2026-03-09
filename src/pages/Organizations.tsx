/**
 * Organizations Page
 * Manages organization memberships and displays cross-organization resources
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Building2,
  Users,
  Server,
  Ticket,
  ChevronRight,
  Search,
  Filter,
  Grid3x3,
  List,
  Shield,
  Clock,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import Pagination from "@/components/ui/Pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TeamSettings from "@/components/settings/TeamSettings";

interface ViewMode {
  type: "all" | "organization";
  organizationId?: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
  });
  const { token, user, switchOrganization } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    if (id) {
      setViewMode({ type: "organization", organizationId: id });
    } else {
      setViewMode({ type: "all" });
    }
  }, [id]);

  const loadOrganizations = useCallback(async (page = currentPage, limit = itemsPerPage) => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiClient.get<{
        organizations: OrganizationWithStats[];
        pagination: PaginationInfo;
      }>(`/organizations?page=${page}&limit=${limit}`);
      setOrganizations(data.organizations || []);
      setPagination(data.pagination);
    } catch (error: any) {
      console.error("Failed to load organizations:", error);
      toast.error(error.message || "Failed to load organizations");
    } finally {
      setLoading(false);
    }
  }, [token, currentPage, itemsPerPage]);

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
    loadOrganizations(currentPage, itemsPerPage);
  }, [currentPage, itemsPerPage, token]);

  useEffect(() => {
    loadOrganizationResources();
  }, [loadOrganizationResources]);

  const filteredOrganizations = useMemo(() => {
    if (!searchTerm) return organizations;
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
    navigate(`/organizations/${orgId}`);
  };

  const handleBackToAll = () => {
    navigate("/organizations");
  };

  const handleSwitchOrganization = async (orgId: string) => {
    try {
      await switchOrganization(orgId);
      toast.success("Switched organization context");
    } catch (error: any) {
      console.error("Failed to switch organization:", error);
      toast.error(error.message || "Failed to switch organization context");
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (newLimit: number) => {
    setItemsPerPage(newLimit);
    setCurrentPage(1);
  };

  const selectedOrganization = useMemo(() => {
    if (viewMode.type === "organization" && viewMode.organizationId) {
      return organizations.find((org) => org.id === viewMode.organizationId);
    }
    return null;
  }, [viewMode, organizations]);

  const selectedOrganizationResources = useMemo(() => {
    if (selectedOrganization) {
      return organizationResources.find(r => r.organization_id === selectedOrganization.id) || null;
    }
    return null;
  }, [selectedOrganization, organizationResources]);

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
      organizations: pagination.total || organizations.length,
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
  }, [organizations, pagination.total]);

  if (loading && currentPage === 1) {
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
                    {searchTerm ? `${filteredOrganizations.length} filtered` : `Page ${pagination.page} of ${pagination.totalPages}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      loadOrganizations(currentPage, itemsPerPage);
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

              {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <Card key={i}>
                      <CardContent className="p-6">
                        <Skeleton className="h-32" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredOrganizations.length === 0 ? (
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
                              Joined {formatTimestamp(org.joined_at || org.created_at)}
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
            {!searchTerm && pagination.total > 0 && (
              <Pagination
                currentPage={pagination.page}
                totalItems={pagination.total}
                itemsPerPage={pagination.limit}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
                showItemsPerPage={true}
                itemsPerPageOptions={[6, 12, 24, 48]}
              />
            )}
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
                          >
                            <Button variant="outline" size="sm">
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
                                  <Link to="/vps?create=1">
                                    <Button variant="outline" size="sm">
                                      Create VPS
                                    </Button>
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
                                    className="group cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
                                    onClick={() => navigate(`/vps/${vps.id}`)}
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
                                              {vps.plan_name || vps.configuration.type}
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
                                        <div className="text-muted-foreground group-hover:text-primary transition-colors">
                                          <ChevronRight className="h-4 w-4" />
                                        </div>
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
                                  <Link to="/support">
                                    <Button variant="outline" size="sm">
                                      Create ticket
                                    </Button>
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
                                {resourceGroup.tickets.map((ticket) => (
                                  <Card
                                    key={ticket.id}
                                    className="group cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
                                    onClick={() => navigate(`/support?ticket=${ticket.id}`)}
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
                                        <div className="text-muted-foreground group-hover:text-primary transition-colors">
                                          <ChevronRight className="h-4 w-4" />
                                        </div>
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
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="outline"
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

          <Tabs defaultValue="resources" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="resources">Resources</TabsTrigger>
              <TabsTrigger value="settings">Team Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="resources" className="space-y-6">
              {loadingResources ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <Card key={i}>
                      <CardContent className="p-6">
                        <Skeleton className="h-20" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : selectedOrganizationResources ? (
                <div className="grid gap-6 md:grid-cols-2">
                  {/* VPS Instances Card */}
                  <Card>
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Server className="h-5 w-5" />
                          VPS Instances
                        </CardTitle>
                        {selectedOrganizationResources.permissions.vps_create && (
                          <Link to="/vps?create=1">
                            <Button variant="outline" size="sm">
                              Create
                            </Button>
                          </Link>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {selectedOrganizationResources.vps_instances.length} servers
                      </p>
                    </CardHeader>
                    <CardContent>
                      {selectedOrganizationResources.permissions.vps_view ? (
                        selectedOrganizationResources.vps_instances.length > 0 ? (
                          <div className="space-y-3">
                            {selectedOrganizationResources.vps_instances.map((vps) => (
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
                                          variant={getStatusBadgeVariant(vps.status)}
                                          className="text-xs"
                                        >
                                          {vps.status}
                                        </Badge>
                                      </div>
                                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                        <span>{vps.plan_name || vps.configuration.type}</span>
                                        <span>•</span>
                                        <span>{vps.configuration.region}</span>
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
                        ) : (
                          <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-lg">
                            No VPS instances found
                          </div>
                        )
                      ) : (
                        <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-lg bg-muted/50">
                          You do not have permission to view VPS instances
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Support Tickets Card */}
                  <Card>
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Ticket className="h-5 w-5" />
                          Support Tickets
                        </CardTitle>
                        {selectedOrganizationResources.permissions.tickets_create && (
                          <Link to="/support">
                            <Button variant="outline" size="sm">
                              Create
                            </Button>
                          </Link>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {selectedOrganizationResources.tickets.length} tickets
                      </p>
                    </CardHeader>
                    <CardContent>
                      {selectedOrganizationResources.permissions.tickets_view ? (
                        selectedOrganizationResources.tickets.length > 0 ? (
                          <div className="space-y-3">
                            {selectedOrganizationResources.tickets.map((ticket) => (
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
                                          variant={getStatusBadgeVariant(ticket.status)}
                                          className="text-xs"
                                        >
                                          {ticket.status}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs">
                                          {ticket.priority}
                                        </Badge>
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {formatTimestamp(ticket.created_at)}
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
                        ) : (
                          <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-lg">
                            No active tickets found
                          </div>
                        )
                      ) : (
                        <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-lg bg-muted/50">
                          You do not have permission to view tickets
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No resources available for this organization
                </div>
              )}
            </TabsContent>

            <TabsContent value="settings">
              <TeamSettings organizationId={selectedOrganization.id} />
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
};

export default Organizations;
