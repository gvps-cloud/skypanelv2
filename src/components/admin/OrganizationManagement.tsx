import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

import { apiClient } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Pagination from "@/components/ui/Pagination";
import { useAuth } from "@/contexts/AuthContext";

type OrganizationDialogMode = "create" | "edit";

const ORGANIZATION_ROLE_PRIORITY = [
  "owner",
  "admin",
  "vps_manager",
  "support_agent",
  "viewer",
];

interface AdminOrganizationMember {
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  roleId: string | null;
  roleName: string;
  userRole: string;
  joinedAt: string;
}

interface AdminOrganizationRole {
  id: string;
  name: string;
  permissions: string[];
  isCustom: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AdminOrganization {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  description: string | null;
  memberCount: number;
  members: AdminOrganizationMember[];
  roles: AdminOrganizationRole[];
  createdAt: string;
  updatedAt: string;
}

interface AdminUserSearchResult {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  isAlreadyMember?: boolean;
  organizations?: Array<{ id: string; name: string; role: string }>;
}

interface OrganizationPaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

interface OrganizationStatistics {
  totalMembers?: number | null;
}

interface OrganizationListResponse {
  organizations: unknown[];
  pagination?: Partial<OrganizationPaginationInfo>;
  statistics?: OrganizationStatistics;
}

const ITEMS_PER_PAGE = 10;

interface OrganizationMutationResponse {
  organization: unknown;
}

interface MemberMutationResponse {
  member: unknown;
}

interface UserSearchResponse {
  users: AdminUserSearchResult[];
}

const emptyOrganizationForm = {
  name: "",
  slug: "",
  ownerId: "",
};

const normalizeRoleName = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  return value === "member" ? "viewer" : value;
};

const formatRoleLabel = (roleName: string) =>
  roleName
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const getRolePriority = (roleName: string | null | undefined) => {
  const normalizedRoleName = normalizeRoleName(roleName);
  if (!normalizedRoleName) return ORGANIZATION_ROLE_PRIORITY.length;

  const index = ORGANIZATION_ROLE_PRIORITY.indexOf(normalizedRoleName);
  return index === -1 ? ORGANIZATION_ROLE_PRIORITY.length : index;
};

const normalizeOrganizationRole = (role: any): AdminOrganizationRole => ({
  id: String(role?.id ?? ""),
  name: normalizeRoleName(role?.name) ?? "viewer",
  permissions: Array.isArray(role?.permissions)
    ? role.permissions.map((permission: unknown) => String(permission))
    : [],
  isCustom: Boolean(role?.isCustom ?? role?.is_custom ?? false),
  createdAt: String(role?.createdAt ?? role?.created_at ?? ""),
  updatedAt: String(role?.updatedAt ?? role?.updated_at ?? ""),
});

const sortRoles = (roles: AdminOrganizationRole[]) =>
  [...roles].sort((a, b) => {
    const priorityDelta = getRolePriority(a.name) - getRolePriority(b.name);
    if (priorityDelta !== 0) return priorityDelta;
    return a.name.localeCompare(b.name);
  });

const deriveRolesFromMembers = (
  members: AdminOrganizationMember[],
): AdminOrganizationRole[] => {
  const seen = new Set<string>();
  return members.reduce<AdminOrganizationRole[]>((accumulator, member) => {
    if (!member.roleId || seen.has(member.roleId)) {
      return accumulator;
    }

    seen.add(member.roleId);
    accumulator.push({
      id: member.roleId,
      name: member.roleName,
      permissions: [],
      isCustom: getRolePriority(member.roleName) === ORGANIZATION_ROLE_PRIORITY.length,
      createdAt: "",
      updatedAt: "",
    });
    return accumulator;
  }, []);
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

const normalizeMember = (member: any): AdminOrganizationMember => ({
  userId: String(member?.userId ?? member?.user_id ?? ""),
  userName: String(member?.userName ?? member?.user_name ?? "Unknown user"),
  userEmail: String(member?.userEmail ?? member?.user_email ?? ""),
  role:
    normalizeRoleName(member?.role ?? member?.roleName ?? member?.role_name) ??
    "viewer",
  roleId:
    member?.roleId ?? member?.role_id
      ? String(member?.roleId ?? member?.role_id)
      : null,
  roleName:
    normalizeRoleName(member?.roleName ?? member?.role_name ?? member?.role) ??
    "viewer",
  userRole: String(member?.userRole ?? member?.user_role ?? "user"),
  joinedAt: String(member?.joinedAt ?? member?.joined_at ?? ""),
});

const sortMembers = (members: AdminOrganizationMember[]) =>
  [...members].sort((a, b) => {
    const orderDelta = getRolePriority(a.roleName) - getRolePriority(b.roleName);
    if (orderDelta !== 0) return orderDelta;
    return a.userName.localeCompare(b.userName);
  });

const normalizeOrganization = (organization: any): AdminOrganization => {
  const normalizedMembers = sortMembers(
    Array.isArray(organization?.members)
      ? organization.members.map(normalizeMember)
      : [],
  );

  const normalizedRoles = sortRoles(
    Array.isArray(organization?.roles)
      ? organization.roles.map(normalizeOrganizationRole)
      : deriveRolesFromMembers(normalizedMembers),
  );

  return {
    id: String(organization?.id ?? ""),
    name: String(organization?.name ?? "Untitled organization"),
    slug: String(organization?.slug ?? ""),
    ownerId: String(organization?.ownerId ?? organization?.owner_id ?? ""),
    ownerName: String(
      organization?.ownerName ?? organization?.owner_name ?? "Unknown owner",
    ),
    ownerEmail: String(organization?.ownerEmail ?? organization?.owner_email ?? ""),
    description:
      typeof organization?.description === "string"
        ? organization.description
        : typeof organization?.settings?.description === "string"
          ? organization.settings.description
          : null,
    memberCount: Number(
      organization?.memberCount ??
        organization?.member_count ??
        normalizedMembers.length ??
        0,
    ),
    members: normalizedMembers,
    roles: normalizedRoles,
    createdAt: String(organization?.createdAt ?? organization?.created_at ?? ""),
    updatedAt: String(organization?.updatedAt ?? organization?.updated_at ?? ""),
  };
};

const getDefaultAssignableRoleId = (
  organization: AdminOrganization | null | undefined,
) => {
  if (!organization) return "";

  return (
    organization.roles.find((role) => role.name === "viewer")?.id ??
    organization.roles.find((role) => role.name !== "owner")?.id ??
    organization.roles[0]?.id ??
    ""
  );
};

const getRoleNameFromOrganization = (
  organization: AdminOrganization | null | undefined,
  roleId: string,
) => organization?.roles.find((role) => role.id === roleId)?.name ?? roleId;

const buildUserSearchPath = (query: string, organizationId?: string) => {
  const params = new URLSearchParams();
  params.set("q", query.trim());
  params.set("limit", "8");

  if (organizationId) {
    params.set("organizationId", organizationId);
  }

  return `/admin/users/search?${params.toString()}`;
};

export const OrganizationManagement: React.FC = () => {
  const { token } = useAuth();
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedOrganizationId, setExpandedOrganizationId] = useState<string>("");
  const [loadError, setLoadError] = useState("");
  const [requestedPage, setRequestedPage] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<OrganizationPaginationInfo>({
    page: 1,
    pageSize: ITEMS_PER_PAGE,
    totalItems: 0,
    totalPages: 1,
  });
  const [serverMemberCount, setServerMemberCount] = useState<number | null>(null);

  const [organizationDialogOpen, setOrganizationDialogOpen] = useState(false);
  const [organizationDialogMode, setOrganizationDialogMode] =
    useState<OrganizationDialogMode>("create");
  const [editingOrganization, setEditingOrganization] =
    useState<AdminOrganization | null>(null);
  const [organizationForm, setOrganizationForm] = useState(emptyOrganizationForm);
  const [savingOrganization, setSavingOrganization] = useState(false);
  const [ownerSearchTerm, setOwnerSearchTerm] = useState("");
  const [ownerSearchResults, setOwnerSearchResults] = useState<
    AdminUserSearchResult[]
  >([]);
  const [selectedOwner, setSelectedOwner] = useState<AdminUserSearchResult | null>(
    null,
  );
  const [searchingOwners, setSearchingOwners] = useState(false);

  const [memberDialogOrganization, setMemberDialogOrganization] =
    useState<AdminOrganization | null>(null);
  const [memberSearchTerm, setMemberSearchTerm] = useState("");
  const [memberSearchResults, setMemberSearchResults] = useState<
    AdminUserSearchResult[]
  >([]);
  const [selectedMemberCandidate, setSelectedMemberCandidate] =
    useState<AdminUserSearchResult | null>(null);
  const [memberRoleId, setMemberRoleId] = useState("");
  const [searchingMembers, setSearchingMembers] = useState(false);
  const [savingMember, setSavingMember] = useState(false);

  const [organizationPendingDelete, setOrganizationPendingDelete] =
    useState<AdminOrganization | null>(null);
  const [memberPendingRemoval, setMemberPendingRemoval] = useState<{
    organization: AdminOrganization;
    member: AdminOrganizationMember;
  } | null>(null);
  const [removingMember, setRemovingMember] = useState(false);
  const [updatingRoleKey, setUpdatingRoleKey] = useState<string | null>(null);
  const [deletingOrganization, setDeletingOrganization] = useState(false);

  const fetchOrganizations = useCallback(
    async (pageToLoad: number) => {
      if (!token) return;

      setLoading(true);
      setLoadError("");

      try {
        const response = await apiClient.get<OrganizationListResponse>(
          `/admin/organizations?page=${pageToLoad}&limit=${ITEMS_PER_PAGE}`,
        );

        setOrganizations((response.organizations ?? []).map(normalizeOrganization));

        const paginationPayload = response.pagination ?? {};
        const pageSize = paginationPayload.pageSize ?? ITEMS_PER_PAGE;
        const totalItems = paginationPayload.totalItems ?? 0;
        const computedTotalPages =
          paginationPayload.totalPages ??
          (totalItems === 0 ? 1 : Math.max(1, Math.ceil(totalItems / pageSize)));
        const responsePage = paginationPayload.page ?? pageToLoad;

        setPagination({
          page: responsePage,
          pageSize,
          totalItems,
          totalPages: computedTotalPages,
        });

        setCurrentPage(responsePage);

        const totalMembers = response.statistics?.totalMembers;
        setServerMemberCount(
          typeof totalMembers === "number" && Number.isFinite(totalMembers)
            ? totalMembers
            : null,
        );
      } catch (error) {
        const errorMessage = getErrorMessage(
          error,
          "Failed to load organizations",
        );
        setLoadError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void fetchOrganizations(requestedPage);
  }, [fetchOrganizations, requestedPage]);

  const filteredOrganizations = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return organizations;

    return organizations.filter((organization) => {
      const members = organization.members.some((member) =>
        [member.userName, member.userEmail].some((value) =>
          value.toLowerCase().includes(normalizedSearch),
        ),
      );

      return [
        organization.name,
        organization.slug,
        organization.ownerName,
        organization.ownerEmail,
      ].some((value) => value.toLowerCase().includes(normalizedSearch)) || members;
    });
  }, [organizations, searchTerm]);

  const pageMemberCount = useMemo(
    () => organizations.reduce((count, organization) => count + organization.memberCount, 0),
    [organizations],
  );
  const membershipCount = serverMemberCount ?? pageMemberCount;
  const organizationCount = pagination.totalItems ?? organizations.length;

  const resetOrganizationDialog = () => {
    setOrganizationDialogOpen(false);
    setOrganizationDialogMode("create");
    setEditingOrganization(null);
    setOrganizationForm(emptyOrganizationForm);
    setOwnerSearchTerm("");
    setOwnerSearchResults([]);
    setSelectedOwner(null);
  };

  const openCreateDialog = () => {
    setOrganizationDialogMode("create");
    setEditingOrganization(null);
    setOrganizationForm(emptyOrganizationForm);
    setOwnerSearchTerm("");
    setOwnerSearchResults([]);
    setSelectedOwner(null);
    setOrganizationDialogOpen(true);
  };

  const openEditDialog = (organization: AdminOrganization) => {
    setOrganizationDialogMode("edit");
    setEditingOrganization(organization);
    setOrganizationForm({
      name: organization.name,
      slug: organization.slug,
      ownerId: organization.ownerId,
    });
    setOwnerSearchTerm("");
    setOwnerSearchResults([]);
    setSelectedOwner(null);
    setOrganizationDialogOpen(true);
  };

  const handleOwnerSearch = async () => {
    if (ownerSearchTerm.trim().length < 2) {
      toast.error("Search for at least 2 characters to find an owner");
      return;
    }

    setSearchingOwners(true);

    try {
      const response = await apiClient.get<UserSearchResponse>(
        buildUserSearchPath(ownerSearchTerm),
      );
      setOwnerSearchResults(response.users ?? []);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to search users"));
    } finally {
      setSearchingOwners(false);
    }
  };

  const handleMemberSearch = async () => {
    if (!memberDialogOrganization) return;

    if (memberSearchTerm.trim().length < 2) {
      toast.error("Search for at least 2 characters to find users");
      return;
    }

    setSearchingMembers(true);

    try {
      const response = await apiClient.get<UserSearchResponse>(
        buildUserSearchPath(memberSearchTerm, memberDialogOrganization.id),
      );
      setMemberSearchResults(response.users ?? []);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to search users"));
    } finally {
      setSearchingMembers(false);
    }
  };

  const handleSaveOrganization = async () => {
    if (!organizationForm.name.trim() || !organizationForm.slug.trim()) {
      toast.error("Organization name and slug are required");
      return;
    }

    if (organizationDialogMode === "create" && !selectedOwner?.id) {
      toast.error("Select an owner before creating the organization");
      return;
    }

    setSavingOrganization(true);

    try {
      if (organizationDialogMode === "create") {
        const response = await apiClient.post<OrganizationMutationResponse>(
          "/admin/organizations",
          {
            name: organizationForm.name.trim(),
            slug: organizationForm.slug.trim(),
            ownerId: selectedOwner?.id,
          },
        );

        const createdOrganization = normalizeOrganization(response.organization);
        setRequestedPage(1);
        await fetchOrganizations(1);
        setExpandedOrganizationId(createdOrganization.id);
        toast.success(`Created ${createdOrganization.name}`);
      } else if (editingOrganization) {
        const payload: Record<string, string> = {
          name: organizationForm.name.trim(),
          slug: organizationForm.slug.trim(),
        };

        const response = await apiClient.put<OrganizationMutationResponse>(
          `/admin/organizations/${editingOrganization.id}`,
          payload,
        );

        const updatedOrganization = normalizeOrganization(response.organization);
        setOrganizations((previous) =>
          previous.map((organization) =>
            organization.id === updatedOrganization.id
              ? updatedOrganization
              : organization,
          ),
        );
        toast.success(`Updated ${updatedOrganization.name}`);
      }

      resetOrganizationDialog();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save organization"));
    } finally {
      setSavingOrganization(false);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!organizationPendingDelete) return;

    setDeletingOrganization(true);

    try {
      await apiClient.delete(`/admin/organizations/${organizationPendingDelete.id}`);
      setOrganizations((previous) =>
        previous.filter(
          (organization) => organization.id !== organizationPendingDelete.id,
        ),
      );
      if (expandedOrganizationId === organizationPendingDelete.id) {
        setExpandedOrganizationId("");
      }
      toast.success(`Deleted ${organizationPendingDelete.name}`);
      setOrganizationPendingDelete(null);
      await fetchOrganizations(currentPage);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to delete organization"));
    } finally {
      setDeletingOrganization(false);
    }
  };

  const openAddMemberDialog = (organization: AdminOrganization) => {
    setMemberDialogOrganization(organization);
    setMemberSearchTerm("");
    setMemberSearchResults([]);
    setSelectedMemberCandidate(null);
    setMemberRoleId(getDefaultAssignableRoleId(organization));
  };

  const closeMemberDialog = () => {
    setMemberDialogOrganization(null);
    setMemberSearchTerm("");
    setMemberSearchResults([]);
    setSelectedMemberCandidate(null);
    setMemberRoleId("");
  };

  const handleAddMember = async () => {
    if (!memberDialogOrganization || !selectedMemberCandidate) {
      toast.error("Select a user to add");
      return;
    }

    if (!memberRoleId) {
      toast.error("Select a role before adding the member");
      return;
    }

    setSavingMember(true);

    try {
      await apiClient.post<MemberMutationResponse>(
        `/admin/organizations/${memberDialogOrganization.id}/members`,
        {
          userId: selectedMemberCandidate.id,
          roleId: memberRoleId,
        },
      );

      await fetchOrganizations(currentPage);
      setExpandedOrganizationId(memberDialogOrganization.id);
      toast.success(
        `Added ${selectedMemberCandidate.name} to ${memberDialogOrganization.name}`,
      );
      closeMemberDialog();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to add organization member"));
    } finally {
      setSavingMember(false);
    }
  };

  const handleUpdateMemberRole = async (
    organization: AdminOrganization,
    member: AdminOrganizationMember,
    roleId: string,
  ) => {
    if (member.roleId === roleId) return;

    const actionKey = `${organization.id}:${member.userId}`;
    setUpdatingRoleKey(actionKey);

    try {
      await apiClient.put<MemberMutationResponse>(
        `/admin/organizations/${organization.id}/members/${member.userId}`,
        { roleId },
      );
      await fetchOrganizations(currentPage);
      setExpandedOrganizationId(organization.id);
      toast.success(
        `Updated ${member.userName}'s role to ${formatRoleLabel(
          getRoleNameFromOrganization(organization, roleId),
        )}`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update member role"));
    } finally {
      setUpdatingRoleKey(null);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberPendingRemoval) return;

    setRemovingMember(true);

    try {
      await apiClient.delete(
        `/admin/organizations/${memberPendingRemoval.organization.id}/members/${memberPendingRemoval.member.userId}`,
      );
      await fetchOrganizations(currentPage);
      setExpandedOrganizationId(memberPendingRemoval.organization.id);
      toast.success(
        `Removed ${memberPendingRemoval.member.userName} from ${memberPendingRemoval.organization.name}`,
      );
      setMemberPendingRemoval(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to remove member"));
    } finally {
      setRemovingMember(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Badge variant="secondary">Access & Organizations</Badge>
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              Organization Management
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
              Create, rename, delete, and reorganize teams directly from the admin
              dashboard.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void fetchOrganizations(currentPage)}
              disabled={loading}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" /> Create Organization
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground">Organizations</p>
              <p className="text-3xl font-bold tracking-tight">
                {organizationCount}
              </p>
            </div>
            <div className="rounded-lg bg-primary/10 p-3">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground">Memberships</p>
              <p className="text-3xl font-bold tracking-tight">
                {membershipCount}
              </p>
            </div>
            <div className="rounded-lg bg-muted/60 p-3">
              <Users className="h-6 w-6 text-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <Label htmlFor="organization-search" className="text-sm">
              Search organizations or members
            </Label>
            <div className="mt-2 flex gap-2">
              <Input
                id="organization-search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, slug, owner, or member"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
          <CardDescription>
            Expand an organization to manage owners, roles, and member placement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {loadError}
            </div>
          ) : null}

          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading organizations…
            </div>
          ) : filteredOrganizations.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No organizations matched the current filters.
            </div>
          ) : (
            <Accordion
              type="single"
              collapsible
              value={expandedOrganizationId}
              onValueChange={setExpandedOrganizationId}
              className="w-full"
            >
              {filteredOrganizations.map((organization) => (
                <AccordionItem key={organization.id} value={organization.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex w-full flex-col items-start gap-3 pr-4 text-left sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-semibold">
                            {organization.name}
                          </span>
                          <Badge variant="outline">{organization.slug}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Owner: {organization.ownerName} • {organization.ownerEmail}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">
                          {organization.memberCount} member
                          {organization.memberCount === 1 ? "" : "s"}
                        </Badge>
                        <Badge variant="outline">
                          Updated {formatDate(organization.updatedAt)}
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 rounded-lg border bg-card/40 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-foreground">
                            Description
                          </p>
                          <p className="max-w-3xl text-sm text-muted-foreground">
                            {organization.description?.trim()
                              ? organization.description
                              : "No description has been saved for this organization yet."}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(organization)}
                            aria-label={`Edit ${organization.name}`}
                          >
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openAddMemberDialog(organization)}
                            aria-label={`Add member for ${organization.name}`}
                          >
                            <UserPlus className="mr-2 h-4 w-4" /> Add member
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setOrganizationPendingDelete(organization)}
                            aria-label={`Delete ${organization.name}`}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </Button>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Member</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead className="hidden md:table-cell">
                                Joined
                              </TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {organization.members.map((member) => {
                              const roleKey = `${organization.id}:${member.userId}`;
                              const isOwner = member.roleName === "owner";

                              return (
                                <TableRow key={member.userId}>
                                  <TableCell>
                                    <div className="space-y-1">
                                      <div className="font-medium">{member.userName}</div>
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Mail className="h-3 w-3" />
                                        {member.userEmail}
                                      </div>
                                      <Badge variant="outline" className="mt-1">
                                        Account: {member.userRole}
                                      </Badge>
                                    </div>
                                  </TableCell>
                                  <TableCell className="min-w-[180px]">
                                    <Select
                                      value={member.roleId ?? undefined}
                                      onValueChange={(value) =>
                                        void handleUpdateMemberRole(
                                          organization,
                                          member,
                                          value,
                                        )
                                      }
                                      disabled={
                                        updatingRoleKey === roleKey ||
                                        organization.roles.length === 0
                                      }
                                    >
                                      <SelectTrigger
                                        aria-label={`Role for ${member.userName} in ${organization.name}`}
                                      >
                                        <SelectValue
                                          placeholder={formatRoleLabel(member.roleName)}
                                        />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {organization.roles.map((role) => (
                                          <SelectItem key={role.id} value={role.id}>
                                            {formatRoleLabel(role.name)}
                                            {role.isCustom ? " (Custom)" : ""}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                    {formatDate(member.joinedAt)}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          setMemberPendingRemoval({ organization, member })
                                        }
                                        disabled={isOwner}
                                        aria-label={`Remove ${member.userName} from ${organization.name}`}
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" /> Remove
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            )}
            <Pagination
              currentPage={currentPage}
              totalItems={pagination.totalItems}
              itemsPerPage={pagination.pageSize}
              onPageChange={(page) => setRequestedPage(page)}
              showItemsPerPage={false}
              className="mt-6"
            />
          </CardContent>
      </Card>

      <Dialog
        open={organizationDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetOrganizationDialog();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {organizationDialogMode === "create"
                ? "Create Organization"
                : `Edit ${editingOrganization?.name ?? "Organization"}`}
            </DialogTitle>
            <DialogDescription>
              {organizationDialogMode === "create"
                ? "Provision a new organization and assign its initial owner."
                : "Update the organization name and slug."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="organization-name">Name</Label>
                <Input
                  id="organization-name"
                  value={organizationForm.name}
                  onChange={(event) =>
                    setOrganizationForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Example Hosting"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="organization-slug">Slug</Label>
                <Input
                  id="organization-slug"
                  value={organizationForm.slug}
                  onChange={(event) =>
                    setOrganizationForm((current) => ({
                      ...current,
                      slug: event.target.value,
                    }))
                  }
                  placeholder="example-hosting"
                />
              </div>
            </div>

            {organizationDialogMode === "create" ? (
              <div className="space-y-3 rounded-lg border p-4">
                <div className="space-y-2">
                  <Label htmlFor="owner-search">Search for owner</Label>
                  <div className="flex gap-2">
                    <Input
                      id="owner-search"
                      value={ownerSearchTerm}
                      onChange={(event) => setOwnerSearchTerm(event.target.value)}
                      placeholder="Search by name or email"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleOwnerSearch()}
                      disabled={searchingOwners}
                      aria-label="Search owners"
                    >
                      <Search className="mr-2 h-4 w-4" /> Search
                    </Button>
                  </div>
                </div>

                {selectedOwner ? (
                  <div className="rounded-md border bg-muted/40 p-3 text-sm">
                    <p className="font-medium">Selected owner</p>
                    <p>{selectedOwner.name}</p>
                    <p className="text-muted-foreground">{selectedOwner.email}</p>
                  </div>
                ) : null}

                {ownerSearchResults.length > 0 ? (
                  <div className="space-y-2">
                    {ownerSearchResults.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className="flex w-full items-start justify-between rounded-md border p-3 text-left transition-colors hover:bg-muted/50"
                        onClick={() => {
                          setSelectedOwner(user);
                          setOrganizationForm((current) => ({
                            ...current,
                            ownerId: user.id,
                          }));
                        }}
                      >
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                        <Badge variant="outline">{user.role}</Badge>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : editingOrganization ? (
              <div className="rounded-lg border p-4 text-sm">
                <p className="font-medium">Current owner</p>
                <p>{editingOrganization.ownerName}</p>
                <p className="text-muted-foreground">{editingOrganization.ownerEmail}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Transfer ownership from the members table if needed.
                </p>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetOrganizationDialog}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveOrganization()} disabled={savingOrganization}>
              {savingOrganization
                ? "Saving..."
                : organizationDialogMode === "create"
                  ? "Create organization"
                  : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(memberDialogOrganization)}
        onOpenChange={(open) => {
          if (!open) {
            closeMemberDialog();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Add member to {memberDialogOrganization?.name ?? "organization"}
            </DialogTitle>
            <DialogDescription>
              Search users, choose an access level, then add them to this
              organization.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
              <div className="space-y-2">
                <Label htmlFor="member-search">Search users</Label>
                <div className="flex gap-2">
                  <Input
                    id="member-search"
                    value={memberSearchTerm}
                    onChange={(event) => setMemberSearchTerm(event.target.value)}
                    placeholder="Search by name or email"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleMemberSearch()}
                    disabled={searchingMembers}
                    aria-label="Search members"
                  >
                    <Search className="mr-2 h-4 w-4" /> Search
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={memberRoleId} onValueChange={setMemberRoleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {(memberDialogOrganization?.roles ?? []).map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {formatRoleLabel(role.name)}
                        {role.isCustom ? " (Custom)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedMemberCandidate ? (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="font-medium">Selected user</p>
                <p>{selectedMemberCandidate.name}</p>
                <p className="text-muted-foreground">{selectedMemberCandidate.email}</p>
              </div>
            ) : null}

            {memberSearchResults.length > 0 ? (
              <div className="space-y-2">
                {memberSearchResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className="flex w-full items-start justify-between rounded-md border p-3 text-left transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={Boolean(user.isAlreadyMember)}
                    onClick={() => setSelectedMemberCandidate(user)}
                  >
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <Badge variant={user.isAlreadyMember ? "secondary" : "outline"}>
                      {user.isAlreadyMember ? "Already a member" : user.role}
                    </Badge>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeMemberDialog}>
              Cancel
            </Button>
            <Button onClick={() => void handleAddMember()} disabled={savingMember}>
              {savingMember ? "Adding..." : "Add member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(organizationPendingDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setOrganizationPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete organization?</AlertDialogTitle>
            <AlertDialogDescription>
              {organizationPendingDelete
                ? `This will permanently remove ${organizationPendingDelete.name} and its linked members, billing data, support tickets, and infrastructure records.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingOrganization}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteOrganization();
              }}
              disabled={deletingOrganization}
            >
              {deletingOrganization ? "Deleting..." : "Delete organization"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(memberPendingRemoval)}
        onOpenChange={(open) => {
          if (!open) {
            setMemberPendingRemoval(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              {memberPendingRemoval
                ? `Remove ${memberPendingRemoval.member.userName} from ${memberPendingRemoval.organization.name}. Owners must transfer ownership before they can be removed.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingMember}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleRemoveMember();
              }}
              disabled={removingMember}
            >
              {removingMember ? "Removing..." : "Remove member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
