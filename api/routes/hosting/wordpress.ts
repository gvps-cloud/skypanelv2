import express, { type Request, type Response } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { requireOrganization } from "../../middleware/auth.js";
import { requireHostingEnabledForUsers, requireOrgPermission } from "../../middleware/hosting.js";
import { query } from "../../lib/database.js";
import { EnhanceService } from "../../services/enhanceService.js";
import { config } from "../../config/index.js";
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
  const result = await query(
    `SELECT * FROM hosting_subscriptions WHERE id = $1 AND organization_id = $2`,
    [id, organizationId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: "Service not found" });
    return null;
  }
  return result.rows[0];
}

// WordPress Installations
router.get("/:id/wordpress", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const apps = await EnhanceService.getWebsiteApps(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id);
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
    const settings = await EnhanceService.getWordpressSettings(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.params.appId);
    res.json({ settings });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get WordPress settings" });
  }
});

router.patch("/:id/wordpress/:appId/settings", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    await EnhanceService.updateWordpressSettings(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.params.appId, req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update WordPress settings" });
  }
});

router.get("/:id/wordpress/:appId/users", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const users = await EnhanceService.getWordpressUsers(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.params.appId);
    res.json({ users: unwrapItems(users).map(normalizeWordpressUser) });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get WordPress users" });
  }
});

router.get("/:id/wordpress/:appId/users/:userId/sso", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const result = await EnhanceService.getWordpressUserSsoUrl(
      config.ENHANCE_MASTER_ORG_ID,
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
    const plugins = await EnhanceService.getWordpressPlugins(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.params.appId);
    res.json({ plugins: unwrapItems(plugins).map(normalizeWordpressPlugin) });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get WordPress plugins" });
  }
});

router.get("/:id/wordpress/:appId/themes", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const themes = await EnhanceService.getWordpressThemes(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.params.appId);
    res.json({ themes: unwrapItems(themes).map(normalizeWordpressTheme) });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get WordPress themes" });
  }
});

export default router;
