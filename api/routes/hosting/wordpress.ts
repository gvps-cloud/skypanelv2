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
    const installations = await EnhanceService.getWordpressInstallations(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id);
    res.json(installations);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get WordPress installations" });
  }
});

router.get("/:id/wordpress/:appId/settings", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const settings = await EnhanceService.getWordpressSettings(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.params.appId);
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get WordPress settings" });
  }
});

router.put("/:id/wordpress/:appId/settings", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const result = await EnhanceService.updateWordpressSettings(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.params.appId, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update WordPress settings" });
  }
});

router.get("/:id/wordpress/:appId/users", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const users = await EnhanceService.getWordpressUsers(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.params.appId);
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get WordPress users" });
  }
});

export default router;
