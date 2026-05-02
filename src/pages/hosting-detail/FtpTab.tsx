import { useCallback, useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Checkbox } from "@/components/ui/checkbox";

interface FtpUser {
  account: string;
  homeDir: string;
}

interface FtpTabProps {
  subscriptionId: string;
}

function normalizeFtpAccount(value: string) {
  const trimmed = value.trim();
  const atIndex = trimmed.indexOf("@");
  return atIndex >= 0 ? trimmed.slice(0, atIndex).trim() : trimmed;
}

function normalizeFtpHomeDir(value: string) {
  return value.trim().replace(/\\/g, "/").replace(/^\/+/, "");
}

export default function FtpTab({ subscriptionId }: FtpTabProps) {
  const [users, setUsers] = useState<FtpUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    account: "",
    password: "",
    homeDir: "",
    createHome: true,
  });
  const [creating, setCreating] = useState(false);

  const [editUser, setEditUser] = useState<FtpUser | null>(null);
  const [editForm, setEditForm] = useState({
    password: "",
    homeDir: "",
  });
  const [editing, setEditing] = useState(false);

  const [deletingUser, setDeletingUser] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
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
  }, [subscriptionId]);

  useEffect(() => {
    if (!subscriptionId) return;
    fetchUsers();
  }, [subscriptionId, fetchUsers]);

  const handleCreate = async () => {
    const account = normalizeFtpAccount(createForm.account);
    const homeDir = normalizeFtpHomeDir(createForm.homeDir);

    if (!account) {
      toast.error("Account is required");
      return;
    }
    if (!createForm.password.trim()) {
      toast.error("Password is required");
      return;
    }
    try {
      setCreating(true);
      await apiClient.post(`/hosting/ftp/${subscriptionId}/ftp-users?createHome=${createForm.createHome ? "true" : "false"}`, {
        account,
        password: createForm.password,
        homeDir,
      });
      toast.success("FTP user created");
      setCreateForm({ account: "", password: "", homeDir: "", createHome: true });
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
    setEditForm({ password: "", homeDir: user.homeDir || "" });
  };

  const handleEdit = async () => {
    if (!editUser) return;
    const homeDir = normalizeFtpHomeDir(editForm.homeDir);
    try {
      setEditing(true);
      await apiClient.patch(
        `/hosting/ftp/${subscriptionId}/ftp-users/${encodeURIComponent(editUser.account)}`,
        {
          password: editForm.password || undefined,
          homeDir,
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
      const deleteHome = confirm("Delete this user's home directory too? This is only allowed when it is inside the website home.");
      await apiClient.delete(
        `/hosting/ftp/${subscriptionId}/ftp-users/${encodeURIComponent(username)}?deleteHome=${deleteHome ? "true" : "false"}`
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
                    <TableHead>Account</TableHead>
                    <TableHead>Home Directory</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.account}>
                      <TableCell className="font-medium">
                        {user.account}
                      </TableCell>
                      <TableCell>
                        {user.homeDir || (
                          <span className="text-muted-foreground">—</span>
                        )}
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
                            onClick={() => handleDelete(user.account)}
                            disabled={deletingUser === user.account}
                          >
                            {deletingUser === user.account ? (
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
              <label htmlFor="ftp-account" className="text-sm font-medium">Account</label>
              <Input
                id="ftp-account"
                value={createForm.account}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    account: e.target.value,
                  }))
                }
                placeholder="ftpuser"
              />
              <p className="text-xs text-muted-foreground">
                Enter only the username. Enhance appends the website primary domain automatically.
              </p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ftp-password" className="text-sm font-medium">Password</label>
              <Input
                id="ftp-password"
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
              <label htmlFor="ftp-home-dir" className="text-sm font-medium">Home Directory</label>
              <Input
                id="ftp-home-dir"
                value={createForm.homeDir}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    homeDir: normalizeFtpHomeDir(e.target.value),
                  }))
                }
                placeholder="public_html"
              />
              <p className="text-xs text-muted-foreground">
                Use a relative path. Leave blank to use the website base directory.
              </p>
            </div>
            <div className="flex items-start gap-2 rounded-lg border p-3">
              <Checkbox
                id="ftp-create-home"
                checked={createForm.createHome}
                onCheckedChange={(checked) =>
                  setCreateForm((prev) => ({ ...prev, createHome: checked === true }))
                }
              />
              <div className="space-y-1">
                <label htmlFor="ftp-create-home" className="text-sm font-medium">Create home directory if missing</label>
                <p className="text-xs text-muted-foreground">
                  Enhance will try to create the requested home directory during user creation.
                </p>
              </div>
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
              <span className="font-medium">{editUser?.account}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label htmlFor="ftp-edit-password" className="text-sm font-medium">New Password</label>
              <Input
                id="ftp-edit-password"
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
              <label htmlFor="ftp-edit-home-dir" className="text-sm font-medium">Home Directory</label>
              <Input
                id="ftp-edit-home-dir"
                value={editForm.homeDir}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    homeDir: normalizeFtpHomeDir(e.target.value),
                  }))
                }
                placeholder="public_html"
              />
              <p className="text-xs text-muted-foreground">
                Use a relative path. Leave blank to use the website base directory.
              </p>
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
