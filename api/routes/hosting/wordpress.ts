import express, { type Request, type Response } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { requireOrganization } from "../../middleware/auth.js";
import { requireHostingEnabledForUsers, requireOrgPermission } from "../../middleware/hosting.js";
import { getEnhanceWebsiteOrgId, getHostingSubscriptionForOrganization } from "../../lib/hostingEnhanceOrg.js";
import { EnhanceService } from "../../services/enhanceService.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken, requireOrganization, requireHostingEnabledForUsers);

import { unwrapItems } from "../../lib/unwrapItems.js";

function normalizeWordpressApp(app: any) {
  const path = app?.path ?? "";
  return {
    id: String(app?.id ?? ""),
    name: path ? `WordPress (${path})` : "WordPress",
    path,
    version: app?.version ?? null,
    status: app?.status ?? null,
  };
}

function normalizeWordpressUser(user: any) {
  return {
    id: String(user?.id ?? ""),
    username: String(user?.login ?? user?.username ?? ""),
    email: String(user?.email ?? ""),
    role: user?.role ?? null,
  };
}

function normalizeWordpressPlugin(plugin: any) {
  return {
    name: String(plugin?.name ?? ""),
    title: plugin?.title ?? plugin?.name ?? "",
    version: plugin?.version ?? null,
    status: plugin?.status ?? null,
    update: plugin?.update ?? null,
    autoUpdate: plugin?.autoUpdate ?? null,
    author: plugin?.author ?? null,
  };
}

function normalizeWordpressTheme(theme: any) {
  return {
    name: String(theme?.name ?? ""),
    version: theme?.version ?? null,
    status: theme?.status ?? null,
    update: theme?.update ?? null,
    autoUpdate: theme?.autoUpdate ?? null,
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
  return subscription;
}

// WordPress Installations
router.get("/:id/wordpress", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
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
    res.json({ settings });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get WordPress settings" });
  }
});

router.patch("/:id/wordpress/:appId/settings", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.updateWordpressSettings(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId, req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update WordPress settings" });
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
    const plugins = await EnhanceService.getWordpressPlugins(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId);
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
    const themes = await EnhanceService.getWordpressThemes(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId);
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
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.createWordpressUser(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to create WordPress user" });
  }
});

router.patch("/:id/wordpress/:appId/users/:userId", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.updateWordpressUser(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId, req.params.userId, req.body);
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
    const result = await EnhanceService.installWordpressPlugin(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId, req.body);
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

// WordPress Themes
router.post("/:id/wordpress/:appId/themes", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.installWordpressTheme(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId, req.body);
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
    const result = await EnhanceService.setWordpressConfig(enhanceWebsiteOrgId, sub.enhance_website_id, req.params.appId, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to set WordPress config" });
  }
});

export default router;
