import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  Trash2,
  Plus,
  Database,
  UserCircle,
  ExternalLink,
  Pencil,
  Globe,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

interface MysqlDatabase {
  name: string;
  size: number;
  createdAt?: string | null;
}

interface MysqlUser {
  username: string;
  accessHosts: string[];
  grants: Record<string, string[]>;
  authPlugin?: string | null;
  createdAt?: string | null;
}

interface MysqlTabProps {
  subscriptionId: string;
}

function formatDatabaseSize(size: number | null | undefined): string {
  const value = Number(size ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(2)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(2)} KB`;
  return `${value} B`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function getGrantLabels(grants: Record<string, string[]> | null | undefined): string[] {
  if (!grants || typeof grants !== "object") return [];
  return Object.entries(grants).flatMap(([dbName, privileges]) => {
    if (!Array.isArray(privileges) || privileges.length === 0) return [];
    return privileges.map((privilege) => `${dbName}: ${privilege}`);
  });
}

export default function MysqlTab({ subscriptionId }: MysqlTabProps) {
  const [databases, setDatabases] = useState<MysqlDatabase[]>([]);
  const [users, setUsers] = useState<MysqlUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dbActionLoading, setDbActionLoading] = useState<string | null>(null);
  const [userActionLoading, setUserActionLoading] = useState<string | null>(null);

  const [dbDialogOpen, setDbDialogOpen] = useState(false);
  const [newDbName, setNewDbName] = useState("");
  const [creatingDb, setCreatingDb] = useState(false);

  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);

  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [savingUser, setSavingUser] = useState(false);

  const [accessHostOpen, setAccessHostOpen] = useState(false);
  const [accessHostUsername, setAccessHostUsername] = useState("");
  const [newHost, setNewHost] = useState("");
  const [addingHost, setAddingHost] = useState(false);
  const [removingHost, setRemovingHost] = useState<string | null>(null);

  const [manageAccessOpen, setManageAccessOpen] = useState(false);
  const [accessUser, setAccessUser] = useState<MysqlUser | null>(null);
  const [accessDb, setAccessDb] = useState("");
  const [accessPrivileges, setAccessPrivileges] = useState("ALL PRIVILEGES");
  const [managingAccess, setManagingAccess] = useState(false);

  const loadData = useCallback(async () => {
    if (!subscriptionId) return;
    setRefreshing(true);
    setError(null);
    try {
      const [dbsRes, usersRes] = await Promise.all([
        apiClient.get<{ databases?: MysqlDatabase[] }>(`/hosting/mysql/${subscriptionId}/mysql-dbs`),
        apiClient.get<{ users?: MysqlUser[] }>(`/hosting/mysql/${subscriptionId}/mysql-users`),
      ]);
      setDatabases(dbsRes.databases ?? []);
      setUsers(usersRes.users ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load MySQL data";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [subscriptionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateDb = async () => {
    if (!subscriptionId) return;
    if (!newDbName.trim()) { toast.error("Database name is required"); return; }
    setCreatingDb(true);
    try {
      await apiClient.post(`/hosting/mysql/${subscriptionId}/mysql-dbs`, { name: newDbName.trim() });
      toast.success("Database created");
      setNewDbName("");
      setDbDialogOpen(false);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create database");
    } finally {
      setCreatingDb(false);
    }
  };

  const handleDeleteDb = async (dbName: string) => {
    if (!subscriptionId) return;
    if (!confirm(`Delete database "${dbName}"?`)) return;
    setDbActionLoading(dbName);
    try {
      await apiClient.delete(`/hosting/mysql/${subscriptionId}/mysql-dbs/${encodeURIComponent(dbName)}`);
      toast.success(`Database "${dbName}" deleted`);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete database");
    } finally {
      setDbActionLoading(null);
    }
  };

  const handleDbSso = async (dbName: string) => {
    if (!subscriptionId) return;
    setDbActionLoading(dbName);
    try {
      const res = await apiClient.get<{ url?: string }>(
        `/hosting/mysql/${subscriptionId}/mysql-dbs/${encodeURIComponent(dbName)}/sso`,
      );
      if (res.url) {
        window.open(res.url, "_blank", "noopener,noreferrer");
      } else {
        toast.error("SSO URL not available");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to get SSO URL");
    } finally {
      setDbActionLoading(null);
    }
  };

  const handleCreateUser = async () => {
    if (!subscriptionId) return;
    if (!newUsername.trim() || !newPassword.trim()) { toast.error("Username and password are required"); return; }
    setCreatingUser(true);
    try {
      await apiClient.post(`/hosting/mysql/${subscriptionId}/mysql-users`, {
        username: newUsername.trim(),
        password: newPassword.trim(),
      });
      toast.success("User created");
      setNewUsername("");
      setNewPassword("");
      setUserDialogOpen(false);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (!subscriptionId) return;
    if (!confirm(`Delete user "${username}"?`)) return;
    setUserActionLoading(username);
    try {
      await apiClient.delete(`/hosting/mysql/${subscriptionId}/mysql-users/${encodeURIComponent(username)}`);
      toast.success(`User "${username}" deleted`);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setUserActionLoading(null);
    }
  };

  const handleEditUser = (user: MysqlUser) => {
    setEditUsername(user.username);
    setEditPassword("");
    setEditUserOpen(true);
  };

  const handleSaveUser = async () => {
    if (!subscriptionId || !editPassword) return;
    setSavingUser(true);
    try {
      await apiClient.put(`/hosting/mysql/${subscriptionId}/mysql-users/${encodeURIComponent(editUsername)}`, {
        password: editPassword,
      });
      toast.success(`Password updated for ${editUsername}`);
      setEditUserOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setSavingUser(false);
    }
  };

  const handleOpenAccessHosts = (user: MysqlUser) => {
    setAccessHostUsername(user.username);
    setNewHost("");
    setAccessHostOpen(true);
  };

  const handleAddHost = async () => {
    if (!subscriptionId || !newHost.trim()) return;
    setAddingHost(true);
    try {
      await apiClient.post(
        `/hosting/mysql/${subscriptionId}/mysql-users/${encodeURIComponent(accessHostUsername)}/access-hosts`,
        { hosts: [newHost.trim()] },
      );
      toast.success("Access host added");
      setNewHost("");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add access host");
    } finally {
      setAddingHost(false);
    }
  };

  const handleRemoveHost = async (host: string) => {
    if (!subscriptionId) return;
    setRemovingHost(host);
    try {
      await apiClient.delete(
        `/hosting/mysql/${subscriptionId}/mysql-users/${encodeURIComponent(accessHostUsername)}/access-hosts`,
        { data: { hosts: [host] } },
      );
      toast.success("Access host removed");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove access host");
    } finally {
      setRemovingHost(null);
    }
  };

  const handleManageAccess = async () => {
    if (!subscriptionId || !accessUser || !accessDb) return;
    setManagingAccess(true);
    try {
      await apiClient.put(`/hosting/mysql/${subscriptionId}/mysql-users/${encodeURIComponent(accessUser.username)}/privileges`, {
        [accessDb]: [accessPrivileges]
      });
      toast.success("User access updated");
      setManageAccessOpen(false);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update access");
    } finally {
      setManagingAccess(false);
    }
  };

  const handleRevokeAccess = async (username: string, dbName: string) => {
    if (!subscriptionId) return;
    if (!confirm(`Revoke access to ${dbName} for user ${username}?`)) return;
    setUserActionLoading(username);
    try {
      await apiClient.put(`/hosting/mysql/${subscriptionId}/mysql-users/${encodeURIComponent(username)}/privileges`, {
        [dbName]: []
      });
      toast.success("User access revoked");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke access");
    } finally {
      setUserActionLoading(null);
    }
  };

  if (loading && databases.length === 0 && users.length === 0) {
    return (
      <section className={cn("rounded-2xl border bg-card shadow-sm")}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading MySQL data...</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={cn("rounded-2xl border bg-card shadow-sm")}>
        <div className="px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-3 w-3 mr-1.5" />
            Retry
          </Button>
        </div>
      </section>
    );
  }

  const currentUser = users.find((u) => u.username === accessHostUsername);

  return (
    <div className="space-y-6">
      {/* Databases */}
      <section className={cn("rounded-2xl border bg-card shadow-sm")}>
        <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
                <Database className="h-5 w-5 text-primary" />
                <span>Databases</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">Manage MySQL databases.</p>
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={dbDialogOpen} onOpenChange={setDbDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" />New DB</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Database</DialogTitle>
                    <DialogDescription>Add a new MySQL database.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label htmlFor="db-name">Database Name</Label>
                      <Input id="db-name" value={newDbName} onChange={(e) => setNewDbName(e.target.value)} placeholder="my_database" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDbDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateDb} disabled={creatingDb}>
                      {creatingDb && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="sm" onClick={loadData} disabled={refreshing}>
                <RefreshCw className={cn("h-3 w-3 mr-1.5", refreshing && "animate-spin")} />Refresh
              </Button>
            </div>
          </div>
        </div>
        <div className="px-6 sm:px-8 py-5">
          {databases.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No databases found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {databases.map((db) => (
                  <TableRow key={db.name}>
                    <TableCell className="font-medium">{db.name}</TableCell>
                    <TableCell>{formatDatabaseSize(db.size)}</TableCell>
                    <TableCell>{formatDate(db.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleDbSso(db.name)} disabled={dbActionLoading === db.name}>
                          {dbActionLoading === db.name ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
                          <span className="ml-1">SSO</span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDeleteDb(db.name)} disabled={dbActionLoading === db.name} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-3 w-3" /><span className="ml-1">Delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      {/* Users */}
      <section className={cn("rounded-2xl border bg-card shadow-sm")}>
        <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
                <UserCircle className="h-5 w-5 text-primary" /><span>Users</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">Manage MySQL users and privileges.</p>
            </div>
            <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" />New User</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create MySQL User</DialogTitle>
                  <DialogDescription>Add a new MySQL user.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="user-name">Username</Label>
                    <Input id="user-name" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="db_user" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-password">Password</Label>
                    <Input id="user-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setUserDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateUser} disabled={creatingUser}>
                    {creatingUser && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="px-6 sm:px-8 py-5">
          {users.length === 0 ? (
            <div className="text-center py-8">
              <UserCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No users found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Access Hosts</TableHead>
                  <TableHead>Grants</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.username}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.accessHosts?.length ? (
                          user.accessHosts.map((host) => (
                            <Badge key={host} variant="outline" className="text-xs">{host}</Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(() => {
                          const labels = getGrantLabels(user.grants);
                          return labels.length ? (
                            labels.map((grant) => (
                              <Badge key={grant} variant="outline" className="text-xs">{grant}</Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          );
                        })()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setAccessUser(user);
                            setAccessDb(databases.length > 0 ? databases[0].name : "");
                            setManageAccessOpen(true);
                          }} 
                          title="Manage database access"
                        >
                          <Database className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEditUser(user)} title="Change password">
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenAccessHosts(user)} title="Access hosts">
                          <Globe className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUser(user.username)}
                          disabled={userActionLoading === user.username}
                          className="text-destructive hover:text-destructive"
                          title="Delete user"
                        >
                          {userActionLoading === user.username ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      {/* Edit User Password Dialog */}
      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Update password for {editUsername}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="••••••••" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditUserOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSaveUser} disabled={savingUser || !editPassword}>
              {savingUser && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Access Hosts Dialog */}
      <Dialog open={accessHostOpen} onOpenChange={setAccessHostOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Access Hosts</DialogTitle>
            <DialogDescription>Manage allowed hosts for {accessHostUsername}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex flex-wrap gap-2">
              {currentUser?.accessHosts?.length ? (
                currentUser.accessHosts.map((host) => (
                  <div key={host} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
                    <span>{host}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveHost(host)}
                      disabled={removingHost === host}
                    >
                      {removingHost === host ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No access hosts configured.</p>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={newHost}
                onChange={(e) => setNewHost(e.target.value)}
                placeholder="e.g. 192.168.1.0/24 or %"
                className="flex-1"
                onKeyDown={(e) => { if (e.key === "Enter") handleAddHost(); }}
              />
              <Button size="sm" onClick={handleAddHost} disabled={addingHost || !newHost.trim()}>
                {addingHost ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAccessHostOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Access Dialog */}
      <Dialog open={manageAccessOpen} onOpenChange={setManageAccessOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Access</DialogTitle>
            <DialogDescription>
              Grant <span className="font-medium text-foreground">{accessUser?.username}</span> access to a database.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Database</Label>
              <Select value={accessDb} onValueChange={setAccessDb}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a database" />
                </SelectTrigger>
                <SelectContent>
                  {databases.length === 0 && <SelectItem value="none" disabled>No databases available</SelectItem>}
                  {databases.map((db) => (
                    <SelectItem key={db.name} value={db.name}>{db.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Privileges</Label>
              <Select value={accessPrivileges} onValueChange={setAccessPrivileges}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL PRIVILEGES">All Privileges</SelectItem>
                  <SelectItem value="SELECT, INSERT, UPDATE, DELETE">Read & Write</SelectItem>
                  <SelectItem value="SELECT">Read Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {accessUser?.grants && Object.keys(accessUser.grants).length > 0 && (
              <div className="mt-4 border rounded-md p-3">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Current Access</Label>
                <ul className="space-y-2">
                  {Object.entries(accessUser.grants).map(([dbName, privs]) => (
                    <li key={dbName} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium text-foreground">{dbName}</span>
                        <span className="text-xs text-muted-foreground block">{privs.join(", ")}</span>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 text-destructive px-2" onClick={() => handleRevokeAccess(accessUser.username, dbName)}>
                        Revoke
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setManageAccessOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleManageAccess} disabled={managingAccess || !accessDb || accessDb === "none"}>
              {managingAccess && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}Save Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
