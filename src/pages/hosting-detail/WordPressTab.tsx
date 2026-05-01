import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  ExternalLink,
  Users,
  Puzzle,
  Paintbrush,
  Settings,
  Globe,
  Plus,
  Trash2,
  Check,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WordPressInstallation {
  id: string;
  name: string;
  path?: string | null;
  version?: string | null;
  status?: string | null;
}

interface WordPressUser {
  id: string;
  username: string;
  email: string;
  role?: string | null;
}

interface WordPressPlugin {
  name: string;
  title?: string | null;
  version?: string | null;
  status?: string | null;
  update?: string | null;
  autoUpdate?: string | null;
}

interface WordPressTheme {
  name: string;
  version?: string | null;
  status?: string | null;
  update?: string | null;
  autoUpdate?: string | null;
}

interface WordPressSettings {
  autoUpdateCore?: "major" | "minor";
  disallowNonWpPhp: boolean;
  loginAccess: string[];
}

interface WordPressTabProps {
  subscriptionId: string;
}

export default function WordPressTab({ subscriptionId }: WordPressTabProps) {
  const [installations, setInstallations] = useState<WordPressInstallation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [users, setUsers] = useState<Record<string, WordPressUser[]>>({});
  const [plugins, setPlugins] = useState<Record<string, WordPressPlugin[]>>({});
  const [themes, setThemes] = useState<Record<string, WordPressTheme[]>>({});
  const [settings, setSettings] = useState<Record<string, WordPressSettings>>({});
  const [settingsLoading, setSettingsLoading] = useState<Record<string, boolean>>({});
  const [settingsSaving, setSettingsSaving] = useState<Record<string, boolean>>({});

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createUserAppId, setCreateUserAppId] = useState("");
  const [newUserUsername, setNewUserUsername] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("subscriber");
  const [creatingUser, setCreatingUser] = useState(false);

  const [installPluginOpen, setInstallPluginOpen] = useState(false);
  const [installPluginAppId, setInstallPluginAppId] = useState("");
  const [pluginSlug, setPluginSlug] = useState("");
  const [installingPlugin, setInstallingPlugin] = useState(false);

  const [installThemeOpen, setInstallThemeOpen] = useState(false);
  const [installThemeAppId, setInstallThemeAppId] = useState("");
  const [themeSlug, setThemeSlug] = useState("");
  const [installingTheme, setInstallingTheme] = useState(false);

  const loadInstallations = useCallback(async () => {
    if (!subscriptionId) return;
    setRefreshing(true);
    setError(null);
    try {
      const data = await apiClient.get<{ installations?: WordPressInstallation[] }>(
        `/hosting/wordpress/${subscriptionId}/wordpress`,
      );
      setInstallations(data.installations ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load WordPress installations";
      setError(message);
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
      setSettingsLoading((prev) => ({ ...prev, [appId]: true }));
      try {
        const [usersRes, settingsRes, pluginsRes, themesRes] = await Promise.all([
          apiClient.get<{ users?: WordPressUser[] }>(`/hosting/wordpress/${subscriptionId}/wordpress/${appId}/users`),
          apiClient.get<{ settings?: WordPressSettings }>(`/hosting/wordpress/${subscriptionId}/wordpress/${appId}/settings`),
          apiClient.get<{ plugins?: WordPressPlugin[] }>(`/hosting/wordpress/${subscriptionId}/wordpress/${appId}/plugins`),
          apiClient.get<{ themes?: WordPressTheme[] }>(`/hosting/wordpress/${subscriptionId}/wordpress/${appId}/themes`),
        ]);
        setUsers((prev) => ({ ...prev, [appId]: usersRes.users ?? [] }));
        if (settingsRes.settings) setSettings((prev) => ({ ...prev, [appId]: settingsRes.settings! }));
        setPlugins((prev) => ({ ...prev, [appId]: pluginsRes.plugins ?? [] }));
        setThemes((prev) => ({ ...prev, [appId]: themesRes.themes ?? [] }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load app details");
      } finally {
        setSettingsLoading((prev) => ({ ...prev, [appId]: false }));
      }
    },
    [subscriptionId],
  );

  const handleAccordionChange = (value: string) => {
    if (value && !users[value] && !settingsLoading[value]) {
      loadAppDetails(value);
    }
  };

  const handleSettingChange = (appId: string, key: keyof WordPressSettings, value: WordPressSettings[keyof WordPressSettings]) => {
    setSettings((prev) => ({ ...prev, [appId]: { ...prev[appId], [key]: value } }));
  };

  const saveSettings = async (appId: string) => {
    if (!subscriptionId || !settings[appId]) return;
    setSettingsSaving((prev) => ({ ...prev, [appId]: true }));
    try {
      await apiClient.patch(`/hosting/wordpress/${subscriptionId}/wordpress/${appId}/settings`, settings[appId]);
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSettingsSaving((prev) => ({ ...prev, [appId]: false }));
    }
  };

  const handleSso = async (appId: string, userId: string) => {
    try {
      const res = await apiClient.get<{ url?: string }>(
        `/hosting/wordpress/${subscriptionId}/wordpress/${appId}/users/${encodeURIComponent(userId)}/sso`,
      );
      if (res.url) {
        window.open(res.url, "_blank", "noopener,noreferrer");
      } else {
        toast.error("SSO URL not available");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to get SSO URL");
    }
  };

  const handleUpdateVersion = async (appId: string) => {
    if (!subscriptionId) return;
    setActionLoading(`version-${appId}`);
    try {
      await apiClient.patch(`/hosting/wordpress/${subscriptionId}/wordpress/${appId}/version`, {});
      toast.success("WordPress version update initiated");
      await loadAppDetails(appId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update version");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateUser = async () => {
    if (!subscriptionId || !createUserAppId) return;
    if (!newUserUsername.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      toast.error("All fields are required");
      return;
    }
    setCreatingUser(true);
    try {
      await apiClient.post(`/hosting/wordpress/${subscriptionId}/wordpress/${createUserAppId}/users`, {
        login: newUserUsername.trim(),
        email: newUserEmail.trim(),
        password: newUserPassword,
        role: newUserRole,
      });
      toast.success("User created");
      setCreateUserOpen(false);
      setNewUserUsername("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("subscriber");
      await loadAppDetails(createUserAppId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (appId: string, userId: string, username: string) => {
    if (!subscriptionId) return;
    if (!confirm(`Delete WordPress user "${username}"?`)) return;
    setActionLoading(`user-${userId}`);
    try {
      await apiClient.delete(`/hosting/wordpress/${subscriptionId}/wordpress/${appId}/users/${userId}`);
      toast.success(`User "${username}" deleted`);
      await loadAppDetails(appId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleInstallPlugin = async () => {
    if (!subscriptionId || !installPluginAppId || !pluginSlug.trim()) return;
    setInstallingPlugin(true);
    try {
      await apiClient.post(`/hosting/wordpress/${subscriptionId}/wordpress/${installPluginAppId}/plugins`, {
        slug: pluginSlug.trim(),
      });
      toast.success("Plugin installed");
      setInstallPluginOpen(false);
      setPluginSlug("");
      await loadAppDetails(installPluginAppId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to install plugin");
    } finally {
      setInstallingPlugin(false);
    }
  };

  const handleDeletePlugin = async (appId: string, pluginName: string) => {
    if (!subscriptionId) return;
    if (!confirm(`Delete plugin "${pluginName}"?`)) return;
    setActionLoading(`plugin-${pluginName}`);
    try {
      await apiClient.delete(`/hosting/wordpress/${subscriptionId}/wordpress/${appId}/plugins/${encodeURIComponent(pluginName)}`);
      toast.success(`Plugin "${pluginName}" deleted`);
      await loadAppDetails(appId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete plugin");
    } finally {
      setActionLoading(null);
    }
  };

  const handleInstallTheme = async () => {
    if (!subscriptionId || !installThemeAppId || !themeSlug.trim()) return;
    setInstallingTheme(true);
    try {
      await apiClient.post(`/hosting/wordpress/${subscriptionId}/wordpress/${installThemeAppId}/themes`, {
        slug: themeSlug.trim(),
      });
      toast.success("Theme installed");
      setInstallThemeOpen(false);
      setThemeSlug("");
      await loadAppDetails(installThemeAppId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to install theme");
    } finally {
      setInstallingTheme(false);
    }
  };

  const handleActivateTheme = async (appId: string, themeName: string) => {
    if (!subscriptionId) return;
    setActionLoading(`theme-${themeName}`);
    try {
      await apiClient.post(`/hosting/wordpress/${subscriptionId}/wordpress/${appId}/themes/${encodeURIComponent(themeName)}/activate`);
      toast.success(`Theme "${themeName}" activated`);
      await loadAppDetails(appId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to activate theme");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteTheme = async (appId: string, themeName: string) => {
    if (!subscriptionId) return;
    if (!confirm(`Delete theme "${themeName}"?`)) return;
    setActionLoading(`theme-${themeName}`);
    try {
      await apiClient.delete(`/hosting/wordpress/${subscriptionId}/wordpress/${appId}/themes/${encodeURIComponent(themeName)}`);
      toast.success(`Theme "${themeName}" deleted`);
      await loadAppDetails(appId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete theme");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && installations.length === 0) {
    return (
      <section className={cn("rounded-2xl border bg-card shadow-sm")}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading WordPress installations...</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={cn("rounded-2xl border bg-card shadow-sm")}>
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
    <section className={cn("rounded-2xl border bg-card shadow-sm")}>
      <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
              <Globe className="h-5 w-5 text-primary" />
              <span>WordPress Installations</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Manage WordPress sites.</p>
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
            <p className="text-sm text-muted-foreground">No WordPress installations found.</p>
          </div>
        ) : (
          <Accordion type="single" collapsible onValueChange={handleAccordionChange}>
            {installations.map((app) => (
              <AccordionItem key={app.id} value={app.id}>
                <AccordionTrigger>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">{app.name}</span>
                    {app.version && <Badge variant="outline">v{app.version}</Badge>}
                    {app.status && <Badge variant={app.status === "active" ? "default" : "secondary"}>{app.status}</Badge>}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pb-2">
                    {settingsLoading[app.id] ? (
                      <div className="flex items-center gap-2 py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Loading details...</span>
                      </div>
                    ) : (
                      <>
                        {/* Version */}
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleUpdateVersion(app.id)} disabled={actionLoading === `version-${app.id}`}>
                            {actionLoading === `version-${app.id}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                            Update Version
                          </Button>
                        </div>

                        {/* Settings */}
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Settings className="h-4 w-4 text-muted-foreground" />Settings
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {!settings[app.id] ? (
                              <p className="text-sm text-muted-foreground">Settings unavailable.</p>
                            ) : (
                              <>
                                <div className="grid gap-2 sm:grid-cols-[1fr_180px] sm:items-center">
                                  <div className="space-y-0.5">
                                    <Label className="text-sm">Core auto-update</Label>
                                    <p className="text-xs text-muted-foreground">WordPress core update policy.</p>
                                  </div>
                                  <Select
                                    value={settings[app.id]?.autoUpdateCore ?? "minor"}
                                    onValueChange={(value) => handleSettingChange(app.id, "autoUpdateCore", value as "major" | "minor")}
                                  >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="minor">Minor releases</SelectItem>
                                      <SelectItem value="major">Major releases</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="space-y-0.5">
                                    <Label className="text-sm">Disallow non-WordPress PHP</Label>
                                    <p className="text-xs text-muted-foreground">Block PHP files outside WordPress core paths.</p>
                                  </div>
                                  <Switch
                                    checked={Boolean(settings[app.id]?.disallowNonWpPhp)}
                                    onCheckedChange={(value) => handleSettingChange(app.id, "disallowNonWpPhp", value)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-sm">Login access allowlist</Label>
                                  <Input
                                    value={(settings[app.id]?.loginAccess ?? []).join(", ")}
                                    onChange={(event) => handleSettingChange(app.id, "loginAccess", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))}
                                    placeholder="192.0.2.10, 198.51.100.0/24"
                                  />
                                </div>
                                <div className="flex justify-end">
                                  <Button size="sm" onClick={() => saveSettings(app.id)} disabled={settingsSaving[app.id]}>
                                    {settingsSaving[app.id] && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                                    Save Settings
                                  </Button>
                                </div>
                              </>
                            )}
                          </CardContent>
                        </Card>

                        {/* Users */}
                        <Card>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Users className="h-4 w-4 text-muted-foreground" />Users
                              </CardTitle>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setCreateUserAppId(app.id);
                                  setCreateUserOpen(true);
                                }}
                              >
                                <Plus className="h-3 w-3 mr-1" />Add User
                              </Button>
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
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {users[app.id]?.map((user) => (
                                    <TableRow key={user.id}>
                                      <TableCell className="font-medium">{user.username}</TableCell>
                                      <TableCell>{user.email}</TableCell>
                                      <TableCell>{user.role ? <Badge variant="secondary">{user.role}</Badge> : "—"}</TableCell>
                                      <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          <Button variant="ghost" size="sm" onClick={() => handleSso(app.id, user.id)}>
                                            <ExternalLink className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteUser(app.id, user.id, user.username)}
                                            disabled={actionLoading === `user-${user.id}`}
                                            className="text-destructive hover:text-destructive"
                                          >
                                            {actionLoading === `user-${user.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
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

                        {/* Plugins */}
                        <Card>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Puzzle className="h-4 w-4 text-muted-foreground" />Plugins
                              </CardTitle>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setInstallPluginAppId(app.id);
                                  setInstallPluginOpen(true);
                                }}
                              >
                                <Plus className="h-3 w-3 mr-1" />Install
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {(plugins[app.id]?.length ?? 0) === 0 ? (
                              <p className="text-sm text-muted-foreground">No plugins found.</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {plugins[app.id]?.map((plugin) => (
                                  <div
                                    key={plugin.name}
                                    className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs"
                                  >
                                    <Badge variant={plugin.status === "active" ? "default" : "outline"} className="text-[10px] px-1.5">
                                      {plugin.status === "active" ? "on" : "off"}
                                    </Badge>
                                    <span>{plugin.title || plugin.name}{plugin.version ? ` v${plugin.version}` : ""}</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-4 w-4 p-0 text-destructive hover:text-destructive"
                                      onClick={() => handleDeletePlugin(app.id, plugin.name)}
                                      disabled={actionLoading === `plugin-${plugin.name}`}
                                    >
                                      {actionLoading === `plugin-${plugin.name}` ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Trash2 className="h-2.5 w-2.5" />}
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* Themes */}
                        <Card>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Paintbrush className="h-4 w-4 text-muted-foreground" />Themes
                              </CardTitle>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setInstallThemeAppId(app.id);
                                  setInstallThemeOpen(true);
                                }}
                              >
                                <Plus className="h-3 w-3 mr-1" />Install
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {(themes[app.id]?.length ?? 0) === 0 ? (
                              <p className="text-sm text-muted-foreground">No themes found.</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {themes[app.id]?.map((theme) => (
                                  <div
                                    key={theme.name}
                                    className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs"
                                  >
                                    <Badge variant={theme.status === "active" ? "default" : "outline"} className="text-[10px] px-1.5">
                                      {theme.status === "active" ? "active" : theme.status ?? "inactive"}
                                    </Badge>
                                    <span>{theme.name}{theme.version ? ` v${theme.version}` : ""}</span>
                                    {theme.status !== "active" && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-4 w-4 p-0"
                                        onClick={() => handleActivateTheme(app.id, theme.name)}
                                        disabled={actionLoading === `theme-${theme.name}`}
                                        title="Activate"
                                      >
                                        {actionLoading === `theme-${theme.name}` ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Check className="h-2.5 w-2.5" />}
                                      </Button>
                                    )}
                                    {theme.status !== "active" && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-4 w-4 p-0 text-destructive hover:text-destructive"
                                        onClick={() => handleDeleteTheme(app.id, theme.name)}
                                        disabled={actionLoading === `theme-${theme.name}`}
                                        title="Delete"
                                      >
                                        <Trash2 className="h-2.5 w-2.5" />
                                      </Button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>

      {/* Create User Dialog */}
      <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create WordPress User</DialogTitle>
            <DialogDescription>Add a new user to this WordPress installation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={newUserUsername} onChange={(e) => setNewUserUsername(e.target.value)} placeholder="admin" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newUserRole} onValueChange={setNewUserRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="administrator">Administrator</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="author">Author</SelectItem>
                  <SelectItem value="contributor">Contributor</SelectItem>
                  <SelectItem value="subscriber">Subscriber</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateUserOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreateUser} disabled={creatingUser}>
              {creatingUser && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Install Plugin Dialog */}
      <Dialog open={installPluginOpen} onOpenChange={setInstallPluginOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Install Plugin</DialogTitle>
            <DialogDescription>Enter the WordPress.org plugin slug to install.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Plugin Slug</Label>
              <Input value={pluginSlug} onChange={(e) => setPluginSlug(e.target.value)} placeholder="woocommerce" />
              <p className="text-xs text-muted-foreground">Find slugs at wordpress.org/plugins</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setInstallPluginOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleInstallPlugin} disabled={installingPlugin || !pluginSlug.trim()}>
              {installingPlugin && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}Install
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Install Theme Dialog */}
      <Dialog open={installThemeOpen} onOpenChange={setInstallThemeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Install Theme</DialogTitle>
            <DialogDescription>Enter the WordPress.org theme slug to install.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Theme Slug</Label>
              <Input value={themeSlug} onChange={(e) => setThemeSlug(e.target.value)} placeholder="twentytwentyfour" />
              <p className="text-xs text-muted-foreground">Find slugs at wordpress.org/themes</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setInstallThemeOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleInstallTheme} disabled={installingTheme || !themeSlug.trim()}>
              {installingTheme && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}Install
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
