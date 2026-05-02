import express, { type Request, type Response } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { requireOrganization } from "../../middleware/auth.js";
import { requireHostingEnabledForUsers, requireOrgPermission } from "../../middleware/hosting.js";
import { getEnhanceWebsiteOrgId, getHostingSubscriptionForOrganization } from "../../lib/hostingEnhanceOrg.js";
import { unwrapItems } from "../../lib/unwrapItems.js";
import { EnhanceApiError, EnhanceService } from "../../services/enhanceService.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken, requireOrganization, requireHostingEnabledForUsers);

type MaintenanceModeStatus = "active" | "deactivated";

function normalizeWordpressApp(app: any) {
  const path = app?.path ?? "";
  return {
    id: String(app?.id ?? app?.appId ?? app?.app_id ?? ""),
    name: path ? `WordPress (${path})` : "WordPress",
    path,
    version: app?.version ?? null,
    status: app?.status ?? null,
  };
}

function normalizeWordpressUser(user: any) {
  const rawName = user?.name ?? user?.display_name ?? user?.displayName;
  const displayName =
    typeof rawName === "string" && rawName.trim()
      ? rawName.trim()
      : null;
  return {
    id: String(user?.id ?? user?.ID ?? ""),
    username: String(user?.login ?? user?.username ?? ""),
    email: String(user?.email ?? ""),
    displayName,
  };
}

function getEnhanceErrorMessage(error: EnhanceApiError, fallbackMessage: string): string {
  const body = error.responseBody;
  if (typeof body === "string" && body.trim()) return body;

  if (body && typeof body === "object") {
    const responseBody = body as Record<string, any>;
    if (Array.isArray(responseBody.errors) && responseBody.errors.length > 0) {
      const firstError = responseBody.errors[0];
      if (typeof firstError === "string") return firstError;
      if (firstError && typeof firstError === "object") {
        const nestedMessage = firstError.reason ?? firstError.message ?? firstError.error;
        if (typeof nestedMessage === "string" && nestedMessage.trim()) return nestedMessage;
      }
    }

    const message = responseBody.detail ?? responseBody.message ?? responseBody.reason ?? responseBody.error;
    if (typeof message === "string" && message.trim()) return message;
    if (message && typeof message === "object" && typeof message.message === "string") return message.message;
  }

  return error.message || fallbackMessage;
}

function sendWordpressError(res: Response, error: unknown, fallbackMessage: string) {
  if (error instanceof EnhanceApiError) {
    res.status(error.statusCode ?? 500).json({ error: getEnhanceErrorMessage(error, fallbackMessage) });
    return;
  }

  const message = error instanceof Error && error.message ? error.message : fallbackMessage;
  res.status(500).json({ error: message });
}

function normalizeWordpressPlugin(plugin: any) {
  return {
    name: String(plugin?.name ?? plugin?.pluginName ?? plugin?.plugin ?? ""),
    title: plugin?.title ?? plugin?.name ?? plugin?.pluginName ?? "",
    version: plugin?.version ?? null,
    status: plugin?.status ?? null,
    update: plugin?.update ?? null,
    autoUpdate: plugin?.autoUpdate ?? null,
    author: plugin?.author ?? null,
  };
}

function normalizeWordpressTheme(theme: any) {
  return {
    name: String(theme?.name ?? theme?.theme ?? theme?.slug ?? ""),
    version: theme?.version ?? null,
    status: theme?.status ?? null,
    update: theme?.update ?? null,
    autoUpdate: theme?.autoUpdate ?? null,
  };
}

function normalizeWordpressSettings(settings: any) {
  if (!settings || typeof settings !== "object") return settings;
  const normalized: Record<string, any> = {
    loginAccess: Array.isArray(settings.loginAccess) ? settings.loginAccess : [],
  };
  if (settings.autoUpdateCore === "major" || settings.autoUpdateCore === "minor") {
    normalized.autoUpdateCore = settings.autoUpdateCore;
  }
  if (!normalized.autoUpdateCore) {
    if (settings.coreAutoupdateMajorVersion === true) normalized.autoUpdateCore = "major";
    else if (settings.coreAutoupdateMinorVersion === true) normalized.autoUpdateCore = "minor";
  }
  return normalized;
}

function toEnhanceWordpressSettings(settings: any) {
  const payload: Record<string, any> = {};
  if (settings?.autoUpdateCore === "major" || settings?.autoUpdateCore === "minor") {
    payload.autoUpdateCore = settings.autoUpdateCore;
  }
  if (Array.isArray(settings?.loginAccess)) {
    payload.loginAccess = settings.loginAccess.filter((item: unknown) => typeof item === "string" && item.trim());
  }
  return payload;
}

function normalizeMaintenanceModeStatus(value: unknown): MaintenanceModeStatus {
  if (value === "active" || value === "activate" || value === true) return "active";
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return normalizeMaintenanceModeStatus(record.status ?? record.mode ?? record.enabled);
  }
  return "deactivated";
}

function toEnhanceMaintenanceMode(value: unknown): "activate" | "deactivate" {
  if (value === "activate" || value === "active" || value === true) return "activate";
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return toEnhanceMaintenanceMode(record.mode ?? record.status ?? record.enabled);
  }
  return "deactivate";
}

function toEnhanceInstallPlugin(body: any) {
  return {
    pluginName: String(body?.pluginName ?? body?.slug ?? body?.name ?? "").trim(),
  };
}

function toEnhanceInstallTheme(body: any) {
  const payload: Record<string, any> = {
    name: String(body?.name ?? body?.slug ?? body?.themeName ?? "").trim(),
  };
  if (typeof body?.activate === "boolean") payload.activate = body.activate;
  return payload;
}

function toEnhancePluginSettings(body: any) {
  const payload: Record<string, any> = {};
  if (typeof body?.status === "string" && body.status.trim()) payload.status = body.status.trim();
  if (typeof body?.autoUpdate === "string" && body.autoUpdate.trim()) payload.autoUpdate = body.autoUpdate.trim();
  if (typeof body?.active === "boolean") payload.status = body.active ? "active" : "inactive";
  if (typeof body?.autoUpdateEnabled === "boolean") payload.autoUpdate = body.autoUpdateEnabled ? "enabled" : "disabled";
  return payload;
}

/** Enhance accepts the same WordPress user fields exposed by the Enhance UI: login, name, password, and email. */
function toEnhanceNewWpUser(body: any): Record<string, string> {
  const login = typeof body?.login === "string" ? body.login.trim() : "";
  const name =
    typeof body?.name === "string" && body.name.trim()
      ? body.name.trim()
      : typeof body?.displayName === "string" && body.displayName.trim()
        ? body.displayName.trim()
        : login;
  const password = typeof body?.password === "string" ? body.password : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  const payload: Record<string, string> = {};
  if (login) payload.login = login;
  if (name) payload.name = name;
  if (password) payload.password = password;
  if (email) payload.email = email;
  return payload;
}

/** `UpdateWpUser` in Enhance OAS: only `email`, `name` (display name), `password`. */
function toEnhanceUpdateWpUser(body: any): Record<string, string> {
  const payload: Record<string, string> = {};
  if (typeof body?.email === "string" && body.email.trim()) payload.email = body.email.trim();
  if (typeof body?.name === "string" && body.name.trim()) payload.name = body.name.trim();
  if (typeof body?.password === "string" && body.password.trim()) payload.password = body.password.trim();
  return payload;
}

function clampCatalogNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(numeric)));
}

function pickCatalogImage(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ["svg", "2x", "1x", "default"]) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  }
  return null;
}

function normalizeCatalogItem(item: any, kind: "plugin" | "theme") {
  return {
    kind,
    slug: String(item?.slug ?? "").trim(),
    name: String(item?.name ?? item?.title ?? item?.slug ?? "").trim(),
    version: item?.version ?? null,
    author: typeof item?.author === "string" ? item.author.replace(/<[^>]+>/g, "").trim() : null,
    rating: typeof item?.rating === "number" ? item.rating : Number(item?.rating ?? 0),
    activeInstalls: item?.active_installs ?? item?.activeInstalls ?? null,
    downloads: item?.downloaded ?? item?.downloads ?? null,
    lastUpdated: item?.last_updated ?? item?.lastUpdated ?? null,
    shortDescription: item?.short_description ?? item?.description ?? null,
    imageUrl: pickCatalogImage(item?.icons ?? item?.screenshot_url ?? item?.screenshotUrl),
    homepageUrl: item?.homepage ?? item?.preview_url ?? null,
  };
}

async function fetchWordpressCatalog(kind: "plugins" | "themes", query: Request["query"]) {
  const search = String(query.search ?? "").trim();
  const page = clampCatalogNumber(query.page, 1, 1, 100);
  const perPage = clampCatalogNumber(query.perPage ?? query.per_page, 12, 1, 36);
  const params = new URLSearchParams({
    action: kind === "plugins" ? "query_plugins" : "query_themes",
    "request[page]": String(page),
    "request[per_page]": String(perPage),
  });
  if (search) params.set("request[search]", search);

  if (kind === "plugins") {
    params.set("request[fields][icons]", "1");
    params.set("request[fields][active_installs]", "1");
    params.set("request[fields][short_description]", "1");
  } else {
    params.set("request[fields][screenshot_url]", "1");
  }

  const endpoint = kind === "plugins"
    ? "https://api.wordpress.org/plugins/info/1.2/"
    : "https://api.wordpress.org/themes/info/1.2/";
  const response = await fetch(`${endpoint}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`WordPress.org catalog error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const rawItems = kind === "plugins" ? data?.plugins : data?.themes;
  return {
    items: Array.isArray(rawItems) ? rawItems.map((item: any) => normalizeCatalogItem(item, kind === "plugins" ? "plugin" : "theme")).filter((item: any) => item.slug) : [],
    page,
    perPage,
    total: Number(data?.info?.results ?? 0),
    pages: Number(data?.info?.pages ?? 0),
  };
}

async function resolveSubscription(req: Request, res: Response) {
  const { organizationId } = (req as AuthenticatedRequest).user;
  const { id } = req.params;
  const subscription = await getHostingSubscriptionForOrganization(id, organizationId);
  if (!subscription) {
    res.status(404).json({ error: "Service not found" });
    return null;
  }
  if (!subscription.enhance_website_id) {
    res.status(400).json({ error: "Website not yet provisioned" });
    return null;
  }
  return subscription;
}

router.get("/catalog/plugins", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  try {
    res.json(await fetchWordpressCatalog("plugins", req.query));
  } catch (error: any) {
    res.status(502).json({ error: error?.message || "Failed to search WordPress plugins" });
  }
});

router.get("/catalog/themes", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  try {
    res.json(await fetchWordpressCatalog("themes", req.query));
  } catch (error: any) {
    res.status(502).json({ error: error?.message || "Failed to search WordPress themes" });
  }
});

// WordPress Installations
router.get("/:id/wordpress", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const discovered = await EnhanceService.getWordpressInstallations(enhanceWebsiteOrgId, sub.enhance_website_id);
    const discoveredInstallations = unwrapItems(discovered)
      .map(normalizeWordpressApp)
      .filter((app) => app.id);

    if (discoveredInstallations.length > 0) {
      return res.json({ installations: discoveredInstallations });
    }

    const apps = await EnhanceService.getWebsiteApps(enhanceWebsiteOrgId, sub.enhance_website_id);
    res.json({
      installations: unwrapItems(apps)
        .filter((app) => app?.app === "wordpress")
        .map(normalizeWordpressApp)
        .filter((app) => app.id),
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get WordPress installations" });
  }
});

router.get("/:id/wordpress/:appId/settings", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const settings = await EnhanceService.getWordpressSettings(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId);
    res.json({ settings: normalizeWordpressSettings(settings) });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get WordPress settings" });
  }
});

router.patch("/:id/wordpress/:appId/settings", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.updateWordpressSettings(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId, toEnhanceWordpressSettings(req.body));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update WordPress settings" });
  }
});

router.get("/:id/wordpress/:appId/maintenance-mode", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const status = await EnhanceService.getWordpressMaintenanceMode(req.params.appId);
    res.json({ status: normalizeMaintenanceModeStatus(status) });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get WordPress maintenance mode" });
  }
});

router.put("/:id/wordpress/:appId/maintenance-mode", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const mode = toEnhanceMaintenanceMode(req.body);
    await EnhanceService.setWordpressMaintenanceMode(req.params.appId, mode);
    res.json({ success: true, status: mode === "activate" ? "active" : "deactivated" });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update WordPress maintenance mode" });
  }
});

router.get("/:id/wordpress/:appId/users", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const users = await EnhanceService.getWordpressUsers(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId);
    res.json({ users: unwrapItems(users).map(normalizeWordpressUser) });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get WordPress users" });
  }
});

router.get("/:id/wordpress/:appId/users/:userId/sso", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.getWordpressUserSsoUrl(
      enhanceWebsiteOrgId,
      sub.enhance_website_id,
      req.params.appId,
      req.params.userId,
    );
    res.json({ url: typeof result === "string" ? result : result?.url ?? result?.ssoUrl ?? null });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get WordPress SSO URL" });
  }
});

router.get("/:id/wordpress/:appId/plugins", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const plugins = await EnhanceService.getWordpressPlugins(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId, {
      refreshCache: req.query.refreshCache === "true",
    });
    res.json({ plugins: unwrapItems(plugins).map(normalizeWordpressPlugin) });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get WordPress plugins" });
  }
});

router.get("/:id/wordpress/:appId/themes", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const themes = await EnhanceService.getWordpressThemes(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId, {
      refreshCache: req.query.refreshCache === "true",
    });
    res.json({ themes: unwrapItems(themes).map(normalizeWordpressTheme) });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get WordPress themes" });
  }
});

// WordPress Version
router.get("/:id/wordpress/:appId/version", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.getWordpressAppVersion(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get WordPress version" });
  }
});

router.patch("/:id/wordpress/:appId/version", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.updateWordpressAppVersion(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update WordPress version" });
  }
});

// WordPress User CRUD
router.post("/:id/wordpress/:appId/users", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const payload = toEnhanceNewWpUser(req.body);
    for (const field of ["login", "name", "password", "email"]) {
      if (!payload[field]) {
        res.status(400).json({ error: `WordPress user ${field} is required` });
        return;
      }
    }
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.createWordpressUser(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId, payload);
    res.json(result);
  } catch (error: any) {
    sendWordpressError(res, error, "Failed to create WordPress user");
  }
});

router.patch("/:id/wordpress/:appId/users/:userId", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const payload = toEnhanceUpdateWpUser(req.body);
    if (Object.keys(payload).length === 0) {
      res.status(400).json({ error: "At least one of email, display name, or password is required" });
      return;
    }
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.updateWordpressUser(
      enhanceWebsiteOrgId,
      sub.enhance_website_id,
      req.params.appId,
      req.params.userId,
      payload,
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update WordPress user" });
  }
});

router.delete("/:id/wordpress/:appId/users/:userId", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.deleteWordpressUser(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId, req.params.userId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to delete WordPress user" });
  }
});

// WordPress Plugins
router.post("/:id/wordpress/:appId/plugins", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const payload = toEnhanceInstallPlugin(req.body);
    if (!payload.pluginName) {
      return res.status(400).json({ error: "Plugin slug is required" });
    }
    const result = await EnhanceService.installWordpressPlugin(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId, payload);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to install WordPress plugin" });
  }
});

router.delete("/:id/wordpress/:appId/plugins/:pluginId", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.deleteWordpressPlugin(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId, req.params.pluginId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to delete WordPress plugin" });
  }
});

router.patch("/:id/wordpress/:appId/plugins/:pluginId", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const payload = toEnhancePluginSettings(req.body);
    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ error: "Plugin status or auto-update setting is required" });
    }
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.updateWordpressPluginSettings(
      enhanceWebsiteOrgId,
      sub.enhance_website_id,
      req.params.appId,
      req.params.pluginId,
      payload,
    );
    res.json(result ?? { success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update WordPress plugin" });
  }
});

router.patch("/:id/wordpress/:appId/plugins/:pluginId/version", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.updateWordpressPluginToLatest(
      enhanceWebsiteOrgId,
      sub.enhance_website_id,
      req.params.appId,
      req.params.pluginId,
    );
    res.json(result ?? { success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update WordPress plugin version" });
  }
});

// WordPress Themes
router.post("/:id/wordpress/:appId/themes", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const payload = toEnhanceInstallTheme(req.body);
    if (!payload.name) {
      return res.status(400).json({ error: "Theme slug is required" });
    }
    const result = await EnhanceService.installWordpressTheme(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId, payload);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to install WordPress theme" });
  }
});

router.delete("/:id/wordpress/:appId/themes/:themeId", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.deleteWordpressTheme(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId, req.params.themeId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to delete WordPress theme" });
  }
});

router.post("/:id/wordpress/:appId/themes/:themeId/update", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.updateWordpressTheme(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId, req.params.themeId);
    res.json(result ?? { success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update WordPress theme" });
  }
});

router.post("/:id/wordpress/:appId/themes/:themeId/activate", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.activateWordpressTheme(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId, req.params.themeId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to activate WordPress theme" });
  }
});

router.patch("/:id/wordpress/:appId/themes/:themeId/auto-update", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enabled = typeof req.body === "boolean" ? req.body : Boolean(req.body?.enabled);
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.setWordpressThemeAutoUpdateStatus(
      enhanceWebsiteOrgId,
      sub.enhance_website_id,
      req.params.appId,
      req.params.themeId,
      enabled,
    );
    res.json(result ?? { success: true, enabled });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update WordPress theme auto-update" });
  }
});

// WordPress wp-config
router.get("/:id/wordpress/:appId/wp-config/:wpOption", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.getWordpressConfig(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId, req.params.wpOption);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get WordPress config" });
  }
});

router.put("/:id/wordpress/:appId/wp-config", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.setWordpressConfig(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId, req.body);
    res.status(200).json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to set WordPress config" });
  }
});

export default router;
