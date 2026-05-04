import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface JoomlaInstallation {
  id: string;
  name: string;
  path?: string | null;
  version?: string | null;
  status?: string | null;
}

interface JoomlaInfo {
  version?: string | null;
  siteUrl?: string | null;
  pluginCount?: number | null;
  userCount?: number | null;
}

interface JoomlaUser {
  id: string;
  username: string;
  name?: string | null;
  email: string;
  blocked?: boolean;
  superUser?: boolean;
}

interface JoomlaTabProps {
  subscriptionId: string;
}

export default function JoomlaTab({ subscriptionId }: JoomlaTabProps) {
  const [installations, setInstallations] = useState<JoomlaInstallation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState<Record<string, boolean>>({});
  const [infos, setInfos] = useState<Record<string, JoomlaInfo>>({});
  const [users, setUsers] = useState<Record<string, JoomlaUser[]>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createUserAppId, setCreateUserAppId] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);

  const [editUserDialog, setEditUserDialog] = useState<{ appId: string; user: JoomlaUser } | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [updatingUser, setUpdatingUser] = useState(false);

  const loadInstallations = useCallback(async () => {
    if (!subscriptionId) return;
    setRefreshing(true);
    setError(null);
    try {
      const data = await apiClient.get<{ installations?: JoomlaInstallation[] }>(`/hosting/joomla/${subscriptionId}/joomla`);
      setInstallations(data.installations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Joomla installations");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [subscriptionId]);

  useEffect(() => {
    loadInstallations();
  }, [loadInstallations]);

  const loadAppDetails = useCallback(
    async (appId: string) => {
      if (!subscriptionId) return;
      setDetailsLoading((prev) => ({ ...prev, [appId]: true }));
      try {
        const [infoRes, usersRes] = await Promise.all([
          apiClient.get<{ info?: JoomlaInfo }>(`/hosting/joomla/${subscriptionId}/joomla/${appId}/info`),
          apiClient.get<{ users?: JoomlaUser[] }>(`/hosting/joomla/${subscriptionId}/joomla/${appId}/users`),
        ]);
        setInfos((prev) => ({ ...prev, [appId]: infoRes.info ?? {} }));
        setUsers((prev) => ({ ...prev, [appId]: usersRes.users ?? [] }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load Joomla details");
      } finally {
        setDetailsLoading((prev) => ({ ...prev, [appId]: false }));
      }
    },
    [subscriptionId],
  );

  const handleAccordionChange = (value: string) => {
    if (value && !users[value] && !detailsLoading[value]) {
      loadAppDetails(value);
    }
  };

  const openCreateUser = (appId: string) => {
    setCreateUserAppId(appId);
    setNewUsername("");
    setNewEmail("");
    setNewPassword("");
    setCreateUserOpen(true);
  };

  const handleCreateUser = async () => {
    if (!subscriptionId || !createUserAppId) return;
    if (!newUsername.trim() || !newEmail.trim() || !newPassword.trim()) {
      toast.error("Username, email, and password are required");
      return;
    }
    setCreatingUser(true);
    try {
      await apiClient.post(`/hosting/joomla/${subscriptionId}/joomla/${createUserAppId}/users`, {
        username: newUsername.trim(),
        email: newEmail.trim(),
        password: newPassword,
      });
      toast.success("Joomla user created");
      setCreateUserOpen(false);
      await loadAppDetails(createUserAppId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create Joomla user");
    } finally {
      setCreatingUser(false);
    }
  };

  const openEditUser = (appId: string, user: JoomlaUser) => {
    setEditUserDialog({ appId, user });
    setEditUsername(user.username);
    setEditEmail(user.email);
    setEditPassword("");
  };

  const closeEditUser = () => {
    setEditUserDialog(null);
    setEditPassword("");
  };

  const handleSaveEditUser = async () => {
    if (!subscriptionId || !editUserDialog) return;
    const { appId, user } = editUserDialog;
    const payload: Record<string, string> = {};
    if (editUsername.trim() && editUsername.trim() !== user.username) payload.username = editUsername.trim();
    if (editEmail.trim() && editEmail.trim() !== user.email) payload.email = editEmail.trim();
    if (editPassword.trim()) payload.password = editPassword;
    if (Object.keys(payload).length === 0) {
      toast.error("Change username, email, or set a new password");
      return;
    }

    setUpdatingUser(true);
    try {
      await apiClient.patch(`/hosting/joomla/${subscriptionId}/joomla/${appId}/users/${encodeURIComponent(user.username)}`, payload);
      toast.success("Joomla user updated");
      closeEditUser();
      await loadAppDetails(appId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update Joomla user");
    } finally {
      setUpdatingUser(false);
    }
  };

  const handleDeleteUser = async (appId: string, username: string) => {
    if (!subscriptionId) return;
    if (!confirm(`Delete Joomla user "${username}"?`)) return;
    setActionLoading(`user-${username}`);
    try {
      await apiClient.delete(`/hosting/joomla/${subscriptionId}/joomla/${appId}/users/${encodeURIComponent(username)}`);
      toast.success(`Joomla user "${username}" deleted`);
      await loadAppDetails(appId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete Joomla user");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && installations.length === 0) {
    return (
      <section className={cn("rounded-2xl cyber-card cyber-card--hover")}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading Joomla installations...</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={cn("rounded-2xl cyber-card cyber-card--hover")}>
        <div className="px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={loadInstallations}>
            <RefreshCw className="h-3 w-3 mr-1.5" />Retry
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className={cn("rounded-2xl cyber-card cyber-card--hover")}>
      <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
              <Globe className="h-5 w-5 text-primary" />
              <span>Joomla Installations</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Manage Joomla users through documented Enhance endpoints.</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadInstallations} disabled={refreshing}>
            <RefreshCw className={cn("h-3 w-3 mr-1.5", refreshing && "animate-spin")} />Refresh
          </Button>
        </div>
      </div>

      <div className="px-6 sm:px-8 py-5">
        {installations.length === 0 ? (
          <div className="text-center py-8">
            <Globe className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No Joomla installations found.</p>
          </div>
        ) : (
          <Accordion type="single" collapsible onValueChange={handleAccordionChange}>
            {installations.map((app) => {
              const info = infos[app.id];
              return (
                <AccordionItem key={app.id} value={app.id}>
                  <AccordionTrigger>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm">{app.name}</span>
                      {(info?.version ?? app.version) && <Badge variant="outline">v{info?.version ?? app.version}</Badge>}
                      {app.status && <Badge variant={app.status === "active" ? "default" : "secondary"}>{app.status}</Badge>}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pb-2">
                      {detailsLoading[app.id] ? (
                        <div className="flex items-center gap-2 py-4">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Loading details...</span>
                        </div>
                      ) : (
                        <>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <Card className="border-primary/25">
                              <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Version</CardTitle></CardHeader>
                              <CardContent className="text-sm font-medium">{info?.version ?? app.version ?? "Unknown"}</CardContent>
                            </Card>
                            <Card className="border-primary/25">
                              <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Users</CardTitle></CardHeader>
                              <CardContent className="text-sm font-medium">{info?.userCount ?? users[app.id]?.length ?? 0}</CardContent>
                            </Card>
                            <Card className="border-primary/25">
                              <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Plugins</CardTitle></CardHeader>
                              <CardContent className="text-sm font-medium">{info?.pluginCount ?? 0}</CardContent>
                            </Card>
                            <Card className="border-primary/25">
                              <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Site URL</CardTitle></CardHeader>
                              <CardContent className="text-sm font-medium">
                                {info?.siteUrl ? (
                                  <a className="inline-flex items-center gap-1 text-primary hover:underline" href={info.siteUrl} target="_blank" rel="noreferrer">
                                    Open site <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : "Unavailable"}
                              </CardContent>
                            </Card>
                          </div>

                          <Card className="border-primary/25">
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-sm flex items-center gap-2">
                                  <Users className="h-4 w-4 text-muted-foreground" />Users
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                  <Button variant="outline" size="sm" onClick={() => loadAppDetails(app.id)} disabled={detailsLoading[app.id]}>
                                    <RefreshCw className={cn("h-3 w-3 mr-1", detailsLoading[app.id] && "animate-spin")} />Refresh
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => openCreateUser(app.id)}>
                                    <Plus className="h-3 w-3 mr-1" />Add User
                                  </Button>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent>
                              {(users[app.id]?.length ?? 0) === 0 ? (
                                <p className="text-sm text-muted-foreground">No users found.</p>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Username</TableHead>
                                      <TableHead>Name</TableHead>
                                      <TableHead>Email</TableHead>
                                      <TableHead>Status</TableHead>
                                      <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {users[app.id]?.map((user) => (
                                      <TableRow key={user.id || user.username}>
                                        <TableCell className="font-medium">{user.username}</TableCell>
                                        <TableCell>{user.name || "-"}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>
                                          <div className="flex flex-wrap gap-1">
                                            <Badge variant={user.blocked ? "secondary" : "outline"} className="text-[10px] font-normal">
                                              {user.blocked ? "Blocked" : <><CheckCircle2 className="mr-1 h-3 w-3" />Active</>}
                                            </Badge>
                                            {user.superUser && (
                                              <Badge variant="default" className="text-[10px] font-normal">
                                                <ShieldCheck className="mr-1 h-3 w-3" />Super User
                                              </Badge>
                                            )}
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <div className="flex items-center justify-end gap-1">
                                            <Button variant="ghost" size="sm" aria-label="Edit Joomla user" onClick={() => openEditUser(app.id, user)} disabled={updatingUser}>
                                              <Pencil className="h-3 w-3" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              aria-label="Delete Joomla user"
                                              onClick={() => handleDeleteUser(app.id, user.username)}
                                              disabled={actionLoading === `user-${user.username}`}
                                              className="text-destructive hover:text-destructive"
                                            >
                                              {actionLoading === `user-${user.username}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                            </CardContent>
                          </Card>
                        </>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>

      <Dialog open={Boolean(editUserDialog)} onOpenChange={(open) => { if (!open) closeEditUser(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Joomla User</DialogTitle>
            <DialogDescription>Update Joomla username, email, or password using documented Enhance endpoints.</DialogDescription>
          </DialogHeader>
          {editUserDialog ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="joomla-edit-username">Username</Label>
                <Input id="joomla-edit-username" value={editUsername} onChange={(event) => setEditUsername(event.target.value)} autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="joomla-edit-email">Email</Label>
                <Input id="joomla-edit-email" type="email" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="joomla-edit-password">New password</Label>
                <Input id="joomla-edit-password" type="password" value={editPassword} onChange={(event) => setEditPassword(event.target.value)} placeholder="Leave blank to keep current" autoComplete="new-password" />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={closeEditUser} disabled={updatingUser}>Cancel</Button>
            <Button size="sm" onClick={() => void handleSaveEditUser()} disabled={updatingUser}>
              {updatingUser && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Joomla User</DialogTitle>
            <DialogDescription>Add a Joomla user with the documented username, email, and password fields.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={newUsername} onChange={(event) => setNewUsername(event.target.value)} placeholder="admin" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="user@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Password" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateUserOpen(false)} disabled={creatingUser}>Cancel</Button>
            <Button size="sm" onClick={handleCreateUser} disabled={creatingUser}>
              {creatingUser && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
