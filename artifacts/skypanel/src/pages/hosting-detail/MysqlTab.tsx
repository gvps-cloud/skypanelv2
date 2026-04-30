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
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    if (!newDbName.trim()) {
      toast.error("Database name is required");
      return;
    }
    setCreatingDb(true);
    try {
      await apiClient.post(`/hosting/mysql/${subscriptionId}/mysql-dbs`, {
        name: newDbName.trim(),
      });
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
    if (!confirm(`Are you sure you want to delete database "${dbName}"?`)) return;
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
        `/hosting/mysql/${subscriptionId}/mysql-dbs/${encodeURIComponent(dbName)}/sso`
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
    if (!newUsername.trim() || !newPassword.trim()) {
      toast.error("Username and password are required");
      return;
    }
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
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) return;
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
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Manage MySQL databases for this subscription.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={dbDialogOpen} onOpenChange={setDbDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    New DB
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Database</DialogTitle>
                    <DialogDescription>
                      Add a new MySQL database.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label htmlFor="db-name">Database Name</Label>
                      <Input
                        id="db-name"
                        value={newDbName}
                        onChange={(e) => setNewDbName(e.target.value)}
                        placeholder="my_database"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDbDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateDb} disabled={creatingDb}>
                      {creatingDb && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                      Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="sm" onClick={loadData} disabled={refreshing}>
                <RefreshCw className={cn("h-3 w-3 mr-1.5", refreshing && "animate-spin")} />
                Refresh
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDbSso(db.name)}
                          disabled={dbActionLoading === db.name}
                        >
                          {dbActionLoading === db.name ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <ExternalLink className="h-3 w-3" />
                          )}
                          <span className="ml-1">SSO</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteDb(db.name)}
                          disabled={dbActionLoading === db.name}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span className="ml-1">Delete</span>
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
                <UserCircle className="h-5 w-5 text-primary" />
                <span>Users</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Manage MySQL users and privileges.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    New User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create MySQL User</DialogTitle>
                    <DialogDescription>
                      Add a new MySQL user.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label htmlFor="user-name">Username</Label>
                      <Input
                        id="user-name"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="db_user"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user-password">Password</Label>
                      <Input
                        id="user-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setUserDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateUser} disabled={creatingUser}>
                      {creatingUser && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                      Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
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
                            <Badge key={host} variant="outline" className="text-xs">
                              {host}
                            </Badge>
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
                              <Badge key={grant} variant="outline" className="text-xs">
                                {grant}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          );
                        })()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteUser(user.username)}
                        disabled={userActionLoading === user.username}
                        className="text-destructive hover:text-destructive"
                      >
                        {userActionLoading === user.username ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                        <span className="ml-1">Delete</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>
    </div>
  );
}
