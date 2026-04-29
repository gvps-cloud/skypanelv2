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
  const [activeAppId, setActiveAppId] = useState<string | null>(null);

  const [users, setUsers] = useState<Record<string, WordPressUser[]>>({});
  const [plugins, setPlugins] = useState<Record<string, WordPressPlugin[]>>({});
  const [themes, setThemes] = useState<Record<string, WordPressTheme[]>>({});
  const [settings, setSettings] = useState<Record<string, WordPressSettings>>({});
  const [settingsLoading, setSettingsLoading] = useState<Record<string, boolean>>({});
  const [settingsSaving, setSettingsSaving] = useState<Record<string, boolean>>({});

  const loadInstallations = useCallback(async () => {
    if (!subscriptionId) return;
    setRefreshing(true);
    setError(null);
    try {
      const data = await apiClient.get<{ installations?: WordPressInstallation[] }>(
        `/hosting/wordpress/${subscriptionId}/wordpress`
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
          apiClient.get<{ users?: WordPressUser[] }>(
            `/hosting/wordpress/${subscriptionId}/wordpress/${appId}/users`
          ),
          apiClient.get<{ settings?: WordPressSettings }>(
            `/hosting/wordpress/${subscriptionId}/wordpress/${appId}/settings`
          ),
          apiClient.get<{ plugins?: WordPressPlugin[] }>(
            `/hosting/wordpress/${subscriptionId}/wordpress/${appId}/plugins`
          ),
          apiClient.get<{ themes?: WordPressTheme[] }>(
            `/hosting/wordpress/${subscriptionId}/wordpress/${appId}/themes`
          ),
        ]);

        setUsers((prev) => ({ ...prev, [appId]: usersRes.users ?? [] }));
        if (settingsRes.settings) {
          setSettings((prev) => ({ ...prev, [appId]: settingsRes.settings! }));
        }
        setPlugins((prev) => ({ ...prev, [appId]: pluginsRes.plugins ?? [] }));
        setThemes((prev) => ({ ...prev, [appId]: themesRes.themes ?? [] }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load app details");
      } finally {
        setSettingsLoading((prev) => ({ ...prev, [appId]: false }));
      }
    },
    [subscriptionId]
  );

  const handleAccordionChange = (value: string) => {
    const appId = value;
    setActiveAppId(appId);
    if (appId && !users[appId] && !settingsLoading[appId]) {
      loadAppDetails(appId);
    }
  };

  const handleSettingChange = (
    appId: string,
    key: keyof WordPressSettings,
    value: WordPressSettings[keyof WordPressSettings]
  ) => {
    setSettings((prev) => ({
      ...prev,
      [appId]: { ...prev[appId], [key]: value },
    }));
  };

  const saveSettings = async (appId: string) => {
    if (!subscriptionId) return;
    if (!settings[appId]) {
      toast.error("WordPress settings are not loaded");
      return;
    }
    setSettingsSaving((prev) => ({ ...prev, [appId]: true }));
    try {
      await apiClient.patch(
        `/hosting/wordpress/${subscriptionId}/wordpress/${appId}/settings`,
        settings[appId]
      );
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
        `/hosting/wordpress/${subscriptionId}/wordpress/${appId}/users/${encodeURIComponent(userId)}/sso`
      );
      const url = res.url;
      if (!url) {
        toast.error("SSO URL not available");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to get SSO URL");
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
            <RefreshCw className="h-3 w-3 mr-1.5" />
            Retry
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
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Manage WordPress sites for this subscription.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadInstallations} disabled={refreshing}>
            <RefreshCw className={cn("h-3 w-3 mr-1.5", refreshing && "animate-spin")} />
            Refresh
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
                    {app.status && (
                      <Badge variant={app.status === "active" ? "default" : "secondary"}>{app.status}</Badge>
                    )}
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
                        {/* Settings */}
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Settings className="h-4 w-4 text-muted-foreground" />
                              Settings
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {!settings[app.id] ? (
                              <p className="text-sm text-muted-foreground">Settings are unavailable for this installation.</p>
                            ) : (
                              <>
                                <div className="grid gap-2 sm:grid-cols-[1fr_180px] sm:items-center">
                                  <div className="space-y-0.5">
                                    <Label className="text-sm">Core auto-update</Label>
                                    <p className="text-xs text-muted-foreground">Enhance-supported WordPress core update policy.</p>
                                  </div>
                                  <Select
                                    value={settings[app.id]?.autoUpdateCore ?? "minor"}
                                    onValueChange={(value) =>
                                      handleSettingChange(app.id, "autoUpdateCore", value as "major" | "minor")
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
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
                                    onChange={(event) =>
                                      handleSettingChange(
                                        app.id,
                                        "loginAccess",
                                        event.target.value
                                          .split(",")
                                          .map((item) => item.trim())
                                          .filter(Boolean),
                                      )
                                    }
                                    placeholder="192.0.2.10, 198.51.100.0/24"
                                  />
                                </div>
                                <div className="flex justify-end">
                                  <Button
                                    size="sm"
                                    onClick={() => saveSettings(app.id)}
                                    disabled={settingsSaving[app.id]}
                                  >
                                    {settingsSaving[app.id] ? (
                                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                    ) : null}
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
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              Users
                            </CardTitle>
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
                                      <TableCell>
                                        {user.role ? <Badge variant="secondary">{user.role}</Badge> : "—"}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleSso(app.id, user.id)}
                                        >
                                          <ExternalLink className="h-3 w-3 mr-1" />
                                          SSO
                                        </Button>
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
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Puzzle className="h-4 w-4 text-muted-foreground" />
                              Plugins
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {(plugins[app.id]?.length ?? 0) === 0 ? (
                              <p className="text-sm text-muted-foreground">No plugins found.</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {plugins[app.id]?.map((plugin) => (
                                  <Badge key={plugin.name} variant={plugin.status === "active" ? "default" : "outline"}>
                                    {plugin.title || plugin.name}{plugin.version ? ` v${plugin.version}` : ""}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* Themes */}
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Paintbrush className="h-4 w-4 text-muted-foreground" />
                              Themes
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {(themes[app.id]?.length ?? 0) === 0 ? (
                              <p className="text-sm text-muted-foreground">No themes found.</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {themes[app.id]?.map((theme) => (
                                  <Badge key={theme.name} variant={theme.status === "active" ? "default" : "outline"}>
                                    {theme.name}{theme.version ? ` v${theme.version}` : ""}
                                  </Badge>
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
    </section>
  );
}
