import { useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Users,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface FtpUser {
  username: string;
  homeDirectory: string;
  active: boolean;
}

interface FtpTabProps {
  subscriptionId: string;
}

export default function FtpTab({ subscriptionId }: FtpTabProps) {
  const [users, setUsers] = useState<FtpUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: "",
    password: "",
    homeDirectory: "",
  });
  const [creating, setCreating] = useState(false);

  const [editUser, setEditUser] = useState<FtpUser | null>(null);
  const [editForm, setEditForm] = useState({
    password: "",
    homeDirectory: "",
  });
  const [editing, setEditing] = useState(false);

  const [deletingUser, setDeletingUser] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.get<{ users?: FtpUser[] }>(
        `/hosting/ftp/${subscriptionId}/ftp-users`
      );
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load FTP users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!subscriptionId) return;
    fetchUsers();
  }, [subscriptionId]);

  const handleCreate = async () => {
    if (!createForm.username.trim()) {
      toast.error("Username is required");
      return;
    }
    if (!createForm.password.trim()) {
      toast.error("Password is required");
      return;
    }
    try {
      setCreating(true);
      await apiClient.post(`/hosting/ftp/${subscriptionId}/ftp-users`, {
        username: createForm.username.trim(),
        password: createForm.password,
        homeDirectory: createForm.homeDirectory.trim() || undefined,
      });
      toast.success("FTP user created");
      setCreateForm({ username: "", password: "", homeDirectory: "" });
      setIsCreateOpen(false);
      await fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create FTP user");
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (user: FtpUser) => {
    setEditUser(user);
    setEditForm({ password: "", homeDirectory: user.homeDirectory || "" });
  };

  const handleEdit = async () => {
    if (!editUser) return;
    try {
      setEditing(true);
      await apiClient.put(
        `/hosting/ftp/${subscriptionId}/ftp-users/${editUser.username}`,
        {
          password: editForm.password || undefined,
          homeDirectory: editForm.homeDirectory.trim() || undefined,
        }
      );
      toast.success("FTP user updated");
      setEditUser(null);
      await fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update FTP user");
    } finally {
      setEditing(false);
    }
  };

  const handleDelete = async (username: string) => {
    try {
      setDeletingUser(username);
      await apiClient.delete(
        `/hosting/ftp/${subscriptionId}/ftp-users/${username}`
      );
      toast.success("FTP user deleted");
      await fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete FTP user");
    } finally {
      setDeletingUser(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle>FTP Users</CardTitle>
          </div>
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            disabled={loading}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Create User
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/30 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No FTP users found.
            </p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Home Directory</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.username}>
                      <TableCell className="font-medium">
                        {user.username}
                      </TableCell>
                      <TableCell>
                        {user.homeDirectory || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.active ? "default" : "secondary"}
                          className={cn(
                            user.active
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200"
                              : undefined
                          )}
                        >
                          {user.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(user)}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(user.username)}
                            disabled={deletingUser === user.username}
                          >
                            {deletingUser === user.username ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                            )}
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create FTP User</DialogTitle>
            <DialogDescription>
              Add a new FTP user to this hosting subscription.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Username</label>
              <Input
                value={createForm.username}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    username: e.target.value,
                  }))
                }
                placeholder="ftpuser"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                value={createForm.password}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Home Directory</label>
              <Input
                value={createForm.homeDirectory}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    homeDirectory: e.target.value,
                  }))
                }
                placeholder="/public_html"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={!!editUser}
        onOpenChange={(open) => {
          if (!open) setEditUser(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit FTP User</DialogTitle>
            <DialogDescription>
              Update password or home directory for{" "}
              <span className="font-medium">{editUser?.username}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">New Password</label>
              <Input
                type="password"
                value={editForm.password}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
                placeholder="Leave blank to keep current"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Home Directory</label>
              <Input
                value={editForm.homeDirectory}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    homeDirectory: e.target.value,
                  }))
                }
                placeholder="/public_html"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditUser(null)}
              disabled={editing}
            >
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={editing}>
              {editing && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
