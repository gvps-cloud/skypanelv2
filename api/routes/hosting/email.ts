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

// Email Boxes
router.get("/:id/emails", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const emails = await EnhanceService.getWebsiteEmails(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id);
    res.json(emails);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get emails" });
  }
});

router.post("/:id/emails", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const result = await EnhanceService.createWebsiteEmail(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to create email" });
  }
});

router.get("/:id/emails/:emailAddress", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const result = await EnhanceService.getWebsiteEmail(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.params.emailAddress);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get email" });
  }
});

router.delete("/:id/emails/:emailAddress", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    await EnhanceService.deleteWebsiteEmail(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.params.emailAddress);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to delete email" });
  }
});

export default router;
