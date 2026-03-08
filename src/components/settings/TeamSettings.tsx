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
import { toast } from "sonner";
import { MoreHorizontal, Plus, Trash2, Shield, UserPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface OrganizationMember {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
}

export default function TeamSettings() {
  const { user, token } = useAuth();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteLoading, setInviteLoading] = useState(false);

  // Placeholder organization ID if not available in user context
  const orgId = user?.organizationId || "default-org-id";

  const fetchMembers = async () => {
    if (!orgId || orgId === "default-org-id") {
      console.warn("No organization ID found for user, using placeholder");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/organizations/${orgId}/members`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch members");
      }

      const data = await response.json();
      setMembers(data);
    } catch (error) {
      console.error("Error fetching members:", error);
      toast.error("Failed to load team members");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && orgId) {
      fetchMembers();
    }
  }, [token, orgId]);

  const handleInviteMember = async () => {
    if (orgId === "default-org-id") {
      toast.error("Cannot invite members: No organization found");
      return;
    }

    if (!inviteEmail) {
      toast.error("Please enter an email address");
      return;
    }

    setInviteLoading(true);
    try {
      const response = await fetch(`/api/organizations/${orgId}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to invite member");
      }

      toast.success("Member invited successfully");
      setIsInviteOpen(false);
      setInviteEmail("");
      setInviteRole("member");
      fetchMembers();
    } catch (error: any) {
      console.error("Error inviting member:", error);
      toast.error(error.message);
    } finally {
      setInviteLoading(false);
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
          headers: {
            Authorization: `Bearer ${token}`,
          },
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

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    if (orgId === "default-org-id") return;
    try {
      const response = await fetch(
        `/api/organizations/${orgId}/members/${memberId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ role: newRole }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update role");
      }

      toast.success("Role updated successfully");
      fetchMembers();
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast.error(error.message);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
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
                <DialogTitle>Add Team Member</DialogTitle>
                <DialogDescription>
                  Invite a new member to your organization. They will receive an email invitation.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email Address
                  </label>
                  <Input
                    id="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="role" className="text-sm font-medium">
                    Role
                  </label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Admins have full access to organization settings. Members can only view and manage resources.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsInviteOpen(false)}
                >
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
                          {member.role}
                        </Badge>
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
                                handleUpdateRole(
                                  member.id,
                                  member.role === "admin" ? "member" : "admin"
                                )
                              }
                              disabled={member.role === "owner"}
                            >
                              <Shield className="mr-2 h-4 w-4" />
                              {member.role === "admin"
                                ? "Demote to Member"
                                : "Promote to Admin"}
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
    </div>
  );
}
