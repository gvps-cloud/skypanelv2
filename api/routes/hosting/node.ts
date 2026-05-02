import express, { type Request, type Response } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { requireOrganization } from "../../middleware/auth.js";
import { requireHostingEnabledForUsers, requireOrgPermission } from "../../middleware/hosting.js";
import { resolveHostingContext, unwrapItems, successPayload } from "../../lib/hostingRouteHelpers.js";
import { EnhanceService } from "../../services/enhanceService.js";

const router = express.Router();

router.use(authenticateToken, requireOrganization, requireHostingEnabledForUsers);

// Persistent Apps (Runtime / Background processes)
router.get("/:id/persistent-apps", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const context = await resolveHostingContext(req, res);
  if (!context) return;
  try {
    const apps = await EnhanceService.getWebsitePersistentApps(context.websiteId);
    const items = unwrapItems(apps);
    res.json({ items, apps: items });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get persistent apps" });
  }
});

router.post("/:id/persistent-apps", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const context = await resolveHostingContext(req, res);
  if (!context) return;
  try {
    const result = await EnhanceService.createWebsitePersistentApp(context.websiteId, req.body);
    res.json(successPayload(result));
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to create persistent app" });
  }
});

router.patch("/:id/persistent-apps/:appId", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const context = await resolveHostingContext(req, res);
  if (!context) return;
  try {
    const result = await EnhanceService.updateWebsitePersistentApp(context.websiteId, req.params.appId, req.body);
    res.json(successPayload(result));
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update persistent app" });
  }
});

router.delete("/:id/persistent-apps/:appId", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const context = await resolveHostingContext(req, res);
  if (!context) return;
  try {
    await EnhanceService.deleteWebsitePersistentApp(context.websiteId, req.params.appId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to delete persistent app" });
  }
});

router.get("/:id/persistent-apps/:appId/log", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const context = await resolveHostingContext(req, res);
  if (!context) return;
  try {
    const result = await EnhanceService.getWebsitePersistentAppLog(context.websiteId, req.params.appId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get persistent app log" });
  }
});

router.post("/:id/nvm", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const context = await resolveHostingContext(req, res);
  if (!context) return;
  try {
    const result = await EnhanceService.installWebsiteNvm(context.websiteId);
    res.json(successPayload(result));
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to install Node.js runtime" });
  }
});

router.get("/:id/node/possible-versions", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const context = await resolveHostingContext(req, res);
  if (!context) return;
  try {
    const versions = await EnhanceService.getPossibleNodeVersions(context.websiteId);
    res.json({ versions: unwrapItems<string>(versions) });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get possible Node.js versions" });
  }
});

router.get("/:id/node/versions", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const context = await resolveHostingContext(req, res);
  if (!context) return;
  try {
    const versions = await EnhanceService.getInstalledNodeVersions(context.websiteId);
    res.json({ versions: unwrapItems<string>(versions) });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get installed Node.js versions" });
  }
});

router.post("/:id/node/versions", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const context = await resolveHostingContext(req, res);
  if (!context) return;
  try {
    const version = String(req.body?.version ?? req.body ?? "").trim();
    if (!version) return res.status(400).json({ error: "Version is required" });
    const result = await EnhanceService.installNodeVersion(context.websiteId, version);
    res.json(successPayload(result));
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to install Node.js version" });
  }
});

router.put("/:id/node/versions/default", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const context = await resolveHostingContext(req, res);
  if (!context) return;
  try {
    const version = String(req.body?.version ?? req.body ?? "").trim();
    if (!version) return res.status(400).json({ error: "Version is required" });
    const result = await EnhanceService.setDefaultNodeVersion(context.websiteId, version);
    res.json(successPayload(result));
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to set default Node.js version" });
  }
});

export default router;
