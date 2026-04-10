import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Activity as ActivityIcon,
  Filter,
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Info,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Pagination from "@/components/ui/Pagination";
import { buildApiUrl } from "@/lib/api";

interface AdminActivityRecord {
  id: string;
  user_id: string;
  user_role?: string | null;
  organization_id?: string | null;
  organization_name?: string | null;
  event_type: string;
  entity_type: string;
  entity_id?: string | null;
  message?: string | null;
  status: "success" | "warning" | "error" | "info";
  metadata?: any;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  page: number;
  totalPages: number;
}

interface Organization {
  id: string;
  name: string;
}

interface UserSearchResult {
  id: string;
  name: string;
  email: string;
}

const AdminActivityLog: React.FC = () => {
  const { token } = useAuth();
  const [activities, setActivities] = useState<AdminActivityRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>("all");
  const [userSearch, setUserSearch] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [eventType, setEventType] = useState<string>("");
  const [entityType, setEntityType] = useState<string>("");
  const [status, setStatus] = useState<string>("all");
  const [from, setFrom] = useState<Date | undefined>(undefined);
  const [to, setTo] = useState<Date | undefined>(undefined);
  const [limit, setLimit] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    limit: 10,
    offset: 0,
    page: 1,
    totalPages: 1,
  });

  // Fetch organizations for filter dropdown
  const fetchOrganizations = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl("/api/admin/organizations"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data.organizations || []);
      }
    } catch (err) {
      console.error("Failed to fetch organizations:", err);
    }
  }, [token]);

  // Debounced user search
  useEffect(() => {
    if (!token) return;

    const timer = setTimeout(async () => {
      if (userSearch.length >= 2) {
        try {
          const res = await fetch(
            buildApiUrl(`/api/admin/users/search?q=${encodeURIComponent(userSearch)}`),
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (res.ok) {
            const data = await res.json();
            setUserResults(data.users || []);
          }
        } catch (err) {
          console.error("Failed to search users:", err);
        }
      } else {
        setUserResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [userSearch, token]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const fetchActivities = async (page: number = currentPage) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedOrg && selectedOrg !== "all") params.set("organization_id", selectedOrg);
      if (selectedUser && selectedUser !== "all") params.set("user_id", selectedUser);
      if (eventType) params.set("event_type", eventType);
      if (entityType) params.set("entity_type", entityType);
      if (status && status !== "all") params.set("status", status);
      if (from instanceof Date) params.set("from", from.toISOString());
      if (to instanceof Date) params.set("to", to.toISOString());
      params.set("limit", String(limit));
      params.set("offset", String((page - 1) * limit));

      const res = await fetch(buildApiUrl(`/api/admin/activity?${params.toString()}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load activity");
      setActivities(data.activities || []);
      setPagination(
        data.pagination || {
          total: 0,
          limit,
          offset: (page - 1) * limit,
          page,
          totalPages: 1,
        }
      );
      setCurrentPage(page);
    } catch (err) {
      console.error("Activity load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset to page 1 when filters or limit change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
      fetchActivities(1);
    } else {
      fetchActivities(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, selectedUser, eventType, entityType, status, from, to, limit]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      fetchActivities(page);
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setCurrentPage(1);
  };

  const exportCsv = () => {
    const params = new URLSearchParams();
    if (selectedOrg && selectedOrg !== "all") params.set("organization_id", selectedOrg);
    if (selectedUser && selectedUser !== "all") params.set("user_id", selectedUser);
    if (eventType) params.set("event_type", eventType);
    if (entityType) params.set("entity_type", entityType);
    if (status && status !== "all") params.set("status", status);
    if (from instanceof Date) params.set("from", from.toISOString());
    if (to instanceof Date) params.set("to", to.toISOString());

    const url = buildApiUrl(`/api/admin/activity/export?${params.toString()}`);
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const blob = await res.blob();
        const dlUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = dlUrl;
        a.download = "admin_activity_export.csv";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(dlUrl);
      })
      .catch((err) => console.error("Export error:", err));
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "success":
        return (
          <Badge
            variant="outline"
            className="border-green-200 text-green-700 bg-green-50 dark:border-green-900/60 dark:text-green-200 dark:bg-green-900/30"
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            Success
          </Badge>
        );
      case "warning":
        return (
          <Badge
            variant="outline"
            className="border-yellow-200 text-yellow-700 bg-yellow-50 dark:border-yellow-900/60 dark:text-yellow-200 dark:bg-yellow-900/30"
          >
            <AlertCircle className="h-3 w-3 mr-1" />
            Warning
          </Badge>
        );
      case "error":
        return (
          <Badge
            variant="outline"
            className="border-red-200 text-red-700 bg-red-50 dark:border-red-900/60 dark:text-red-200 dark:bg-red-900/30"
          >
            <XCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5">
            <Info className="h-3 w-3 mr-1" />
            Info
          </Badge>
        );
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
          <div className="relative z-10">
            <div className="mb-2">
              <Badge variant="secondary" className="mb-3">
                Admin
              </Badge>
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Activity Log
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Global audit trail — view and export all platform activity across all organizations.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" onClick={exportCsv}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Background decoration */}
          <div className="absolute right-0 top-0 h-full w-1/3 opacity-5">
            <ActivityIcon className="absolute right-10 top-10 h-32 w-32 rotate-12" />
            <Clock className="absolute bottom-10 right-20 h-24 w-24 -rotate-6" />
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Events
                  </p>
                  <p className="text-3xl font-bold tracking-tight">
                    {pagination.total}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Activity records
                  </p>
                </div>
                <div className="rounded-lg bg-primary/10 p-3">
                  <ActivityIcon className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Current Page
                  </p>
                  <p className="text-3xl font-bold tracking-tight">
                    {pagination.page} / {pagination.totalPages}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Page navigation
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <Filter className="h-6 w-6 text-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Per Page
                  </p>
                  <p className="text-3xl font-bold tracking-tight">{limit}</p>
                  <p className="text-xs text-muted-foreground">
                    Items displayed
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <ActivityIcon className="h-6 w-6 text-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter activity by organization, user, type, status, or date</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="org">Organization</Label>
                <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                  <SelectTrigger id="org">
                    <SelectValue placeholder="All organizations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Organizations</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="user">User</Label>
                <div className="relative">
                  <Input
                    id="user"
                    placeholder="Search by name/email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                  {userResults.length > 0 && (
                    <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-md border bg-popover shadow-lg">
                      {userResults.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => {
                            setSelectedUser(u.id);
                            setUserSearch(`${u.name} (${u.email})`);
                            setUserResults([]);
                          }}
                        >
                          {u.name} ({u.email})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedUser !== "all" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1 text-xs"
                    onClick={() => {
                      setSelectedUser("all");
                      setUserSearch("");
                    }}
                  >
                    Clear user
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="eventType">Event Type</Label>
                <Input
                  id="eventType"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  placeholder="e.g. vps.create"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="entityType">Entity Type</Label>
                <Input
                  id="entityType"
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  placeholder="e.g. vps, billing"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Any status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>From Date</Label>
                <DatePicker date={from} onDateChange={setFrom} placeholder="Select start date" />
              </div>

              <div className="space-y-2">
                <Label>To Date</Label>
                <DatePicker date={to} onDateChange={setTo} placeholder="Select end date" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="limit">Items per page</Label>
                <Select
                  value={limit.toString()}
                  onValueChange={(value) => handleLimitChange(Number(value))}
                >
                  <SelectTrigger id="limit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2 lg:col-span-1">
                <Button onClick={() => fetchActivities(1)} className="w-full">
                  <Filter className="h-4 w-4 mr-2" /> Apply
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activity Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Activity Records</CardTitle>
                <CardDescription className="mt-1">
                  {activities.length > 0
                    ? `Showing ${activities.length} of ${pagination.total} activities`
                    : "No activities found"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-muted-foreground">Loading activities...</span>
                </div>
              </div>
            ) : activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
                <div className="rounded-full bg-muted p-4">
                  <ActivityIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-sm font-semibold">No Activity Found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try adjusting your filters or check back later
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Time
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Organization
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Event
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Message
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          IP Address
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                      {activities.map((a) => (
                        <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-4 text-sm text-foreground whitespace-nowrap">
                            {new Date(a.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-4 text-sm">
                            {a.organization_name ? (
                              <div className="flex items-center gap-1.5">
                                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="max-w-[150px] truncate">{a.organization_name}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-sm text-muted-foreground">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help border-b border-dashed border-muted-foreground/50 pb-0.5 inline-block">
                                  {a.user_role ? (
                                    <span className="capitalize">
                                      {a.user_role} ({a.user_id.substring(0, 8)}...)
                                    </span>
                                  ) : (
                                    <span>User ({a.user_id.substring(0, 8)}...)</span>
                                  )}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-mono text-xs text-muted-foreground">ID: {a.user_id}</p>
                              </TooltipContent>
                            </Tooltip>
                          </td>
                          <td className="px-4 py-4 text-sm">
                            <Badge variant="outline">{a.entity_type}</Badge>
                          </td>
                          <td className="px-4 py-4 text-sm text-muted-foreground">
                            {a.event_type}
                          </td>
                          <td className="px-4 py-4 text-sm text-muted-foreground max-w-[250px] truncate">
                            {a.message ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="truncate cursor-help w-full block">
                                    {a.message}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-[300px] break-words">{a.message}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-4 text-sm text-muted-foreground font-mono">
                            {a.ip_address || "—"}
                          </td>
                          <td className="px-4 py-4 text-sm">
                            {getStatusBadge(a.status)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {pagination.total > 0 && (
                  <div className="mt-6">
                    <Pagination
                      currentPage={pagination.page}
                      totalItems={pagination.total}
                      itemsPerPage={pagination.limit}
                      onPageChange={handlePageChange}
                      onItemsPerPageChange={handleLimitChange}
                      itemsPerPageOptions={[10, 20, 50, 100]}
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export { AdminActivityLog };
