import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Plus,
  Trash2,
  Shield,
  UserPlus,
  X,
  Edit3,
  Clock,
  AlertCircle
} from "lucide-react";
import CreateRoleWizard from "./CreateRoleWizard";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface OrganizationMember {
  id: string;
  email: string;
  name: string;
  role: string;
  role_id: string | null;
  role_name: string | null;
  joined_at: string;
}

interface PendingInvitation {
  id: string;
  organization_id: string;
  invited_email: string;
  role_id: string;
  role_name: string;
  created_at: string;
  expires_at: string;
}

interface OrganizationRole {
  id: string;
  name: string;
  permissions: string[];
  is_custom: boolean;
  created_at: string;
  updated_at: string;
}

const PERMISSIONS = [
  { id: 'vps_view', label: 'VPS View', description: 'View VPS instances' },
  { id: 'vps_create', label: 'VPS Create', description: 'Create new VPS instances' },
  { id: 'vps_delete', label: 'VPS Delete', description: 'Delete VPS instances' },
  { id: 'vps_manage', label: 'VPS Manage', description: 'Manage VPS instances (start, stop, restart)' },
  { id: 'ssh_keys_view', label: 'SSH Keys View', description: 'View organization SSH keys' },
  { id: 'ssh_keys_manage', label: 'SSH Keys Manage', description: 'Create and delete organization SSH keys' },
  { id: 'tickets_view', label: 'Tickets View', description: 'View support tickets' },
  { id: 'tickets_create', label: 'Tickets Create', description: 'Create support tickets' },
  { id: 'tickets_manage', label: 'Tickets Manage', description: 'Manage support tickets' },
  { id: 'billing_view', label: 'Billing View', description: 'View billing information' },
  { id: 'billing_manage', label: 'Billing Manage', description: 'Manage billing and invoices' },
  { id: 'members_manage', label: 'Members Manage', description: 'Manage team members' },
  { id: 'settings_manage', label: 'Settings Manage', description: 'Manage organization settings' },
];

interface TeamSettingsProps {
  organizationId?: string;
  organizationName?: string;
  onOrganizationUpdated?: (organization: { id: string; name: string }) => void | Promise<void>;
}

export default function TeamSettings({
  organizationId: propOrganizationId,
  organizationName: propOrganizationName,
  onOrganizationUpdated,
}: TeamSettingsProps = {}) {
  const { user, token } = useAuth();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [roles, setRoles] = useState<OrganizationRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("members");
  const [organizationName, setOrganizationName] = useState(propOrganizationName ?? "");
  const [organizationSaving, setOrganizationSaving] = useState(false);

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  const [isRoleWizardOpen, setIsRoleWizardOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<OrganizationRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);

  const [cancelModal, setCancelModal] = useState<{
    isOpen: boolean;
    invitationId: string;
    email: string;
  }>({
    isOpen: false,
    invitationId: "",
    email: "",
  });

  const [deleteRoleModal, setDeleteRoleModal] = useState<{
    isOpen: boolean;
    roleId: string;
    roleName: string;
  }>({
    isOpen: false,
    roleId: "",
    roleName: "",
  });

  const [updateRoleModal, setUpdateRoleModal] = useState<{
    isOpen: boolean;
    memberId: string;
    memberName: string;
    currentRoleId: string;
  }>({
    isOpen: false,
    memberId: "",
    memberName: "",
    currentRoleId: "",
  });

  const [newMemberRoleId, setNewMemberRoleId] = useState("");

  const orgId = propOrganizationId || user?.organizationId || "default-org-id";

  const fetchMembers = async () => {
    if (!orgId || orgId === "default-org-id") {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/organizations/${orgId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch members");

      const data = await response.json();
      setMembers(data);
    } catch (error) {
      console.error("Error fetching members:", error);
      toast.error("Failed to load team members");
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitations = async () => {
    if (!orgId || orgId === "default-org-id") return;

    try {
      const response = await fetch(`/api/organizations/${orgId}/invitations`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch invitations");

      const data = await response.json();
      setInvitations(data);
    } catch (error) {
      console.error("Error fetching invitations:", error);
    }
  };

  const fetchRoles = async () => {
    if (!orgId || orgId === "default-org-id") return;

    try {
      const response = await fetch(`/api/organizations/${orgId}/roles`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch roles");

      const data = await response.json();
      setRoles(data);
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
  };

  useEffect(() => {
    if (token && orgId) {
      fetchMembers();
      fetchInvitations();
      fetchRoles();
    }
  }, [token, orgId]);

  useEffect(() => {
    setOrganizationName(propOrganizationName ?? "");
  }, [propOrganizationName]);

  const handleInviteMember = async () => {
    if (orgId === "default-org-id") {
      toast.error("Cannot invite members: No organization found");
      return;
    }

    if (!inviteEmail) {
      toast.error("Please enter an email address");
      return;
    }

    if (!inviteRoleId) {
      toast.error("Please select a role");
      return;
    }

    setInviteLoading(true);
    try {
      const response = await fetch(`/api/organizations/${orgId}/members/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: inviteEmail,
          roleId: inviteRoleId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to invite member");
      }

      const data = await response.json();
      
      if (data.emailSent === false) {
        toast.warning(`Invitation created but email failed to send: ${data.emailError || 'Unknown error'}`);
      } else {
        toast.success("Invitation sent successfully");
      }

      setIsInviteOpen(false);
      setInviteEmail("");
      setInviteRoleId("");
      fetchInvitations();
    } catch (error: any) {
      console.error("Error inviting member:", error);
      toast.error(error.message);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCancelInvitation = async () => {
    if (orgId === "default-org-id") return;

    try {
      const response = await fetch(
        `/api/organizations/invitations/${cancelModal.invitationId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to cancel invitation");
      }

      toast.success("Invitation cancelled successfully");
      setCancelModal({ isOpen: false, invitationId: "", email: "" });
      fetchInvitations();
    } catch (error: any) {
      console.error("Error cancelling invitation:", error);
      toast.error(error.message);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (orgId === "default-org-id") return;
    if (!confirm("Are you sure you want to remove this member?")) return;

    try {
      const response = await fetch(
        `/api/organizations/${orgId}/members/${memberId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove member");
      }

      toast.success("Member removed successfully");
      setMembers(members.filter((m) => m.id !== memberId));
    } catch (error: any) {
      console.error("Error removing member:", error);
      toast.error(error.message);
    }
  };

  const handleUpdateMemberRole = async () => {
    if (orgId === "default-org-id") return;

    if (!newMemberRoleId) {
      toast.error("Please select a role");
      return;
    }

    try {
      const response = await fetch(
        `/api/organizations/${orgId}/members/${updateRoleModal.memberId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ roleId: newMemberRoleId }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update role");
      }

      toast.success("Role updated successfully");
      setUpdateRoleModal({ isOpen: false, memberId: "", memberName: "", currentRoleId: "" });
      setNewMemberRoleId("");
      fetchMembers();
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast.error(error.message);
    }
  };

  const handleRoleSave = async (roleData: { name: string; permissions: string[] }) => {
    setRoleLoading(true);
    try {
      const url = editingRole
        ? `/api/organizations/${orgId}/roles/${editingRole.id}`
        : `/api/organizations/${orgId}/roles`;

      const method = editingRole ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: roleData.name,
          permissions: roleData.permissions,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${editingRole ? "update" : "create"} role`);
      }

      toast.success(`${editingRole ? "Role updated" : "Role created"} successfully`);
      setIsRoleWizardOpen(false);
      setEditingRole(null);
      fetchRoles();
    } catch (error: any) {
      console.error("Error saving role:", error);
      toast.error(error.message);
    } finally {
      setRoleLoading(false);
    }
  };

  const handleDeleteRole = async () => {
    if (orgId === "default-org-id") return;

    try {
      const response = await fetch(
        `/api/organizations/${orgId}/roles/${deleteRoleModal.roleId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete role");
      }

      toast.success("Role deleted successfully");
      setDeleteRoleModal({ isOpen: false, roleId: "", roleName: "" });
      fetchRoles();
    } catch (error: any) {
      console.error("Error deleting role:", error);
      toast.error(error.message);
    }
  };

  const handleOrganizationRename = async () => {
    if (orgId === "default-org-id") {
      toast.error("Cannot rename organization: No organization found");
      return;
    }

    if (!organizationName.trim()) {
      toast.error("Organization name is required");
      return;
    }

    setOrganizationSaving(true);
    try {
      const response = await fetch(`/api/organizations/${orgId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: organizationName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update organization");
      }

      setOrganizationName(data.organization?.name || organizationName.trim());
      toast.success("Organization renamed successfully");

      if (onOrganizationUpdated && data.organization) {
        await onOrganizationUpdated({
          id: data.organization.id,
          name: data.organization.name,
        });
      }
    } catch (error: any) {
      console.error("Error updating organization:", error);
      toast.error(error.message || "Failed to update organization");
    } finally {
      setOrganizationSaving(false);
    }
  };

  const openCreateRoleModal = () => {
    setEditingRole(null);
    setIsRoleWizardOpen(true);
  };

  const openEditRoleModal = (role: OrganizationRole) => {
    setEditingRole(role);
    setIsRoleWizardOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getDaysUntilExpiration = (dateString: string) => {
    const now = new Date();
    const expiration = new Date(dateString);
    const diffTime = expiration.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getPermissionCount = (permissions: string[]) => {
    return permissions.length;
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="members">Team Members</TabsTrigger>
          <TabsTrigger value="invitations">Pending Invitations</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="organization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization Settings</CardTitle>
              <CardDescription>
                Rename your organization without affecting its UUID-based identity. Duplicate names are allowed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="organization-id">Organization ID</Label>
                <Input id="organization-id" value={orgId} disabled className="font-mono text-xs" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="organization-name">Organization Name</Label>
                <Input
                  id="organization-name"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="Enter organization name"
                />
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Organization names do not need to be unique. Your organization is identified by its UUID.</p>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleOrganizationRename} disabled={organizationSaving}>
                  {organizationSaving ? "Saving..." : "Save Organization Name"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="space-y-1">
                <CardTitle>Team Members</CardTitle>
                <CardDescription>
                  Manage your team members and their roles.
                </CardDescription>
              </div>
              <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite Team Member</DialogTitle>
                    <DialogDescription>
                      Send an invitation to join your organization.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        placeholder="colleague@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="role">Role</Label>
                      <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.name}
                              {role.is_custom && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  Custom
                                </Badge>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {inviteRoleId && (
                        <p className="text-xs text-muted-foreground">
                          {getPermissionCount(roles.find(r => r.id === inviteRoleId)?.permissions || [])} permissions
                        </p>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsInviteOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleInviteMember} disabled={inviteLoading}>
                      {inviteLoading ? "Sending..." : "Send Invitation"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          Loading members...
                        </TableCell>
                      </TableRow>
                    ) : members.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          No members found. Invite someone to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      members.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">
                            {member.name || "N/A"}
                          </TableCell>
                          <TableCell>{member.email}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                member.role === "owner"
                                  ? "default"
                                  : member.role === "admin"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {member.role_name || member.role}
                            </Badge>
                            {member.role_name && member.role_name !== member.role && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                {getPermissionCount(
                                  roles.find(r => r.id === member.role_id)?.permissions || []
                                )} perms
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{formatDate(member.joined_at)}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() =>
                                    setUpdateRoleModal({
                                      isOpen: true,
                                      memberId: member.id,
                                      memberName: member.name || member.email,
                                      currentRoleId: member.role_id || "",
                                    })
                                  }
                                  disabled={member.role === "owner"}
                                >
                                  <Shield className="mr-2 h-4 w-4" />
                                  Update Role
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleRemoveMember(member.id)}
                                  disabled={member.role === "owner"}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Remove Member
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
              <CardDescription>
                Manage invitations sent to join your organization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Invited</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          No pending invitations.
                        </TableCell>
                      </TableRow>
                    ) : (
                      invitations.map((invitation) => (
                        <TableRow key={invitation.id}>
                          <TableCell className="font-medium">
                            {invitation.invited_email}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{invitation.role_name}</Badge>
                          </TableCell>
                          <TableCell>{formatDate(invitation.created_at)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className={
                                getDaysUntilExpiration(invitation.expires_at) <= 2
                                  ? "text-orange-600 font-medium"
                                  : "text-muted-foreground"
                              }>
                                {getDaysUntilExpiration(invitation.expires_at)} days
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setCancelModal({
                                  isOpen: true,
                                  invitationId: invitation.id,
                                  email: invitation.invited_email,
                                })
                              }
                              className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                            >
                              <X className="h-4 w-4" />
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
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="space-y-1">
                <CardTitle>Roles & Permissions</CardTitle>
                <CardDescription>
                  Define roles with specific permissions for your team.
                </CardDescription>
              </div>
              <Button onClick={openCreateRoleModal}>
                <Plus className="mr-2 h-4 w-4" />
                Create Role
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                          No roles found. Create a role to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      roles.map((role) => (
                        <TableRow key={role.id}>
                          <TableCell className="font-medium">
                            {role.name}
                          </TableCell>
                          <TableCell>
                            {role.is_custom ? (
                              <Badge variant="secondary">Custom</Badge>
                            ) : (
                              <Badge variant="outline">Predefined</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {getPermissionCount(role.permissions)} permissions
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  disabled={!role.is_custom}
                                >
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => openEditRoleModal(role)}
                                >
                                  <Edit3 className="mr-2 h-4 w-4" />
                                  Edit Role
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() =>
                                    setDeleteRoleModal({
                                      isOpen: true,
                                      roleId: role.id,
                                      roleName: role.name,
                                    })
                                  }
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Role
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
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

      <CreateRoleWizard
        isOpen={isRoleWizardOpen}
        onClose={() => setIsRoleWizardOpen(false)}
        onSave={handleRoleSave}
        editingRole={editingRole || undefined}
        loading={roleLoading}
      />

      <Dialog
        open={cancelModal.isOpen}
        onOpenChange={(open) =>
          !open && setCancelModal({ ...cancelModal, isOpen: false })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Cancel Invitation
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel the invitation for{" "}
              <strong>{cancelModal.email}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setCancelModal({ ...cancelModal, isOpen: false })
              }
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleCancelInvitation}>
              Cancel Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteRoleModal.isOpen}
        onOpenChange={(open) =>
          !open && setDeleteRoleModal({ ...deleteRoleModal, isOpen: false })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Delete Role
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the role{" "}
              <strong>{deleteRoleModal.roleName}</strong>? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setDeleteRoleModal({ ...deleteRoleModal, isOpen: false })
              }
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteRole}>
              Delete Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={updateRoleModal.isOpen}
        onOpenChange={(open) =>
          !open && setUpdateRoleModal({ ...updateRoleModal, isOpen: false })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Member Role</DialogTitle>
            <DialogDescription>
              Update the role for {updateRoleModal.memberName}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="newRole">New Role</Label>
              <Select
                value={newMemberRoleId}
                onValueChange={setNewMemberRoleId}
              >
                <SelectTrigger id="newRole">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles
                    .filter((role) => {
                      // Find current user's role in the organization
                      const currentUserMember = members.find(
                        (m) => m.email === user?.email
                      );
                      const currentUserRole = currentUserMember?.role_name || currentUserMember?.role;
                      
                      // Hide owner role from non-owners
                      if (role.name === 'owner' && currentUserRole !== 'owner') {
                        return false;
                      }
                      return true;
                    })
                    .map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                        {role.is_custom && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Custom
                          </Badge>
                        )}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {newMemberRoleId && (
                <p className="text-xs text-muted-foreground">
                  {getPermissionCount(
                    roles.find((r) => r.id === newMemberRoleId)?.permissions ||
                      []
                  )}{" "}
                  permissions
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setUpdateRoleModal({ ...updateRoleModal, isOpen: false })
              }
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateMemberRole}>Update Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
