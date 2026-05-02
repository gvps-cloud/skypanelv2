import express, { type Request, type Response } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { requireOrganization } from "../../middleware/auth.js";
import { requireHostingEnabledForUsers, requireOrgPermission } from "../../middleware/hosting.js";
import { getEnhanceWebsiteOrgId, getHostingSubscriptionForOrganization } from "../../lib/hostingEnhanceOrg.js";
import { booleanQuery } from "../../lib/hostingRouteHelpers.js";
import { unwrapItems } from "../../lib/unwrapItems.js";
import { EnhanceService } from "../../services/enhanceService.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken, requireOrganization, requireHostingEnabledForUsers);

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

function requireWebsiteId(subscription: any, res: Response): string | null {
  if (!subscription.enhance_website_id) {
    res.status(400).json({ error: "Website not yet provisioned" });
    return null;
  }

  return String(subscription.enhance_website_id);
}

function requireEnhanceSubscriptionId(subscription: any, res: Response): string | null {
  if (!subscription.enhance_subscription_id) {
    res.status(400).json({ error: "Enhance subscription not yet provisioned" });
    return null;
  }

  return String(subscription.enhance_subscription_id);
}

function isWordpressApp(app: any): boolean {
  return String(app?.app ?? app?.kind ?? "").toLowerCase() === "wordpress";
}

function shouldRefreshAppVersion(app: any): boolean {
  const version = String(app?.version ?? "").trim();
  return !version || version === "0.0.0" || version.toLowerCase() === "unknown";
}

function readVersionValue(result: any): string | null {
  if (typeof result === "string" && result.trim()) return result.trim();
  if (typeof result?.version === "string" && result.version.trim()) return result.version.trim();
  return null;
}

async function enrichInstalledAppsWithRuntimeVersions(orgId: string, websiteId: string, apps: any[]) {
  return Promise.all(
    apps.map(async (app) => {
      const appId = String(app?.id ?? app?.appId ?? app?.app_id ?? "");
      if (!appId || !isWordpressApp(app) || !shouldRefreshAppVersion(app)) {
        return app;
      }

      try {
        const versionResult = await EnhanceService.getWordpressAppVersion(orgId, websiteId, appId);
        const version = readVersionValue(versionResult);
        return version ? { ...app, version } : app;
      } catch (error) {
        console.warn("Failed to enrich WordPress app version:", error);
        return app;
      }
    }),
  );
}

// Installable apps for this subscription
router.get("/:id/installable", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  const enhanceSubscriptionId = requireEnhanceSubscriptionId(sub, res);
  if (!enhanceSubscriptionId) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.getInstallableApps(enhanceWebsiteOrgId, enhanceSubscriptionId);
    res.json({ apps: unwrapItems(result) });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get installable apps" });
  }
});

// Installed apps on this website
router.get("/:id/apps", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  const websiteId = requireWebsiteId(sub, res);
  if (!websiteId) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.getWebsiteApps(enhanceWebsiteOrgId, websiteId);
    const apps = await enrichInstalledAppsWithRuntimeVersions(enhanceWebsiteOrgId, websiteId, unwrapItems(result));
    res.json({ apps });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get installed apps" });
  }
});

// Install a new app
router.post("/:id/apps", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  const websiteId = requireWebsiteId(sub, res);
  if (!websiteId) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    const result = await EnhanceService.createWebsiteApp(enhanceWebsiteOrgId, websiteId, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to install app" });
  }
});

// Delete an installed app
router.delete("/:id/apps/:appId", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  const websiteId = requireWebsiteId(sub, res);
  if (!websiteId) return;
  try {
    const enhanceWebsiteOrgId = getEnhanceWebsiteOrgId(sub);
    await EnhanceService.deleteWebsiteApp(enhanceWebsiteOrgId, websiteId, req.params.appId, {
      backupBeforeOperation: booleanQuery(req.query.backupBeforeOperation),
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to delete app" });
  }
});

export default router;
