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

function normalizeFtpUser(user: any) {
  return {
    account: String(user?.account ?? user?.username ?? ""),
    homeDir: String(user?.homeDir ?? user?.homeDirectory ?? ""),
  };
}

function toEnhanceFtpUserPayload(body: any) {
  return {
    account: body?.account ?? body?.username,
    password: body?.password,
    homeDir: body?.homeDir ?? body?.homeDirectory ?? "",
  };
}

function toEnhanceFtpUserUpdatePayload(body: any) {
  return {
    ...(body?.password ? { password: body.password } : {}),
    ...(typeof (body?.homeDir ?? body?.homeDirectory) !== "undefined"
      ? { homeDir: body?.homeDir ?? body?.homeDirectory }
      : {}),
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

// FTP Users
router.get("/:id/ftp-users", requireOrgPermission("hosting_view"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const users = await EnhanceService.getWebsiteFtpUsers(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id);
    res.json({ users: unwrapItems(users).map(normalizeFtpUser) });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to get FTP users" });
  }
});

router.post("/:id/ftp-users", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    const result = await EnhanceService.createWebsiteFtpUser(
      config.ENHANCE_MASTER_ORG_ID,
      sub.enhance_website_id,
      toEnhanceFtpUserPayload(req.body),
    );
    res.status(201).json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to create FTP user" });
  }
});

router.patch("/:id/ftp-users/:username", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    await EnhanceService.updateWebsiteFtpUser(
      config.ENHANCE_MASTER_ORG_ID,
      sub.enhance_website_id,
      req.params.username,
      toEnhanceFtpUserUpdatePayload(req.body),
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to update FTP user" });
  }
});

router.delete("/:id/ftp-users/:username", requireOrgPermission("hosting_manage"), async (req: Request, res: Response) => {
  const sub = await resolveSubscription(req, res);
  if (!sub) return;
  try {
    await EnhanceService.deleteWebsiteFtpUser(config.ENHANCE_MASTER_ORG_ID, sub.enhance_website_id, req.params.username);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to delete FTP user" });
  }
});

export default router;
