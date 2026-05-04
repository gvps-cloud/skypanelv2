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
  Bug,
  Globe,
  Plus,
  Trash2,
  Check,
  Search,
  Download,
  Pencil,
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
  displayName?: string | null;
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

interface WordPressCatalogItem {
  slug: string;
  name: string;
  version?: string | null;
  author?: string | null;
  rating?: number | null;
  activeInstalls?: number | null;
  downloads?: number | null;
  lastUpdated?: string | null;
  shortDescription?: string | null;
  imageUrl?: string | null;
  homepageUrl?: string | null;
}

interface WordPressCatalogResponse {
  items?: WordPressCatalogItem[];
  page?: number;
  pages?: number;
  total?: number;
}

interface WordPressSettings {
  autoUpdateCore?: "major" | "minor";
  loginAccess: string[];
}

type MaintenanceModeStatus = "active" | "deactivated";

/** Enhance `WordpressConfig` debug keys (`repo-docs/enhance-oas3-api.yaml`, schemas WpDebug, WpDebugLog, WpDebugDisplay). */
const WORDPRESS_DEBUG_OPTION_KEYS = ["WpDebug", "WpDebugLog", "WpDebugDisplay"] as const;
type WordPressDebugOptionKey = (typeof WORDPRESS_DEBUG_OPTION_KEYS)[number];

interface WordPressDebugFlags {
  WpDebug: boolean;
  WpDebugLog: boolean;
  WpDebugDisplay: boolean;
}

function readWpConfigBool(payload: unknown, key: WordPressDebugOptionKey): boolean {
  if (!payload || typeof payload !== "object") return false;
  const v = (payload as Record<string, unknown>)[key];
  return v === true || v === "true" || v === 1;
}

interface WordPressTabProps {
  subscriptionId: string;
}

function readVersionValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && typeof (value as Record<string, unknown>).version === "string") {
    return String((value as Record<string, unknown>).version).trim();
  }
  return null;
}

function formatCatalogMetric(value?: number | null): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat(undefined, { notation: value >= 10000 ? "compact" : "standard" }).format(value);
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
  const [maintenanceModes, setMaintenanceModes] = useState<Record<string, MaintenanceModeStatus>>({});
  const [versions, setVersions] = useState<Record<string, string>>({});
  const [wpDebugFlags, setWpDebugFlags] = useState<Record<string, WordPressDebugFlags>>({});
  const [settingsLoading, setSettingsLoading] = useState<Record<string, boolean>>({});
  const [settingsSaving, setSettingsSaving] = useState<Record<string, boolean>>({});

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createUserAppId, setCreateUserAppId] = useState("");
  const [newUserUsername, setNewUserUsername] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);

  const [editUserDialog, setEditUserDialog] = useState<{ appId: string; user: WordPressUser } | null>(null);
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserDisplayName, setEditUserDisplayName] = useState("");
  const [editUserPassword, setEditUserPassword] = useState("");
  const [updatingUser, setUpdatingUser] = useState(false);

  const [installPluginOpen, setInstallPluginOpen] = useState(false);
  const [installPluginAppId, setInstallPluginAppId] = useState("");
  const [pluginSlug, setPluginSlug] = useState("");
  const [pluginSearch, setPluginSearch] = useState("");
  const [pluginCatalog, setPluginCatalog] = useState<WordPressCatalogItem[]>([]);
  const [pluginCatalogPage, setPluginCatalogPage] = useState(1);
  const [pluginCatalogPages, setPluginCatalogPages] = useState(0);
  const [pluginCatalogLoading, setPluginCatalogLoading] = useState(false);
  const [installingPlugin, setInstallingPlugin] = useState(false);

  const [installThemeOpen, setInstallThemeOpen] = useState(false);
  const [installThemeAppId, setInstallThemeAppId] = useState("");
  const [themeSlug, setThemeSlug] = useState("");
  const [themeSearch, setThemeSearch] = useState("");
  const [themeCatalog, setThemeCatalog] = useState<WordPressCatalogItem[]>([]);
  const [themeCatalogPage, setThemeCatalogPage] = useState(1);
  const [themeCatalogPages, setThemeCatalogPages] = useState(0);
  const [themeCatalogLoading, setThemeCatalogLoading] = useState(false);
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
    async (appId: string, options?: { refreshCache?: boolean }) => {
      if (!subscriptionId) return;
      setSettingsLoading((prev) => ({ ...prev, [appId]: true }));
      try {
        const cacheQuery = options?.refreshCache ? "?refreshCache=true" : "";
        const wpConfigReads = WORDPRESS_DEBUG_OPTION_KEYS.map((key) =>
          apiClient
            .get<unknown>(`/hosting/wordpress/${subscriptionId}/wordpress/${appId}/wp-config/${encodeURIComponent(key)}`)
            .then((payload) => readWpConfigBool(payload, key))
            .catch(() => false),
        );

        const [usersRes, settingsRes, pluginsRes, themesRes, versionRes, maintenanceRes, ...debugBools] = await Promise.all([
          apiClient.get<{ users?: WordPressUser[] }>(`/hosting/wordpress/${subscriptionId}/wordpress/${appId}/users${cacheQuery}`),
          apiClient.get<{ settings?: WordPressSettings }>(`/hosting/wordpress/${subscriptionId}/wordpress/${appId}/settings`),
          apiClient.get<{ plugins?: WordPressPlugin[] }>(`/hosting/wordpress/${subscriptionId}/wordpress/${appId}/plugins${cacheQuery}`),
          apiClient.get<{ themes?: WordPressTheme[] }>(`/hosting/wordpress/${subscriptionId}/wordpress/${appId}/themes${cacheQuery}`),
          apiClient.get<{ version?: string }>(`/hosting/wordpress/${subscriptionId}/wordpress/${appId}/version`),
          apiClient.get<{ status?: MaintenanceModeStatus }>(`/hosting/wordpress/${subscriptionId}/wordpress/${appId}/maintenance-mode`),
          ...wpConfigReads,
        ]);

        const debugPayload: WordPressDebugFlags = {
          WpDebug: Boolean(debugBools[0]),
          WpDebugLog: Boolean(debugBools[1]),
          WpDebugDisplay: Boolean(debugBools[2]),
        };
        setWpDebugFlags((prev) => ({ ...prev, [appId]: debugPayload }));

        setUsers((prev) => ({ ...prev, [appId]: usersRes.users ?? [] }));
        if (settingsRes.settings) setSettings((prev) => ({ ...prev, [appId]: settingsRes.settings! }));
        setPlugins((prev) => ({ ...prev, [appId]: pluginsRes.plugins ?? [] }));
        setThemes((prev) => ({ ...prev, [appId]: themesRes.themes ?? [] }));
        setMaintenanceModes((prev) => ({ ...prev, [appId]: maintenanceRes.status ?? "deactivated" }));
        const version = readVersionValue(versionRes);
        if (version) setVersions((prev) => ({ ...prev, [appId]: version }));
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
      await loadAppDetails(appId, { refreshCache: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSettingsSaving((prev) => ({ ...prev, [appId]: false }));
    }
  };

  const handleToggleMaintenanceMode = async (appId: string, enabled: boolean) => {
    if (!subscriptionId) return;
    setActionLoading(`maintenance-${appId}`);
    try {
      const result = await apiClient.put<{ status?: MaintenanceModeStatus }>(
        `/hosting/wordpress/${subscriptionId}/wordpress/${appId}/maintenance-mode`,
        { enabled },
      );
      setMaintenanceModes((prev) => ({ ...prev, [appId]: result.status ?? (enabled ? "active" : "deactivated") }));
      toast.success(enabled ? "Maintenance mode enabled" : "Maintenance mode disabled");
      await loadAppDetails(appId, { refreshCache: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update maintenance mode");
    } finally {
      setActionLoading(null);
    }
  };

  const handleWordpressDebugChange = async (appId: string, key: WordPressDebugOptionKey, enabled: boolean) => {
    if (!subscriptionId) return;
    setActionLoading(`wp-debug-${key}-${appId}`);
    try {
      await apiClient.put(`/hosting/wordpress/${subscriptionId}/wordpress/${appId}/wp-config`, {
        [key]: enabled,
      });
      toast.success(
        key === "WpDebug"
          ? enabled
            ? "WP_DEBUG enabled"
            : "WP_DEBUG disabled"
          : key === "WpDebugLog"
            ? enabled
              ? "WP_DEBUG_LOG enabled"
              : "WP_DEBUG_LOG disabled"
            : enabled
              ? "WP_DEBUG_DISPLAY enabled"
              : "WP_DEBUG_DISPLAY disabled",
      );
      setWpDebugFlags((prev) => ({
        ...prev,
        [appId]: { ...(prev[appId] ?? { WpDebug: false, WpDebugLog: false, WpDebugDisplay: false }), [key]: enabled },
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update WordPress wp-config debug option");
      await loadAppDetails(appId, { refreshCache: true });
    } finally {
      setActionLoading(null);
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
      await loadInstallations();
      await loadAppDetails(appId, { refreshCache: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update version");
    } finally {
      setActionLoading(null);
    }
  };

  const loadPluginCatalog = useCallback(async (search = pluginSearch, page = 1) => {
    setPluginCatalogLoading(true);
    try {
      const params = new URLSearchParams({ search, page: String(page), perPage: "12" });
      const data = await apiClient.get<WordPressCatalogResponse>(`/hosting/wordpress/catalog/plugins?${params.toString()}`);
      setPluginCatalog(data.items ?? []);
      setPluginCatalogPage(data.page ?? page);
      setPluginCatalogPages(data.pages ?? 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to search WordPress plugins");
    } finally {
      setPluginCatalogLoading(false);
    }
  }, [pluginSearch]);

  const loadThemeCatalog = useCallback(async (search = themeSearch, page = 1) => {
    setThemeCatalogLoading(true);
    try {
      const params = new URLSearchParams({ search, page: String(page), perPage: "12" });
      const data = await apiClient.get<WordPressCatalogResponse>(`/hosting/wordpress/catalog/themes?${params.toString()}`);
      setThemeCatalog(data.items ?? []);
      setThemeCatalogPage(data.page ?? page);
      setThemeCatalogPages(data.pages ?? 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to search WordPress themes");
    } finally {
      setThemeCatalogLoading(false);
    }
  }, [themeSearch]);

  const openPluginStore = (appId: string) => {
    setInstallPluginAppId(appId);
    setPluginSlug("");
    setPluginSearch("");
    setInstallPluginOpen(true);
    void loadPluginCatalog("", 1);
  };

  const openThemeStore = (appId: string) => {
    setInstallThemeAppId(appId);
    setThemeSlug("");
    setThemeSearch("");
    setInstallThemeOpen(true);
    void loadThemeCatalog("", 1);
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
        name: newUserUsername.trim(),
        email: newUserEmail.trim(),
        password: newUserPassword,
      });
      toast.success("User created");
      setCreateUserOpen(false);
      setNewUserUsername("");
      setNewUserEmail("");
      setNewUserPassword("");
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

  const closeEditUser = () => {
    setEditUserDialog(null);
    setEditUserPassword("");
  };

  const openEditUser = (appId: string, user: WordPressUser) => {
    setEditUserDialog({ appId, user });
    setEditUserEmail(user.email);
    setEditUserDisplayName(user.displayName?.trim() || user.username);
    setEditUserPassword("");
  };

  const handleSaveEditUser = async () => {
    if (!subscriptionId || !editUserDialog) return;
    const payload: Record<string, string> = {};
    if (editUserEmail.trim()) payload.email = editUserEmail.trim();
    if (editUserDisplayName.trim()) payload.name = editUserDisplayName.trim();
    if (editUserPassword.trim()) payload.password = editUserPassword.trim();
    if (Object.keys(payload).length === 0) {
      toast.error("Change email, display name, or set a new password");
      return;
    }
    const { appId, user } = editUserDialog;
    setUpdatingUser(true);
    try {
      await apiClient.patch(`/hosting/wordpress/${subscriptionId}/wordpress/${appId}/users/${user.id}`, payload);
      toast.success("User updated");
      closeEditUser();
      await loadAppDetails(appId, { refreshCache: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setUpdatingUser(false);
    }
  };

  const handleInstallPlugin = async (selectedSlug = pluginSlug) => {
    const slug = selectedSlug.trim();
    if (!subscriptionId || !installPluginAppId || !slug) return;
    setInstallingPlugin(true);
    try {
      await apiClient.post(`/hosting/wordpress/${subscriptionId}/wordpress/${installPluginAppId}/plugins`, {
        slug,
      });
      toast.success("Plugin installed");
      setInstallPluginOpen(false);
      setPluginSlug("");
      await loadAppDetails(installPluginAppId, { refreshCache: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to install plugin");
    } finally {
      setInstallingPlugin(false);
    }
  };

  const handleUpdatePlugin = async (appId: string, pluginName: string, payload: Record<string, string>) => {
    if (!subscriptionId) return;
    setActionLoading(`plugin-${pluginName}`);
    try {
      await apiClient.patch(`/hosting/wordpress/${subscriptionId}/wordpress/${appId}/plugins/${encodeURIComponent(pluginName)}`, payload);
      toast.success(`Plugin "${pluginName}" updated`);
      await loadAppDetails(appId, { refreshCache: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update plugin");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdatePluginVersion = async (appId: string, pluginName: string) => {
    if (!subscriptionId) return;
    setActionLoading(`plugin-version-${pluginName}`);
    try {
      await apiClient.patch(`/hosting/wordpress/${subscriptionId}/wordpress/${appId}/plugins/${encodeURIComponent(pluginName)}/version`, {});
      toast.success(`Plugin "${pluginName}" update initiated`);
      await loadAppDetails(appId, { refreshCache: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update plugin version");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeletePlugin = async (appId: string, pluginName: string) => {
    if (!subscriptionId) return;
    if (!confirm(`Delete plugin "${pluginName}"?`)) return;
    setActionLoading(`plugin-${pluginName}`);
    try {
      await apiClient.delete(`/hosting/wordpress/${subscriptionId}/wordpress/${appId}/plugins/${encodeURIComponent(pluginName)}`);
      toast.success(`Plugin "${pluginName}" deleted`);
      await loadAppDetails(appId, { refreshCache: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete plugin");
    } finally {
      setActionLoading(null);
    }
  };

  const handleInstallTheme = async (selectedSlug = themeSlug) => {
    const slug = selectedSlug.trim();
    if (!subscriptionId || !installThemeAppId || !slug) return;
    setInstallingTheme(true);
    try {
      await apiClient.post(`/hosting/wordpress/${subscriptionId}/wordpress/${installThemeAppId}/themes`, {
        slug,
      });
      toast.success("Theme installed");
      setInstallThemeOpen(false);
      setThemeSlug("");
      await loadAppDetails(installThemeAppId, { refreshCache: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to install theme");
    } finally {
      setInstallingTheme(false);
    }
  };

  const handleUpdateThemeVersion = async (appId: string, themeName: string) => {
    if (!subscriptionId) return;
    setActionLoading(`theme-update-${themeName}`);
    try {
      await apiClient.post(`/hosting/wordpress/${subscriptionId}/wordpress/${appId}/themes/${encodeURIComponent(themeName)}/update`);
      toast.success(`Theme "${themeName}" update initiated`);
      await loadAppDetails(appId, { refreshCache: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update theme");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleThemeAutoUpdate = async (appId: string, themeName: string, enabled: boolean) => {
    if (!subscriptionId) return;
    setActionLoading(`theme-auto-${themeName}`);
    try {
      await apiClient.patch(`/hosting/wordpress/${subscriptionId}/wordpress/${appId}/themes/${encodeURIComponent(themeName)}/auto-update`, { enabled });
      toast.success(`Theme "${themeName}" auto-update ${enabled ? "enabled" : "disabled"}`);
      await loadAppDetails(appId, { refreshCache: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update theme auto-update");
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivateTheme = async (appId: string, themeName: string) => {
    if (!subscriptionId) return;
    setActionLoading(`theme-${themeName}`);
    try {
      await apiClient.post(`/hosting/wordpress/${subscriptionId}/wordpress/${appId}/themes/${encodeURIComponent(themeName)}/activate`);
      toast.success(`Theme "${themeName}" activated`);
      await loadAppDetails(appId, { refreshCache: true });
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
      await loadAppDetails(appId, { refreshCache: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete theme");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && installations.length === 0) {
    return (
      <section className={cn("rounded-2xl cyber-card cyber-card--hover")}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading WordPress installations...</span>
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
                    {(versions[app.id] ?? app.version) && <Badge variant="outline">v{versions[app.id] ?? app.version}</Badge>}
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
                        <Card className="border-primary/25">
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
                                    <Label className="text-sm">Maintenance mode</Label>
                                    <p className="text-xs text-muted-foreground">Temporarily block visitors while you work on this site.</p>
                                  </div>
                                  <Switch
                                    checked={maintenanceModes[app.id] === "active"}
                                    disabled={actionLoading === `maintenance-${app.id}`}
                                    onCheckedChange={(value) => handleToggleMaintenanceMode(app.id, value)}
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

                        <Card className="border-primary/25">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Bug className="h-4 w-4 text-muted-foreground" />
                              Debugging <span className="text-muted-foreground font-normal">(wp-config)</span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <p className="text-xs text-muted-foreground">
                              Values map to Enhance <code className="text-[11px]">WordpressConfig</code>:{" "}
                              <code className="text-[11px]">WpDebug</code>,{" "}
                              <code className="text-[11px]">WpDebugLog</code>,{" "}
                              <code className="text-[11px]">WpDebugDisplay</code>.
                            </p>
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <Label htmlFor={`wp-debug-${app.id}-core`}>WP_DEBUG</Label>
                                <p className="text-xs text-muted-foreground">Core debug mode (`WP_DEBUG`).</p>
                              </div>
                              <Switch
                                id={`wp-debug-${app.id}-core`}
                                aria-label="WP_DEBUG"
                                checked={Boolean(wpDebugFlags[app.id]?.WpDebug)}
                                disabled={
                                  Boolean(settingsLoading[app.id]) || actionLoading === `wp-debug-WpDebug-${app.id}`
                                }
                                onCheckedChange={(checked) => handleWordpressDebugChange(app.id, "WpDebug", checked)}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <Label htmlFor={`wp-debug-${app.id}-log`}>WP_DEBUG_LOG</Label>
                                <p className="text-xs text-muted-foreground">Log errors to wp-content/debug.log when debug is on.</p>
                              </div>
                              <Switch
                                id={`wp-debug-${app.id}-log`}
                                aria-label="WP_DEBUG_LOG"
                                checked={Boolean(wpDebugFlags[app.id]?.WpDebugLog)}
                                disabled={
                                  Boolean(settingsLoading[app.id]) || actionLoading === `wp-debug-WpDebugLog-${app.id}`
                                }
                                onCheckedChange={(checked) => handleWordpressDebugChange(app.id, "WpDebugLog", checked)}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <Label htmlFor={`wp-debug-${app.id}-disp`}>WP_DEBUG_DISPLAY</Label>
                                <p className="text-xs text-muted-foreground">
                                  Whether to surface errors on the front end — usually disabled in production.
                                </p>
                              </div>
                              <Switch
                                id={`wp-debug-${app.id}-disp`}
                                aria-label="WP_DEBUG_DISPLAY"
                                checked={Boolean(wpDebugFlags[app.id]?.WpDebugDisplay)}
                                disabled={
                                  Boolean(settingsLoading[app.id]) ||
                                  actionLoading === `wp-debug-WpDebugDisplay-${app.id}`
                                }
                                onCheckedChange={(checked) => handleWordpressDebugChange(app.id, "WpDebugDisplay", checked)}
                              />
                            </div>
                          </CardContent>
                        </Card>

                        {/* Users */}
                        <Card className="border-primary/25">
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Users className="h-4 w-4 text-muted-foreground" />Users
                              </CardTitle>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => loadAppDetails(app.id, { refreshCache: true })}
                                  disabled={settingsLoading[app.id]}
                                >
                                  <RefreshCw className={cn("h-3 w-3 mr-1", settingsLoading[app.id] && "animate-spin")} />Refresh
                                </Button>
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
                                    <TableHead className="text-right">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {users[app.id]?.map((user) => (
                                    <TableRow key={user.id}>
                                      <TableCell className="font-medium">
                                        <div>{user.username}</div>
                                        {user.displayName && user.displayName !== user.username ? (
                                          <div className="text-xs font-normal text-muted-foreground">{user.displayName}</div>
                                        ) : null}
                                      </TableCell>
                                      <TableCell>{user.email}</TableCell>
                                      <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            aria-label="Edit user"
                                            onClick={() => openEditUser(app.id, user)}
                                            disabled={updatingUser}
                                          >
                                            <Pencil className="h-3 w-3" />
                                          </Button>
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
                        <Card className="border-primary/25">
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Puzzle className="h-4 w-4 text-muted-foreground" />Plugins
                              </CardTitle>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => loadAppDetails(app.id, { refreshCache: true })}
                                  disabled={settingsLoading[app.id]}
                                >
                                  <RefreshCw className={cn("h-3 w-3 mr-1", settingsLoading[app.id] && "animate-spin")} />Refresh
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openPluginStore(app.id)}
                                >
                                  <Plus className="h-3 w-3 mr-1" />Install
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {(plugins[app.id]?.length ?? 0) === 0 ? (
                              <p className="text-sm text-muted-foreground">No plugins found.</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {plugins[app.id]?.map((plugin) => {
                                  const isActive = plugin.status === "active";
                                  const autoUpdateEnabled = plugin.autoUpdate === "enabled";
                                  const pluginBusy = actionLoading === `plugin-${plugin.name}`;
                                  return (
                                    <div
                                      key={plugin.name}
                                      className="flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs"
                                    >
                                      <Badge variant={isActive ? "default" : "outline"} className="text-[10px] px-1.5">
                                        {isActive ? "on" : "off"}
                                      </Badge>
                                      <span>{plugin.title || plugin.name}{plugin.version ? ` v${plugin.version}` : ""}</span>
                                      <div className="flex items-center gap-1">
                                        <span className="text-muted-foreground">Active</span>
                                        <Switch
                                          checked={isActive}
                                          disabled={pluginBusy}
                                          onCheckedChange={(checked) => handleUpdatePlugin(app.id, plugin.name, { status: checked ? "active" : "inactive" })}
                                        />
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <span className="text-muted-foreground">Auto</span>
                                        <Switch
                                          checked={autoUpdateEnabled}
                                          disabled={pluginBusy}
                                          onCheckedChange={(checked) => handleUpdatePlugin(app.id, plugin.name, { autoUpdate: checked ? "enabled" : "disabled" })}
                                        />
                                      </div>
                                      {plugin.update === "available" && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-6 px-2 text-xs"
                                          onClick={() => handleUpdatePluginVersion(app.id, plugin.name)}
                                          disabled={actionLoading === `plugin-version-${plugin.name}`}
                                        >
                                          {actionLoading === `plugin-version-${plugin.name}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                                          <span className="ml-1">Update</span>
                                        </Button>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                                        onClick={() => handleDeletePlugin(app.id, plugin.name)}
                                        disabled={pluginBusy}
                                      >
                                        {pluginBusy ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Trash2 className="h-2.5 w-2.5" />}
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* Themes */}
                        <Card className="border-primary/25">
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Paintbrush className="h-4 w-4 text-muted-foreground" />Themes
                              </CardTitle>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => loadAppDetails(app.id, { refreshCache: true })}
                                  disabled={settingsLoading[app.id]}
                                >
                                  <RefreshCw className={cn("h-3 w-3 mr-1", settingsLoading[app.id] && "animate-spin")} />Refresh
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openThemeStore(app.id)}
                                >
                                  <Plus className="h-3 w-3 mr-1" />Install
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {(themes[app.id]?.length ?? 0) === 0 ? (
                              <p className="text-sm text-muted-foreground">No themes found.</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {themes[app.id]?.map((theme) => {
                                  const isActive = theme.status === "active";
                                  const autoUpdateEnabled = theme.autoUpdate === "on" || theme.autoUpdate === "enabled";
                                  const themeBusy = actionLoading === `theme-${theme.name}`;
                                  return (
                                    <div
                                      key={theme.name}
                                      className="flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs"
                                    >
                                      <Badge variant={isActive ? "default" : "outline"} className="text-[10px] px-1.5">
                                        {isActive ? "active" : theme.status ?? "inactive"}
                                      </Badge>
                                      <span>{theme.name}{theme.version ? ` v${theme.version}` : ""}</span>
                                      <div className="flex items-center gap-1">
                                        <span className="text-muted-foreground">Auto</span>
                                        <Switch
                                          checked={autoUpdateEnabled}
                                          disabled={actionLoading === `theme-auto-${theme.name}`}
                                          onCheckedChange={(checked) => handleToggleThemeAutoUpdate(app.id, theme.name, checked)}
                                        />
                                      </div>
                                      {theme.update === "available" && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-6 px-2 text-xs"
                                          onClick={() => handleUpdateThemeVersion(app.id, theme.name)}
                                          disabled={actionLoading === `theme-update-${theme.name}`}
                                        >
                                          {actionLoading === `theme-update-${theme.name}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                                          <span className="ml-1">Update</span>
                                        </Button>
                                      )}
                                      {!isActive && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 w-5 p-0"
                                          onClick={() => handleActivateTheme(app.id, theme.name)}
                                          disabled={themeBusy}
                                          title="Activate"
                                        >
                                          {themeBusy ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Check className="h-2.5 w-2.5" />}
                                        </Button>
                                      )}
                                      {!isActive && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                                          onClick={() => handleDeleteTheme(app.id, theme.name)}
                                          disabled={themeBusy}
                                          title="Delete"
                                        >
                                          <Trash2 className="h-2.5 w-2.5" />
                                        </Button>
                                      )}
                                    </div>
                                  );
                                })}
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

      {/* Edit User Dialog */}
      <Dialog
        open={Boolean(editUserDialog)}
        onOpenChange={(open) => {
          if (!open) closeEditUser();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit WordPress User</DialogTitle>
            <DialogDescription>
              Update the WordPress user fields exposed by Enhance: name, email, and password.
            </DialogDescription>
          </DialogHeader>
          {editUserDialog ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="wp-edit-user-name">Name</Label>
                <Input
                  id="wp-edit-user-name"
                  value={editUserDisplayName}
                  onChange={(e) => setEditUserDisplayName(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wp-edit-user-email">Email</Label>
                <Input
                  id="wp-edit-user-email"
                  type="email"
                  value={editUserEmail}
                  onChange={(e) => setEditUserEmail(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wp-edit-user-password">New password</Label>
                <Input
                  id="wp-edit-user-password"
                  type="password"
                  value={editUserPassword}
                  onChange={(e) => setEditUserPassword(e.target.value)}
                  placeholder="Leave blank to keep current"
                  autoComplete="new-password"
                />
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                <div>
                  <div className="font-medium text-foreground">Login</div>
                  <div>{editUserDialog.user.username}</div>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={closeEditUser} disabled={updatingUser}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void handleSaveEditUser()} disabled={updatingUser}>
              {updatingUser && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Install Plugin</DialogTitle>
            <DialogDescription>Search WordPress.org plugins or install by exact slug.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Input
                value={pluginSearch}
                onChange={(e) => setPluginSearch(e.target.value)}
                placeholder="Search plugins, e.g. ecommerce or security"
                onKeyDown={(event) => {
                  if (event.key === "Enter") void loadPluginCatalog(pluginSearch, 1);
                }}
              />
              <Button variant="outline" onClick={() => loadPluginCatalog(pluginSearch, 1)} disabled={pluginCatalogLoading}>
                {pluginCatalogLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {pluginCatalogLoading ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading plugin store...
              </div>
            ) : (
              <div className="grid max-h-[420px] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
                {pluginCatalog.map((plugin) => (
                  <div key={plugin.slug} className="flex gap-3 rounded-lg border p-3">
                    {plugin.imageUrl ? (
                      <img src={plugin.imageUrl} alt="" className="h-12 w-12 rounded-md border bg-muted object-cover" />
                    ) : (
                      <Puzzle className="h-12 w-12 rounded-md border bg-muted p-2 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="line-clamp-1 text-sm font-medium">{plugin.name || plugin.slug}</h3>
                          <p className="text-xs text-muted-foreground">{plugin.slug}{plugin.version ? ` · v${plugin.version}` : ""}</p>
                        </div>
                        <Button size="sm" onClick={() => handleInstallPlugin(plugin.slug)} disabled={installingPlugin}>
                          {installingPlugin ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
                          Install
                        </Button>
                      </div>
                      {plugin.shortDescription && <p className="line-clamp-2 text-xs text-muted-foreground">{plugin.shortDescription}</p>}
                      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        {plugin.author && <span>{plugin.author}</span>}
                        {formatCatalogMetric(plugin.activeInstalls) && <span>{formatCatalogMetric(plugin.activeInstalls)} active installs</span>}
                        {plugin.lastUpdated && <span>Updated {plugin.lastUpdated}</span>}
                      </div>
                    </div>
                  </div>
                ))}
                {pluginCatalog.length === 0 && (
                  <div className="col-span-full rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No plugins found. Try another search or install by slug below.
                  </div>
                )}
              </div>
            )}
            {pluginCatalogPages > 1 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Page {pluginCatalogPage} of {pluginCatalogPages}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={pluginCatalogPage <= 1 || pluginCatalogLoading} onClick={() => loadPluginCatalog(pluginSearch, pluginCatalogPage - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={pluginCatalogPage >= pluginCatalogPages || pluginCatalogLoading} onClick={() => loadPluginCatalog(pluginSearch, pluginCatalogPage + 1)}>Next</Button>
                </div>
              </div>
            )}
            <div className="space-y-2 rounded-lg border p-3">
              <Label>Install by slug</Label>
              <Input value={pluginSlug} onChange={(e) => setPluginSlug(e.target.value)} placeholder="woocommerce" />
              <p className="text-xs text-muted-foreground">Use this for an exact WordPress.org plugin slug.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setInstallPluginOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => handleInstallPlugin()} disabled={installingPlugin || !pluginSlug.trim()}>
              {installingPlugin && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}Install
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Install Theme Dialog */}
      <Dialog open={installThemeOpen} onOpenChange={setInstallThemeOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Install Theme</DialogTitle>
            <DialogDescription>Search WordPress.org themes or install by exact slug.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Input
                value={themeSearch}
                onChange={(e) => setThemeSearch(e.target.value)}
                placeholder="Search themes, e.g. blog or ecommerce"
                onKeyDown={(event) => {
                  if (event.key === "Enter") void loadThemeCatalog(themeSearch, 1);
                }}
              />
              <Button variant="outline" onClick={() => loadThemeCatalog(themeSearch, 1)} disabled={themeCatalogLoading}>
                {themeCatalogLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {themeCatalogLoading ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading theme store...
              </div>
            ) : (
              <div className="grid max-h-[420px] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
                {themeCatalog.map((theme) => (
                  <div key={theme.slug} className="overflow-hidden rounded-lg border">
                    {theme.imageUrl ? (
                      <img src={theme.imageUrl} alt="" className="h-28 w-full bg-muted object-cover" />
                    ) : (
                      <div className="flex h-28 items-center justify-center bg-muted">
                        <Paintbrush className="h-10 w-10 text-muted-foreground" />
                      </div>
                    )}
                    <div className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="line-clamp-1 text-sm font-medium">{theme.name || theme.slug}</h3>
                          <p className="text-xs text-muted-foreground">{theme.slug}{theme.version ? ` · v${theme.version}` : ""}</p>
                        </div>
                        <Button size="sm" onClick={() => handleInstallTheme(theme.slug)} disabled={installingTheme}>
                          {installingTheme ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
                          Install
                        </Button>
                      </div>
                      {theme.shortDescription && <p className="line-clamp-2 text-xs text-muted-foreground">{theme.shortDescription}</p>}
                      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        {theme.author && <span>{theme.author}</span>}
                        {formatCatalogMetric(theme.downloads) && <span>{formatCatalogMetric(theme.downloads)} downloads</span>}
                        {theme.lastUpdated && <span>Updated {theme.lastUpdated}</span>}
                      </div>
                    </div>
                  </div>
                ))}
                {themeCatalog.length === 0 && (
                  <div className="col-span-full rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No themes found. Try another search or install by slug below.
                  </div>
                )}
              </div>
            )}
            {themeCatalogPages > 1 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Page {themeCatalogPage} of {themeCatalogPages}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={themeCatalogPage <= 1 || themeCatalogLoading} onClick={() => loadThemeCatalog(themeSearch, themeCatalogPage - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={themeCatalogPage >= themeCatalogPages || themeCatalogLoading} onClick={() => loadThemeCatalog(themeSearch, themeCatalogPage + 1)}>Next</Button>
                </div>
              </div>
            )}
            <div className="space-y-2 rounded-lg border p-3">
              <Label>Install by slug</Label>
              <Input value={themeSlug} onChange={(e) => setThemeSlug(e.target.value)} placeholder="twentytwentyfour" />
              <p className="text-xs text-muted-foreground">Use this for an exact WordPress.org theme slug.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setInstallThemeOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => handleInstallTheme()} disabled={installingTheme || !themeSlug.trim()}>
              {installingTheme && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}Install
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
